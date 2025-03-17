import { nextTick } from 'vue';
import * as Vitepress from 'vitepress';

const { useData, useRouter } = Vitepress;
const inBrowser = typeof window !== "undefined";
function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, delay);
  };
}
function matchPath(path, permalinks) {
  if (permalinks.inv[path]) {
    return permalinks.inv[path];
  }
  const variations = [
    path.endsWith("/") ? path.slice(0, -1) : `${path}/`,
    path.replace(/\.html$/, ""),
    `${path.replace(/\.html$/, "")}/`,
    `/${path.replace(/^\//, "")}`
  ];
  for (const variant of variations) {
    if (permalinks.inv[variant]) {
      return permalinks.inv[variant];
    }
  }
  return null;
}
function usePermalink() {
  if (!inBrowser) return { startWatch: () => {
  } };
  const fakeHost = "http://a.com";
  const router = useRouter();
  const { site, theme } = useData();
  const { base } = site.value;
  const { permalinks = {} } = theme.value;
  const permalinkKeys = Object.keys(permalinks);
  let isNavigating = false;
  let navigationTimeout = null;
  const linkCache = /* @__PURE__ */ new Map();
  router.push = (href = location.href) => {
    if (!href) throw new Error("href is undefined");
    if (isNavigating) return;
    isNavigating = true;
    if (navigationTimeout) clearTimeout(navigationTimeout);
    navigationTimeout = setTimeout(() => {
      isNavigating = false;
    }, 300);
    try {
      const { pathname, search, hash } = new URL(href, fakeHost);
      const decodePath = decodeURIComponent(pathname);
      const decodeHash = decodeURIComponent(hash);
      if (linkCache.has(decodePath)) {
        const cachedPath = linkCache.get(decodePath);
        router.go(`${cachedPath}${search}${decodeHash}`);
        return;
      }
      let permalink = permalinks.map?.[decodePath.replace(/\.html/, "")];
      if (permalink === decodePath) {
        router.go(href);
        return;
      }
      if (!permalink) {
        const docPath = matchPath(decodePath, permalinks);
        if (docPath) {
          linkCache.set(decodePath, docPath);
          href = `${docPath}${search}${decodeHash}`;
        }
      }
      router.go(href);
    } catch (error) {
      console.error("\u5BFC\u822A\u5904\u7406\u51FA\u9519:", error);
      isNavigating = false;
      router.go(href);
    }
  };
  const processUrl = (href) => {
    if (!permalinkKeys.length) return;
    const { pathname, search } = new URL(href, fakeHost);
    const decodePath = decodeURIComponent(pathname.slice(base.length || 1));
    const permalink = permalinks.map?.[decodePath.replace(/\.html/, "")];
    if (permalink === decodePath) return;
    if (permalink) {
      const debouncedReplaceState = debounce(() => {
        history.replaceState(history.state || null, "", `${permalink}${search}`);
      }, 100);
      nextTick(debouncedReplaceState);
    } else {
      const path = permalinks.inv?.[`/${decodePath}`];
      if (path) return router.push(`${path}${search}`);
    }
  };
  const preprocessLinks = () => {
    try {
      document.querySelectorAll("a").forEach((anchor) => {
        if (anchor.href && !anchor.target && !anchor.download) {
          try {
            const { pathname } = new URL(anchor.href);
            const decodedPath = decodeURIComponent(pathname);
            const docPath = matchPath(decodedPath, permalinks);
            if (docPath) {
              linkCache.set(decodedPath, docPath);
              anchor.setAttribute("data-real-path", docPath);
              anchor.addEventListener("click", (e) => {
                e.preventDefault();
                const { search, hash } = new URL(anchor.href);
                router.push(`${docPath}${search}${hash}`);
              }, { capture: true });
            }
          } catch (error) {
            console.error("\u9884\u5904\u7406\u94FE\u63A5\u65F6\u51FA\u9519:", error);
          }
        }
      });
    } catch (error) {
      console.error("\u9884\u5904\u7406\u5BFC\u822A\u94FE\u63A5\u65F6\u51FA\u9519:", error);
    }
  };
  const startWatch = () => {
    if (!permalinkKeys.length) return;
    if (inBrowser) {
      window.addEventListener("beforeunload", () => {
        try {
          const { pathname, search } = window.location;
          const decodedPath = decodeURIComponent(pathname);
          for (const [permalink, docPath] of Object.entries(permalinks.inv || {})) {
            if (decodedPath === permalink || decodedPath === permalink.replace(/\.html$/, "")) {
              history.replaceState(history.state || null, "", `${docPath}${search}`);
              break;
            }
          }
        } catch (error) {
          console.error("\u5904\u7406\u5237\u65B0\u524DURL\u65F6\u51FA\u9519:", error);
        }
      });
      preprocessLinks();
      nextTick(() => {
        try {
          if (window.location.hash) {
            const newUrl = window.location.href.split("#")[0];
            history.replaceState(history.state || null, "", newUrl);
          }
          processUrl(window.location.href);
        } catch (error) {
          console.error("\u5904\u7406\u521D\u59CB URL \u65F6\u51FA\u9519:", error);
        }
      });
    }
    const debouncedProcessUrl = debounce(processUrl, 50);
    const selfOnAfterRouteChange = router.onAfterRouteChange;
    router.onAfterRouteChange = (href) => {
      debouncedProcessUrl(href);
      selfOnAfterRouteChange?.(href);
    };
  };
  return { startWatch };
}

export { usePermalink as default };
