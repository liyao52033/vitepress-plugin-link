# vitepress-plugin-link

这是一个适用于 `vitepress` 的 Vite 插件，在 `vitepress` 启动后读取 markdown 文档 `frontmatter` 的 `permalink`。

## ✨ Feature

- 🚀🚀 支持给 markdown 文档设置唯一的访问 **永久链接**，不再因为 markdown 文档路径移动而导致访问地址发生变化
- 🚀 读取 markdown 文档 `frontmatter` 的 `permalink`，挂载到 `themeConfig.permalinks`
- 🚀 提供 `usePermalink` hooks 函数拓展 `router` 方法，支持 `router.push(href)` 跳转到永久链接或实际的文件路径
- 🚀 支持 locales 国际化，自动给 **永久链接** 添加语言前缀，不同语言的永久链接不会重复
- 🚀 支持 rewrite 路由重写，最终得到的文档路径是 rewrite 路由重写后的路径
- 🚀 **永久链接** 支持导航栏激活高亮

## 🕯️ Install

安装 `vitepress-plugin-link` 插件

```bash
# 推荐使用 pnpm
pnpm i vitepress-plugin-link
# or yarn
yarn add vitepress-plugin-plink
# or npm
npm install vitepress-plugin-link
```

1、添加 `vitepress-plugin-link` 插件到 `.vitepress/config.ts`

```typescript
import Permalink from "vitepress-plugin-link";

export default defineConfig({
  vite: {
    plugins: [Permalink({
      path: "docs",
    })],
  },
});
```

2、在`theme/layout/MyLayout.vue`开启监听, 插件使用了onBeforeMount等方法，必须在setUp中执行。
```vue 
<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
const { Layout } = DefaultTheme
import NotFound from "../components/NotFound.vue"; // 自定义的404组件

import usePermalink from "vitepress-plugin-link/usePermalink";
usePermalink().startWatch();


 /**
   * vitepress-plugin-link 插件在 onBeforeMount 里根据自定义 URL 寻找对应的文档进行加载，但是 Vitepress 初始化页面在 ``onBeforeMount之前执行，因此需要延迟时间来等待vitepress-plugin-link` 插件执行完成，于是需要404 页面延迟加载时间，单位为毫秒
   */
onMounted(() => {
  setTimeout(() => {
    isShow.value = true
  }, 200) // 可调整延迟时间（单位：毫秒）
})
</script>

<template>
  <Layout>
    // 插入你的插槽...
   <template #not-found>
      <ClientOnly>
          <NotFound  v-if="isShow"/>
      </ClientOnly>
  </template>
  </Layout>
</template>
```

3、`.vitepress/theme/index.ts`引用新的布局

```typescript
import DefaultTheme from 'vitepress/theme'
import MyLayout from './MyLayout.vue'

export default {
  extends: DefaultTheme,
  // 使用注入插槽的包装组件覆盖 Layout
  Layout: MyLayout
}

```

> 说明：该插件仅限项目启动时生效，已改动或新添加的 markdown 需要重启项目才能生效。

插件默认忽略 `["node_modules", "dist", ".vitepress", "public"]` 目录下的文件，且只扫描 markdown 文档。

## 🛠️ Options

| name       | description                           | type       | default                        |
| ---------- | ------------------------------------- | ---------- | ------------------------------ |
| ignoreList | 忽略的文件/文件夹列表，支持正则表达式 | `string[]` | `[]`                           |
| path       | 指定扫描的根目录                      | `string`   | `vitepress` 的 `srcDir` 配置项 |

## ❗ Warning

插件的 `usePermalink` 函数使用了 `router.onAfterRouteChange` 方法，如果你也需要使用该方法，请按照下面格式进行拓展：

```typescript
import { useRouter } from "vitepress";

const router = useRouter();

const initRoute = () => {
  const selfOnAfterRouteChange = router.onAfterRouteChange;
  // 路由切换后的回调
  router.onAfterRouteChange = (href: string) => {
    // 调用可能已有的函数
    selfOnAfterRouteChange?.(href);

    // 调用自己的函数
    myFunction();
  };
};

const myFunction = () => {
  /* */
};
```

假设项目的目录结构如下：

```text
.
├─ docs                # 项目根目录
│  ├─ guide
│  │  └─ api.md
```

`api.md` 内容如下：

```yaml
---
permalink: /guide-api
---
```

- 访问 `/guide/api.html` 可以进入文档页面，这是 vitepress 的自带功能。**如果文件路径发生改变，访问链接也随着改变**
- 访问 `/guide-api` 可以进入文档页面，这是插件的实现功能。**不会随着文件路径变化而改变**

永久链接是唯一的，如果出现两个一样的永久链接，则后面的永久链接覆盖前面的，但不影响 vitepress 自带访问路径。

如果永久链接不生效，代表 `usePermalink().startWatch()` 并没有被执行，请在注册 vitepress 或者任意主题前加载该函数，如何注册请看 ([扩展默认主题 | VitePress](https://vitepress.dev/zh/guide/extending-default-theme#layout-slots))

## 📘 TypeScript

### 🛠️ Options

```typescript
export interface PermalinkOption {
  /**
   * 忽略的文件/文件夹列表，支持正则表达式
   *
   * @default []
   */
  ignoreList?: Array<RegExp | string>;
  /**
   * 文章所在的目录，基于 package.json 所在目录，开头不需要有 /
   * @default 'vitepress 的 srcDir 配置项'
   */
  path?: string;
}
```

