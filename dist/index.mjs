import { readdirSync, statSync, readFileSync } from 'node:fs';
import { basename, resolve, extname, join } from 'node:path';
import matter from 'gray-matter';
import picocolors from 'picocolors';

const DEFAULT_IGNORE_DIR = ["node_modules", "dist", ".vitepress", "public"];
const permalinks = {};
const createPermalinks = (option = {}, cleanUrls = false) => {
  const { path = process.cwd(), ignoreList = [] } = option;
  const dirPaths = readDirPaths(path, ignoreList);
  scannerMdFile(path, option, "", cleanUrls, true);
  dirPaths.forEach((dirPath) => scannerMdFile(dirPath, option, basename(dirPath), cleanUrls));
  return permalinks;
};
const readDirPaths = (sourceDir, ignoreList = []) => {
  const dirPaths = [];
  const ignoreListAll = [...DEFAULT_IGNORE_DIR, ...ignoreList];
  const secondDirNames = readdirSync(sourceDir);
  secondDirNames.forEach((secondDirName) => {
    const secondDirPath = resolve(sourceDir, secondDirName);
    if (!isSome(ignoreListAll, secondDirName) && statSync(secondDirPath).isDirectory()) {
      dirPaths.push(secondDirPath);
    }
  });
  return dirPaths;
};
const scannerMdFile = (root, option, prefix = "", cleanUrls = false, onlyScannerRootMd = false) => {
  const { ignoreList = [] } = option;
  const ignoreListAll = [...DEFAULT_IGNORE_DIR, ...ignoreList];
  let secondDirOrFilenames = readdirSync(root);
  secondDirOrFilenames.forEach((dirOrFilename) => {
    if (isSome(ignoreListAll, dirOrFilename)) return;
    const filePath = resolve(root, dirOrFilename);
    if (!onlyScannerRootMd && statSync(filePath).isDirectory()) {
      scannerMdFile(filePath, option, `${prefix}/${dirOrFilename}`, cleanUrls);
    } else {
      if (!isMdFile(dirOrFilename)) return;
      const content = readFileSync(filePath, "utf-8");
      const { data: { permalink = "" } = {} } = matter(content, {});
      if (permalink) {
        const filename = basename(dirOrFilename, extname(dirOrFilename));
        const finalPermalink = standardLink(permalink);
        permalinks[`${prefix ? `${prefix}/` : ""}${filename}`] = cleanUrls ? finalPermalink : `${finalPermalink}.html`;
      }
    }
  });
};
const isMdFile = (filePath) => {
  return filePath.includes("md") || filePath.includes("MD");
};
const isSome = (arr, name) => {
  return arr.some((item) => item === name || item instanceof RegExp && item.test(name));
};
const standardLink = (permalink = "") => {
  let finalPermalink = permalink;
  if (!finalPermalink.startsWith("/")) finalPermalink = "/" + finalPermalink;
  if (finalPermalink.endsWith("/")) finalPermalink = finalPermalink.replace(/\/$/, "");
  return finalPermalink;
};

const log = (message, type = "yellow") => {
  console.log(picocolors[type](message));
};
function VitePluginVitePressPermalink(option = {}) {
  let vitepressConfig = {};
  return {
    name: "vite-plugin-vitepress-sidebar-permalink",
    config(config) {
      const {
        site: { themeConfig, cleanUrls, locales },
        srcDir,
        rewrites
      } = config.vitepress;
      if (themeConfig.permalinks) return;
      const baseDir = option.path ? join(process.cwd(), option.path) : srcDir;
      const permalinks = createPermalinks({ ...option, path: baseDir }, cleanUrls);
      const pathToPermalink = {};
      const permalinkToPath = {};
      const localesKeys = Object.keys(locales || {});
      for (const [key, value] of Object.entries(permalinks)) {
        const rewriteFilePath = rewrites.map[`${key}.md`]?.replace(/\.md/, "") || key;
        let newValue = getLocalePermalink(localesKeys, key, value);
        if (permalinkToPath[newValue]) {
          log(`\u6C38\u4E45\u94FE\u63A5\u300C${newValue}\u300D\u5DF2\u5B58\u5728\uFF0C\u5176\u5BF9\u5E94\u7684 '${permalinkToPath[newValue]}' \u5C06\u4F1A\u88AB \u300C${key}\u300D \u8986\u76D6`);
        }
        pathToPermalink[rewriteFilePath] = newValue;
        permalinkToPath[newValue] = rewriteFilePath;
      }
      themeConfig.permalinks = { map: pathToPermalink, inv: permalinkToPath };
      log("injected permalinks data successfully. \u6CE8\u5165\u6C38\u4E45\u94FE\u63A5\u6570\u636E\u6210\u529F!", "green");
      vitepressConfig = config.vitepress;
      if (!localesKeys.length) {
        return setActiveMatchWhenUsePermalink(themeConfig.nav, permalinkToPath, cleanUrls, rewrites);
      }
      localesKeys.forEach((localeKey) => {
        setActiveMatchWhenUsePermalink(
          locales[localeKey].themeConfig?.nav,
          permalinkToPath,
          cleanUrls,
          rewrites,
          localeKey
        );
      });
    },
    configureServer(server) {
      const {
        site: {
          base,
          themeConfig: { permalinks },
          cleanUrls
        },
        rewrites
      } = vitepressConfig;
      server.middlewares.use((req, _res, next) => {
        if (req.url) {
          const reqUrl = decodeURI(req.url).replace(/[?#].*$/, "").replace(/\.md$/, "").slice(base.length);
          const finalReqUrl = reqUrl.startsWith("/") ? reqUrl : `/${reqUrl}`;
          const filePath = permalinks.inv[cleanUrls ? finalReqUrl : `${finalReqUrl}.html`];
          const realFilePath = rewrites.inv[`${filePath}.md`]?.replace(/\.md/, "") || filePath;
          if (realFilePath) req.url = req.url.replace(encodeURI(reqUrl), encodeURI(realFilePath));
        }
        next();
      });
    }
  };
}
const getLocalePermalink = (localesKeys = [], path = "", permalink = "") => {
  const localesKey = localesKeys.filter((key) => key !== "root").find((key) => path.startsWith(key));
  if (localesKey) return `/${localesKey}${permalink.startsWith("/") ? permalink : `/${permalink}`}`;
  return permalink;
};
const setActiveMatchWhenUsePermalink = (nav = [], permalinkToPath, cleanUrls = false, rewrites = {}, localeKey = "") => {
  if (!nav.length) return;
  nav.forEach((item) => {
    if (item.link === "/") return;
    const link = standardLink(item.link);
    const path = permalinkToPath[cleanUrls ? link : `${link.replace(/\.html/, "")}.html`];
    if (path && !item.activeMatch) {
      const finalPathArr = (rewrites.map[`${path}.md`]?.replace(/\.md/, "") || path).split("/");
      if (finalPathArr[0] === localeKey) item.activeMatch = `${finalPathArr[0]}/${finalPathArr[1]}`;
      else item.activeMatch = finalPathArr[0];
    }
    if (item.items?.length) setActiveMatchWhenUsePermalink(item.items, permalinkToPath, cleanUrls, rewrites);
  });
};

export { VitePluginVitePressPermalink as default, log };
