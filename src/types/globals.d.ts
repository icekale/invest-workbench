// 通用声明

// Vue
declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<object, object, any>;
  export default component;
}

declare type ClassName = { [className: string]: any } | ClassName[] | string;

declare module '*.svg' {
  const CONTENT: string;
  export default CONTENT;
}

declare type Recordable<T = any> = Record<string, T>;

// 构建时由 vite.config.ts 的 define 注入（见 src/utils/build-info.ts）
declare const __BUILD_TIME__: string;
declare const __GIT_SHA__: string;
