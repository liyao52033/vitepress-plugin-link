'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const node_fs = require('node:fs');
const node_path = require('node:path');
const matter = require('gray-matter');
const picocolors = require('picocolors');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e.default : e; }

const matter__default = /*#__PURE__*/_interopDefaultCompat(matter);
const picocolors__default = /*#__PURE__*/_interopDefaultCompat(picocolors);

const DEFAULT_IGNORE_DIR = ["node_modules", "dist", ".vitepress", "public"];
const permalinks = {};
const createPermalinks = (option = {}, cleanUrls = false) => {
  const { path = process.cwd(), ignoreList = [] } = option;
  const dirPaths = readDirPaths(path, ignoreList);
  scannerMdFile(path, option, "", cleanUrls, true);
  dirPaths.forEach((dirPath) => scannerMdFile(dirPath, option, node_path.basename(dirPath), cleanUrls));
  return permalinks;
};
const readDirPaths = (sourceDir, ignoreList = []) => {
  const dirPaths = [];
  const ignoreListAll = [...DEFAULT_IGNORE_DIR, ...ignoreList];
  const secondDirNames = node_fs.readdirSync(sourceDir);
  secondDirNames.forEach((secondDirName) => {
    const secondDirPath = node_path.resolve(sourceDir, secondDirName);
    if (!isSome(ignoreListAll, secondDirName) && node_fs.statSync(secondDirPath).isDirectory()) {
      dirPaths.push(secondDirPath);
    }
  });
  return dirPaths;
};
const scannerMdFile = (root, option, prefix = "", cleanUrls = false, onlyScannerRootMd = false) => {
  const { ignoreList = [] } = option;
  const ignoreListAll = [...DEFAULT_IGNORE_DIR, ...ignoreList];
  let secondDirOrFilenames = node_fs.readdirSync(root);
  secondDirOrFilenames.forEach((dirOrFilename) => {
    if (isSome(ignoreListAll, dirOrFilename)) return;
    const filePath = node_path.resolve(root, dirOrFilename);
    if (!onlyScannerRootMd && node_fs.statSync(filePath).isDirectory()) {
      scannerMdFile(filePath, option, `${prefix}/${dirOrFilename}`, cleanUrls);
    } else {
      if (!isMdFile(dirOrFilename)) return;
      const content = node_fs.readFileSync(filePath, "utf-8");
      const { data: { permalink = "" } = {} } = matter__default(content, {});
      if (permalink) {
        const filename = node_path.basename(dirOrFilename, node_path.extname(dirOrFilename));
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
  console.log(picocolors__default[type](message));
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
      const baseDir = option.path ? node_path.join(process.cwd(), option.path) : srcDir;
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
      server.middlewares.use((req, res, next) => {
        if (req.url) {
          try {
            const reqUrl = decodeURI(req.url).replace(/[?#].*$/, "").replace(/\.md$/, "").slice(base.length);
            const finalReqUrl = reqUrl.startsWith("/") ? reqUrl : `/${reqUrl}`;
            const pathVariations = [
              cleanUrls ? finalReqUrl : `${finalReqUrl}.html`,
              cleanUrls ? `${finalReqUrl}/` : `${finalReqUrl}.html`,
              cleanUrls ? finalReqUrl.replace(/\/$/, "") : `${finalReqUrl.replace(/\/$/, "")}.html`
            ];
            let filePath = null;
            for (const pathVar of pathVariations) {
              if (permalinks.inv[pathVar]) {
                filePath = permalinks.inv[pathVar];
                break;
              }
            }
            const realFilePath = filePath ? rewrites.inv[`${filePath}.md`]?.replace(/\.md/, "") || filePath : null;
            if (realFilePath) {
              req.url = req.url.replace(encodeURI(reqUrl), encodeURI(realFilePath));
            }
          } catch (error) {
            console.error("\u5904\u7406\u8BF7\u6C42URL\u65F6\u51FA\u9519:", error);
          }
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
      const finalPath = rewrites.map[`${path}.md`]?.replace(/\.md/, "") || path;
      const pathSegments = finalPath.split("/");
      let activeMatchPath;
      if (pathSegments[0] === localeKey) {
        activeMatchPath = pathSegments.length > 1 ? `^/${pathSegments[0]}/${pathSegments[1]}` : `^/${pathSegments[0]}`;
      } else {
        activeMatchPath = `^/${pathSegments[0]}`;
      }
      item.activeMatch = `${activeMatchPath}(?:/|$)`;
    }
    if (item.items?.length) {
      setActiveMatchWhenUsePermalink(item.items, permalinkToPath, cleanUrls, rewrites, localeKey);
    }
  });
};

exports.default = VitePluginVitePressPermalink;
exports.log = log;
