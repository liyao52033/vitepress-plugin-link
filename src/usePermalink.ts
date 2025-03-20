import { nextTick } from "vue";
import * as Vitepress from 'vitepress';

const { useData, useRouter } = Vitepress;
const inBrowser = typeof window !== "undefined";

export default function usePermalink() {
  if (!inBrowser) return { startWatch: () => { } }; // SSR 期间不执行

  const fakeHost = "http://a.com";
  const router = useRouter();
  const { site, theme } = useData();
  const { base } = site.value;
  const { permalinks = {} } = theme.value;
  const permalinkKeys = Object.keys(permalinks);

  /**
   * 兼容 SSR，确保 push 方法只在浏览器环境生效
   */
    router.push = (href = location.href) => {
      if (!href) throw new Error("href is undefined");

      const { pathname, search, hash } = new URL(href, fakeHost);
      // 解码，支持中文
      const decodePath = decodeURIComponent(pathname);
      const decodeHash = decodeURIComponent(hash);
      // 根据 decodePath 找 permalink，当使用 cleanUrls 为 false 时，decodePath 会带上 .html，因此尝试去掉 .html
      let permalink = permalinks.map[decodePath.replace(/\.html/, "")];

      // 如果当前 pathname 和 permalink 相同，则直接跳转，等价于直接调用 go 方法
      if (permalink === decodePath) return router.go(href);

      if (!permalink) {
        // 如果 permalink 不存在，则根据 decodePath 反过来找 permalink
        const path =
          permalinks.inv[decodePath] || permalinks.inv[decodePath.endsWith("/") ? decodePath.slice(0, -1) : decodePath];

        // 如果 path 存在，则进行更新
        if (path) {
          permalink = pathname;
          href = `${path}${search}${decodeHash}`;
        }
      }

      // 执行 vitepress 的 go 方法进行跳转
      router.go(href);
    };

  

  /**
   * 处理 URL 跳转
   */
  const processUrl = (href: string) => {
    if (!permalinkKeys.length) return;

    const { pathname, search, hash } = new URL(href, fakeHost);
    const decodePath = decodeURIComponent(pathname.slice(base.length || 1));
    const decodeHash = decodeURIComponent(hash);
    const permalink = permalinks.map?.[decodePath.replace(/\.html/, "")];

    if (permalink === decodePath) return;

    if (permalink) {
      nextTick(() => {
        history.replaceState(history.state || null, "", `${permalink}${search}${decodeHash}`);
      });
    } else {
      const path = permalinks.inv?.[`/${decodePath}`];
      if (path) return router.push(`${path}${search}${decodeHash}`);
    }
  };

  
  /**
   * 监听路由变化
   */
  const startWatch = () => {
    if (!permalinkKeys.length) return;

    // 在这里添加初始化处理
    if (inBrowser) {
      // 使用 nextTick 确保在 DOM 更新后处理 URL
      nextTick(() => {
        processUrl(window.location.href);
      });
    }
  
    const selfOnAfterRouteChange = router.onAfterRouteChange;
    router.onAfterRouteChange = (href: string) => {
      processUrl(href);
      selfOnAfterRouteChange?.(href);
    };
  };

  return { startWatch };
}
