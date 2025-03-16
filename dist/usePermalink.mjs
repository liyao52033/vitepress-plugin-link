import { nextTick } from 'vue';
import * as Vitepress from 'vitepress';

const { useData, useRouter } = Vitepress;
const inBrowser = typeof window !== "undefined";
function usePermalink() {
  if (!inBrowser) return { startWatch: () => {
  } };
  const fakeHost = "http://a.com";
  const router = useRouter();
  const { site, theme } = useData();
  const { base } = site.value;
  const { permalinks = {} } = theme.value;
  const permalinkKeys = Object.keys(permalinks);
  router.push = (href = location.href) => {
    if (!href) throw new Error("href is undefined");
    const { pathname, search, hash } = new URL(href, fakeHost);
    const decodePath = decodeURIComponent(pathname);
    const decodeHash = decodeURIComponent(hash);
    let permalink = permalinks.map[decodePath.replace(/\.html/, "")];
    if (permalink === decodePath) return router.go(href);
    if (!permalink) {
      const path = permalinks.inv[decodePath] || permalinks.inv[decodePath.endsWith("/") ? decodePath.slice(0, -1) : decodePath];
      if (path) {
        permalink = pathname;
        href = `${path}${search}${decodeHash}`;
      }
    }
    router.go(href);
  };
  const processUrl = (href) => {
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
  const startWatch = () => {
    if (!permalinkKeys.length) return;
    if (inBrowser) {
      nextTick(() => {
        processUrl(window.location.href);
      });
    }
    const selfOnAfterRouteChange = router.onAfterRouteChange;
    router.onAfterRouteChange = (href) => {
      processUrl(href);
      selfOnAfterRouteChange?.(href);
    };
  };
  return { startWatch };
}

export { usePermalink as default };
