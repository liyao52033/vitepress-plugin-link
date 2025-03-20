import { nextTick } from "vue";
import * as Vitepress from 'vitepress';

const { useData, useRouter } = Vitepress;
const inBrowser = typeof window !== "undefined";

// 添加一个标志，确保只注册一次事件监听器
let isWatchStarted = false;


function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, delay);
  };

  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return debounced;
}


export default function usePermalink() {
  if (!inBrowser) return { startWatch: () => { } }; // SSR 期间不执行

  const fakeHost = "http://localhost:5173/";
  const router = useRouter();
  const { site, theme } = useData();
  const { base } = site.value;
  const { permalinks = {} } = theme.value;
  const permalinkKeys = Object.keys(permalinks);

  // 添加上次处理的URL记录，避免重复处理
  let lastProcessedUrl = '';
  
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

    console.log("跳转路由：",href)

    // 确保页面加载完成后执行跳转
    nextTick(() => {
      router.go(href);
    });

  };

  /**
   * 处理 URL 跳转
   */
  const processUrl = (href: string) => {
    if (!permalinkKeys.length) return;

    // 避免处理相同的URL
    if (lastProcessedUrl === href) return;
    lastProcessedUrl = href;

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
      console.log("permalink:", `${path}${search}${decodeHash}`)
      if (path) return router.push(`${path}${search}${decodeHash}`);
    }
  };

  
  /**
   * 监听路由变化
   * 
   * 导航栏链接点击后 processUrl 函数被多次调用的原因可能有以下几点：
   *
   *  1. 路由事件触发多次 ：VitePress 的路由系统在导航过程中可能会触发多次 onAfterRouteChange 事件。
   *  2. 事件监听器重复注册 ：每次调用 startWatch 函数时，都会重新注册 onAfterRouteChange 事件处理器，但没有移除之前的处理器。
   * 3. 组件重新挂载 ：如果包含 usePermalink 的组件被多次挂载或重新渲染，会导致多个事件监听器被注册。
   */
  const startWatch = () => {
    if (!permalinkKeys.length) return;

    // 确保只注册一次事件监听器
    if (isWatchStarted) return;
    isWatchStarted = true;


    // 在这里添加初始化处理
    if (inBrowser) {
      // 使用 nextTick 确保在 DOM 更新后处理 URL
      nextTick(() => {
        processUrl(window.location.href);
      });
    }

    // 使用防抖处理路由变化
    const debouncedProcessUrl = debounce(processUrl, 300);

    const selfOnAfterRouteChange = router.onAfterRouteChange;
    router.onAfterRouteChange = (href: string) => {
      debouncedProcessUrl(href);
      selfOnAfterRouteChange?.(href);
    }; 
  };


  return { startWatch };
}