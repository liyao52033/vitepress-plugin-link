import { useRouter, useData, inBrowser } from "vitepress";
import { nextTick, onMounted } from "vue";

export default function usePermalink() {
  const fakeHost = "http://a.com";
  const router = useRouter();
  const { site, theme } = useData();
  const { base } = site.value;
  const { permalinks = {} } = theme.value;
  const permalinkKeys = Object.keys(permalinks);

  /**
   * 为 vitepress 的 router 添加 push 方法，支持手动跳转 permalink
   * 根据传入的 href 动态判断是否为文档地址或 permalink，如果为文档地址，则走 vitepress 默认的 go 方法，如果为 permalink，则根据 permalink 跳转对应的文档地址
   *
   * @param href 文档地址或 permalink
   */
  router.push = (href = inBrowser ? location.href : "/") => {
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
   * 判断路由是否为文档路由
   * 1. 如果为文档路由，则替换为 permalink
   * 2. 如果为 permalink，则跳转到文档路由，然后重新触发该方法的第 1 点，即将文档路由替换为 permalink（先加载 404 页面再瞬间跳转文档路由）
   *
   * @param href 浏览器地址栏
   * @remark 第 2 点的逻辑已由 vitepress-plugin-permalink 插件实现了（不会出现 404 页面过渡），因此现在是在插件执行后，重新触发该方法，替换 URL 为 permalink
   */
  const processUrl = (href: string) => {
    if (!permalinkKeys.length) return;

    const { pathname, search, hash } = new URL(href, fakeHost);

    // 解码，支持中文
    const decodePath = decodeURIComponent(pathname.slice(base.length || 1));
    const decodeHash = decodeURIComponent(hash);
    // 当使用 cleanUrls 为 false 时，decodePath 会带上 .html，因此去掉 .html
    const permalink = permalinks.map[decodePath.replace(/\.html/, "")];

    // 如果当前 pathname 和 permalink 相同，则不需要处理
    if (permalink === decodePath) return;

    if (permalink) {
      // 存在 permalink 则在 URL 替换
      nextTick(() => {
        history.replaceState(history.state || null, "", `${permalink}${search}${decodeHash}`);
      });
    } else {
      // 第二点，不存在 permalink 则获取文档地址来跳转
      const path = permalinks.inv[`/${decodePath}`];
      if (path) return (router as any).push(`${path}${search}${decodeHash}`);
    }
  };

  onMounted(() => processUrl(window.location.href));

  /**
   * 监听路由变化（刷新页面不会触发），处理路由地址
   */
  const startWatch = () => {
    if (!permalinkKeys.length) return;

    const selfOnAfterRouteChange = router.onAfterRouteChange;
    router.onAfterRouteChange = (href: string) => {
      // 处理路由地址
      processUrl(href);
      // 调用已有的 onAfterRouteChange
      selfOnAfterRouteChange?.(href);
    };
  };

  return { startWatch };
}
