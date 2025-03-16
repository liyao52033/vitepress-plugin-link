'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const vue = require('vue');
const Vitepress = require('vitepress');

function _interopNamespaceCompat(e) {
  if (e && typeof e === 'object' && 'default' in e) return e;
  const n = Object.create(null);
  if (e) {
    for (const k in e) {
      n[k] = e[k];
    }
  }
  n.default = e;
  return n;
}

const Vitepress__namespace = /*#__PURE__*/_interopNamespaceCompat(Vitepress);

const { useData, useRouter } = Vitepress__namespace;
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
      vue.nextTick(() => {
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
      vue.nextTick(() => {
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

exports.default = usePermalink;
