// import { defineBuildConfig } from "unbuild";

// export default defineBuildConfig({
//   entries: ["src/index", "src/usePermalink"],
//   clean: true,
//   declaration: true,
//   rollup: {
//     emitCJS: true,
//     inlineDependencies: true,
//     output: {
//       exports: "named",
//     }
//   },
//   failOnWarn: false,
//   externals: ["vitepress", "vue", "vite"],
// });


import { defineBuildConfig } from "unbuild";
// 如果需要使用 nodeResolve 插件，先导入它
import nodeResolve from '@rollup/plugin-node-resolve';

export default defineBuildConfig({
  entries: ["src/index", "src/usePermalink"],
  clean: true,
  declaration: true,
  rollup: {
    emitCJS: true,
    inlineDependencies: true,
    output: {
      exports: "named",
    },
  },
  hooks: {
    // 使用 hooks 来配置 rollup 插件
    'rollup:options'(_ctx, options) {
      // 这里修改 rollup 选项
      options.plugins = options.plugins || [];
      options.plugins.push(
        nodeResolve({
          extensions: ['.js', '.ts', '.jsx', '.tsx'],
          preferBuiltins: true
        })
      );
    }
  },
  failOnWarn: false,
  externals: ["vitepress", "vue", "vite"],
});