# vitepress-plugin-link

## 1.4.1

### Patch Changes

- 修复在项目引用后打包失败，刷新页面直接404的问题

1、统一版本为6.2.2
```sh
npm list vitepress/vite
```
查看宿主项目与本项目依赖版本是否一致，如果发现版本不匹配，确保 package.json 里指定相同的 vitepress 版本：

2、外部依赖化vite，让宿主项目安装即可
```typescript
export default defineBuildConfig({
  entries: ["src/index", "src/usePermalink"],
  clean: true,
  declaration: true,
  rollup: {
    emitCJS: true,
    output: {
      exports: "named",
    },
  },
  externals: ["vitepress", "vue", "vite"],
});
```
3、修改vitepress导入方式
```typescript
import * as Vitepress from 'vitepress';
const { useData, useRouter } = Vitepress;
```

## 1.0.1

### Patch Changes

- 发布 npm
