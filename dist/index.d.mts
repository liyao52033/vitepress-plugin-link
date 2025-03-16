import { Plugin } from 'vite';

interface PermalinkOption {
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
interface Permalink {
    /**
     * key 为文件相对路径，value 为永久链接
     */
    map: Record<string, string>;
    /**
     * key 为永久链接，value 为文件相对路径
     */
    inv: Record<string, string>;
}

declare const log: (message: string, type?: string) => void;
declare function VitePluginVitePressPermalink(option?: PermalinkOption): Plugin & {
    name: string;
};

export { type Permalink, type PermalinkOption, VitePluginVitePressPermalink as default, log };
