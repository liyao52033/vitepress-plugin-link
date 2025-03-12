/// <reference types="vitepress" />

declare module "vitepress" {
  interface Router {
    push: (href?: string, isPermalink?: boolean) => void;
  }
}

export {};
