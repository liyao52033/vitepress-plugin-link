import type { Plugin, ViteDevServer } from "vite";
import createPermalinks, { standardLink } from "./helper";
import type { Permalink, PermalinkOption } from "./types";
import picocolors from "picocolors";
import { join } from "node:path";

export * from "./types";

export const log = (message: string, type = "yellow") => {
  console.log((picocolors as any)[type](message));
};

export default function VitePluginVitePressPermalink(option: PermalinkOption = {}): Plugin & { name: string } {
  let vitepressConfig: any = {};

  return {
    name: "vite-plugin-vitepress-sidebar-permalink",
    config(config: any) {
      const {
        site: { themeConfig, cleanUrls, locales },
        srcDir,
        rewrites,
      } = config.vitepress;

      if (themeConfig.permalinks) return

      const baseDir = option.path ? join(process.cwd(), option.path) : srcDir;

      const permalinks = createPermalinks({ ...option, path: baseDir }, cleanUrls);

      // Key 为 path，Value 为 permalink
      const pathToPermalink: Record<string, string> = {};
      // Key 为 permalink，Value 为 path
      const permalinkToPath: Record<string, string> = {};
      // 国际化多语言 key 数组
      const localesKeys = Object.keys(locales || {});

      for (const [key, value] of Object.entries(permalinks)) {
        // 如果设置了 rewrites，则取 rewrites 后的文件路径
        const rewriteFilePath = rewrites.map[`${key}.md`]?.replace(/\.md/, "") || key;
        // 如果设置了多语言，则 permalink 添加语言前缀
        let newValue = getLocalePermalink(localesKeys, key, value);

        if (permalinkToPath[newValue]) {
          log(`永久链接「${newValue}」已存在，其对应的 '${permalinkToPath[newValue]}' 将会被 「${key}」 覆盖`);
        }

        pathToPermalink[rewriteFilePath] = newValue;
        permalinkToPath[newValue] = rewriteFilePath;
      }

      themeConfig.permalinks = { map: pathToPermalink, inv: permalinkToPath } as Permalink;

      log("injected permalinks data successfully. 注入永久链接数据成功!", "green");

      vitepressConfig = config.vitepress;

      // 导航栏高亮适配 permalink
      // if (!localesKeys.length) {
      //   return setActiveMatchWhenUsePermalink(themeConfig.nav, permalinkToPath, cleanUrls, rewrites);
      // }

      localesKeys.forEach(localeKey => {
        setActiveMatchWhenUsePermalink(
          locales[localeKey].themeConfig?.nav,
          permalinkToPath,
          cleanUrls,
          rewrites,
          localeKey
        );
      });
    },
    configureServer(server: ViteDevServer) {
      const {
        site: {
          base,
          themeConfig: { permalinks },
          cleanUrls,
        },
        rewrites,
      } = vitepressConfig;
      
      // 将 permalink 重写实际文件路径，这是在服务器环境中执行
      server.middlewares.use((req, res, next) => {
        // req.url 为实际的文件资源地址，如 /guide/index.md，而不是浏览器的请求地址 /guide/index.html
        if (req.url) {
          try {
            const reqUrl = decodeURI(req.url)
              .replace(/[?#].*$/, "")
              .replace(/\.md$/, "")
              .slice(base.length);
      
            const finalReqUrl = reqUrl.startsWith("/") ? reqUrl : `/${reqUrl}`;
            
            // 尝试多种可能的路径格式来匹配
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
            
            // 如果设置了 rewrites，则取没有 rewrites 前的实际文件地址
            const realFilePath = filePath ? (rewrites.inv[`${filePath}.md`]?.replace(/\.md/, "") || filePath) : null;
      
            // 如果找到文档路由，则跳转，防止页面 404
            if (realFilePath) {
              req.url = req.url.replace(encodeURI(reqUrl), encodeURI(realFilePath));
            }
          } catch (error) {
            console.error('处理请求URL时出错:', error);
          }
        }
        next();
      });
    },
  };
}

/**
 * 给 permalink 添加多语言前缀
 *
 * @param localesKeys 多语言 key 数组，排除 root 根目录
 * @param path 文件路径
 * @param permalink 永久链接
 */
const getLocalePermalink = (localesKeys: string[] = [], path = "", permalink = "") => {
  // 过滤掉 root 根目录
  const localesKey = localesKeys.filter(key => key !== "root").find(key => path.startsWith(key));
  if (localesKey) return `/${localesKey}${permalink.startsWith("/") ? permalink : `/${permalink}`}`;

  return permalink;
};

// /**
//  * 如果 nav 有 link 且 link 为 permalink，则添加 activeMatch 为 permalink 对应的文件路径
//  * 这里的处理是导航栏兼容 permalink 的高亮功能，默认访问 permalink 后，导航栏不会高亮，因为导航栏是根据实际的文件路径进行匹配
//  *
//  * @param nav 导航栏
//  * @param permalinkToPath permalink 和文件路径的映射关系
//  * @param cleanUrls cleanUrls
//  * @param rewrites 如果设置了 rewrites，则取 rewrites 后的文件路径
//  * @param localeKey 多语言名称
//  */
// const setActiveMatchWhenUsePermalink = (
//   nav: any[] = [],
//   permalinkToPath: Record<string, string>,
//   cleanUrls = false,
//   rewrites: Record<string, any> = {},
//   localeKey = ""
// ) => {
//   if (!nav.length) return;

//   nav.forEach(item => {
//     if (item.link === "/") return;

//     const link = standardLink(item.link);
//     // cleanUrls 为 false 时，permalinkToPath 的 key 都会带上 .html
//     const path = permalinkToPath[cleanUrls ? link : `${link.replace(/\.html/, "")}.html`];

//     if (path && !item.activeMatch) {
//       // 如果设置了 rewrites，则取 rewrites 后的文件路径
//       const finalPathArr = (rewrites.map[`${path}.md`]?.replace(/\.md/, "") || path).split("/");
//       // 只传入父目录（兼容国际化目录），这样访问里面的 Markdown 文件后，对应导航都可以高亮（官方规定 activeMatch 是一个正则表达式字符串）
//       if (finalPathArr[0] === localeKey) item.activeMatch = `${finalPathArr[0]}/${finalPathArr[1]}`;
//       else item.activeMatch = finalPathArr[0];
//     }
//     if (item.items?.length) setActiveMatchWhenUsePermalink(item.items, permalinkToPath, cleanUrls, rewrites);
//   });
// };


const setActiveMatchWhenUsePermalink = (
  nav: any[] = [],
  permalinkToPath: Record<string, string>,
  cleanUrls = false,
  rewrites: Record<string, any> = {},
  localeKey = ""
) => {
  if (!nav.length) return;

  nav.forEach(item => {
    if (item.link === "/") return;

    const link = standardLink(item.link);
    // cleanUrls 为 false 时，permalinkToPath 的 key 都会带上 .html
    const path = permalinkToPath[cleanUrls ? link : `${link.replace(/\.html/, "")}.html`];

    if (path && !item.activeMatch) {
      // 如果设置了 rewrites，则取 rewrites 后的文件路径
      const finalPath = rewrites.map[`${path}.md`]?.replace(/\.md/, "") || path;
      
      // 使用finalPath构建activeMatch，确保与实际文件路径匹配
      const pathSegments = finalPath.split('/');
      let activeMatchPath;
      
      if (pathSegments[0] === localeKey) {
        // 对于国际化路径，使用语言前缀和第一级目录
        activeMatchPath = pathSegments.length > 1 ? 
          `^/${pathSegments[0]}/${pathSegments[1]}` : 
          `^/${pathSegments[0]}`;
      } else {
        // 对于非国际化路径，使用第一级目录
        activeMatchPath = `^/${pathSegments[0]}`;
      }
      
      // 添加结束匹配
      item.activeMatch = `${activeMatchPath}(?:/|$)`;
    }

    // 递归处理子项
    if (item.items?.length) {
      setActiveMatchWhenUsePermalink(item.items, permalinkToPath, cleanUrls, rewrites, localeKey);
    }
  });
};