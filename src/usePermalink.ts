// 导入部分保持不变
import { nextTick } from "vue";
import * as Vitepress from 'vitepress';

const { useData, useRouter } = Vitepress;
const inBrowser = typeof window !== "undefined";

// 添加一个简单的防抖函数
function debounce(fn: Function, delay: number) {
  let timer: number | null = null;
  return (...args: any[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, delay) as unknown as number;
  };
}

// 添加一个路径匹配函数，提高匹配精度
function matchPath(path: string, permalinks: any) {
  // 尝试直接匹配
  if (permalinks.inv[path]) {
    return permalinks.inv[path];
  }
  
  // 尝试多种变体
  const variations = [
    path.endsWith('/') ? path.slice(0, -1) : `${path}/`,
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

export default function usePermalink() {
  if (!inBrowser) return { startWatch: () => { } }; // SSR 期间不执行

  const fakeHost = "http://a.com";
  const router = useRouter();
  const { site, theme } = useData();
  const { base } = site.value;
  const { permalinks = {} } = theme.value;
  const permalinkKeys = Object.keys(permalinks);

  // 添加导航状态跟踪
  let isNavigating = false;
  let navigationTimeout: number | null = null;
  
  // 添加链接预处理缓存
  const linkCache = new Map();

  /**
   * 兼容 SSR，确保 push 方法只在浏览器环境生效
   */
  router.push = (href = location.href) => {
    if (!href) throw new Error("href is undefined");
    
    // 如果正在导航中，则忽略此次请求
    if (isNavigating) return;
    
    // 设置导航状态
    isNavigating = true;
    
    // 设置超时，确保导航状态最终会被重置
    if (navigationTimeout) clearTimeout(navigationTimeout);
    navigationTimeout = setTimeout(() => {
      isNavigating = false;
    }, 300) as unknown as number;

    try {
      const { pathname, search, hash } = new URL(href, fakeHost);
      // 解码，支持中文
      const decodePath = decodeURIComponent(pathname);
      const decodeHash = decodeURIComponent(hash);
      
      // 检查缓存
      if (linkCache.has(decodePath)) {
        const cachedPath = linkCache.get(decodePath);
        router.go(`${cachedPath}${search}${decodeHash}`);
        return;
      }
      
      // 根据 decodePath 找 permalink
      let permalink = permalinks.map?.[decodePath.replace(/\.html/, "")];
      
      // 如果当前 pathname 和 permalink 相同，则直接跳转
      if (permalink === decodePath) {
        router.go(href);
        return;
      }
      
      if (!permalink) {
        // 使用增强的路径匹配
        const docPath = matchPath(decodePath, permalinks);
        if (docPath) {
          // 缓存结果
          linkCache.set(decodePath, docPath);
          href = `${docPath}${search}${decodeHash}`;
        }
      }
      
      // 执行 vitepress 的 go 方法进行跳转
      router.go(href);
    } catch (error) {
      console.error('导航处理出错:', error);
      isNavigating = false;
      router.go(href); // 出错时仍尝试导航
    }
  };

  /**
   * 处理 URL 跳转
   */
  const processUrl = (href: string) => {
    if (!permalinkKeys.length) return;

    const { pathname, search } = new URL(href, fakeHost);
    const decodePath = decodeURIComponent(pathname.slice(base.length || 1));
    // 不再使用hash部分
    const permalink = permalinks.map?.[decodePath.replace(/\.html/, "")];
  
    if (permalink === decodePath) return;
  
    if (permalink) {
      // 使用防抖处理 history.replaceState，不包含hash部分
      const debouncedReplaceState = debounce(() => {
        history.replaceState(history.state || null, "", `${permalink}${search}`);
      }, 100);
      
      nextTick(debouncedReplaceState);
    } else {
      const path = permalinks.inv?.[`/${decodePath}`];
      if (path) return router.push(`${path}${search}`); // 不包含hash部分
    }
  };

  /**
   * 预处理所有导航链接
   */
  const preprocessLinks = () => {
    try {
      document.querySelectorAll('a').forEach(anchor => {
        if (anchor.href && !anchor.target && !anchor.download) {
          try {
            const { pathname } = new URL(anchor.href);
            const decodedPath = decodeURIComponent(pathname);
            
            // 使用增强的路径匹配
            const docPath = matchPath(decodedPath, permalinks);
            if (docPath) {
              // 缓存结果
              linkCache.set(decodedPath, docPath);
              // 为链接添加自定义属性，存储实际文档路径
              anchor.setAttribute('data-real-path', docPath);
              
              // 修改链接的点击行为
              anchor.addEventListener('click', (e) => {
                e.preventDefault();
                const { search, hash } = new URL(anchor.href);
                router.push(`${docPath}${search}${hash}`);
              }, { capture: true });
            }
          } catch (error) {
            console.error('预处理链接时出错:', error);
          }
        }
      });
    } catch (error) {
      console.error('预处理导航链接时出错:', error);
    }
  };

  /**
   * 监听路由变化
   */
  const startWatch = () => {
    if (!permalinkKeys.length) return;
  
    if (inBrowser) {
      // 添加页面刷新前的处理
      window.addEventListener('beforeunload', () => {
        try {
          const { pathname, search } = window.location;
          const decodedPath = decodeURIComponent(pathname);
          
          // 检查当前URL是否为permalink
          for (const [permalink, docPath] of Object.entries(permalinks.inv || {})) {
            if (decodedPath === permalink || decodedPath === permalink.replace(/\.html$/, "")) {
              // 如果是permalink，则在刷新前将URL替换为实际文档路径
              // 这样刷新后服务器就能找到正确的文件
              history.replaceState(history.state || null, "", `${docPath}${search}`);
              break;
            }
          }
        } catch (error) {
          console.error('处理刷新前URL时出错:', error);
        }
      });
      
      // Call preprocessLinks function to fix the unused variable error
      preprocessLinks();
      
      // 使用 nextTick 确保在 DOM 更新后处理 URL
      nextTick(() => {
        try {
          // 移除URL中的hash部分
          if (window.location.hash) {
            const newUrl = window.location.href.split('#')[0];
            history.replaceState(history.state || null, "", newUrl);
          }
          processUrl(window.location.href);
        } catch (error) {
          console.error('处理初始 URL 时出错:', error);
        }
      });
    }

    // 使用防抖处理路由变化
    const debouncedProcessUrl = debounce(processUrl, 50);
    
    const selfOnAfterRouteChange = router.onAfterRouteChange;
    router.onAfterRouteChange = (href: string) => {
      debouncedProcessUrl(href);
      selfOnAfterRouteChange?.(href);
    };
  };

  return { startWatch };
}