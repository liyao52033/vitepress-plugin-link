import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import matter from "gray-matter";
import type { PermalinkOption } from "./types";

// 默认忽略的文件夹列表
export const DEFAULT_IGNORE_DIR = ["node_modules", "dist", ".vitepress", "public"];

// key 为文件路径，value 为永久链接
const permalinks: Record<string, string> = {};

/**
 * 生成永久链接
 * @param option 插件配置项
 * @param cleanUrls 是否清除 .html 后缀
 */
export default (option: PermalinkOption = {}, cleanUrls = false): Record<string, string> => {
  const { path = process.cwd(), ignoreList = [] } = option;

  // 获取指定根目录下的所有目录绝对路径
  const dirPaths = readDirPaths(path, ignoreList);

  // 只扫描根目录的 md 文件
  scannerMdFile(path, option, "", cleanUrls, true);

  // 遍历根目录下的每个子目录
  dirPaths.forEach(dirPath => scannerMdFile(dirPath, option, basename(dirPath), cleanUrls));

  return permalinks;
};

/**
 * 指定根目录下的所有目录绝对路径，win 如 ['D:\docs\01.guide', 'D:\docs\02.design']，linux 如 ['/usr/local/docs/01.guide', '/usr/local/docs/02.design']
 * @param sourceDir 指定文件/文件夹的根目录
 * @param ignoreList 忽略的文件/文件夹列表
 */
const readDirPaths = (sourceDir: string, ignoreList: PermalinkOption["ignoreList"] = []) => {
  const dirPaths: string[] = [];
  const ignoreListAll = [...DEFAULT_IGNORE_DIR, ...ignoreList];
  // 读取目录，返回数组，成员是 root 下所有的目录名（包含文件夹和文件，不递归）
  const secondDirNames = readdirSync(sourceDir);

  secondDirNames.forEach(secondDirName => {
    // 将路径或路径片段的序列解析为绝对路径，等于使用 cd 命令
    const secondDirPath = resolve(sourceDir, secondDirName);
    // 是否为文件夹目录，并排除指定文件夹
    if (!isSome(ignoreListAll, secondDirName) && statSync(secondDirPath).isDirectory()) {
      dirPaths.push(secondDirPath);
    }
  });

  return dirPaths;
};

/**
 * 扫描指定根目录下的 md 文件，并生成永久链接
 *
 * @param root 根目录
 * @param option 配置项
 * @param prefix 前缀
 * @param cleanUrls 是否清除 .html 后缀
 * @param onlyScannerRootMd 是否只扫描根目录下的 md 文件
 */
const scannerMdFile = (
  root: string,
  option: PermalinkOption,
  prefix = "",
  cleanUrls = false,
  onlyScannerRootMd = false
) => {
  const { ignoreList = [] } = option;
  const ignoreListAll = [...DEFAULT_IGNORE_DIR, ...ignoreList];

  // 读取目录名（文件和文件夹）
  let secondDirOrFilenames = readdirSync(root);

  secondDirOrFilenames.forEach(dirOrFilename => {
    if (isSome(ignoreListAll, dirOrFilename)) return;

    const filePath = resolve(root, dirOrFilename);

    if (!onlyScannerRootMd && statSync(filePath).isDirectory()) {
      // 是文件夹目录
      scannerMdFile(filePath, option, `${prefix}/${dirOrFilename}`, cleanUrls);
    } else {
      // 是文件
      if (!isMdFile(dirOrFilename)) return;

      const content = readFileSync(filePath, "utf-8");
      // 解析出 frontmatter 数据
      const { data: { permalink = "" } = {} } = matter(content, {});

      // 判断 permalink 开头是否为 /，是的话截取掉 /，否则为 permalink
      if (permalink) {
        // 如果 cleanUrls 为 false，则访问路径必须带有 .html
        const filename = basename(dirOrFilename, extname(dirOrFilename));

        const finalPermalink = standardLink(permalink);
        permalinks[`${prefix ? `${prefix}/` : ""}${filename}`] = cleanUrls ? finalPermalink : `${finalPermalink}.html`;
      }
    }
  });
};

/**
 * 判断是否为 md 文件
 *
 * @param filePath 文件绝对路径
 */
const isMdFile = (filePath: string) => {
  return filePath.includes("md") || filePath.includes("MD");
};

/**
 * 判断数组中是否存在某个元素，支持正则表达式
 *
 * @param arr 数组
 * @param name 元素
 */
const isSome = (arr: Array<string | RegExp>, name: string) => {
  return arr.some(item => item === name || (item instanceof RegExp && item.test(name)));
};

/**
 * 处理 permalink 的格式为 /xxx 或者 /xx/xx，即开头带有 /，结尾不带 /
 */
export const standardLink = (permalink = "") => {
  let finalPermalink = permalink;
  if (!finalPermalink.startsWith("/")) finalPermalink = "/" + finalPermalink;
  if (finalPermalink.endsWith("/")) finalPermalink = finalPermalink.replace(/\/$/, "");

  return finalPermalink;
};
