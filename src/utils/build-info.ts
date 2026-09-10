/**
 * 构建信息，由 vite.config.ts 的 `define` 在构建时替换成字面量。
 *
 * `typeof` 守卫不是洁癖：scripts/ 下的检查脚本不经 Vite 转译，直接跑的话这两个
 * 标识符根本不存在 —— 裸引用会 ReferenceError，typeof 不会。
 */
export const BUILD_TIME = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : 'dev';
export const GIT_SHA = typeof __GIT_SHA__ === 'string' ? __GIT_SHA__ : 'dev';

/** 抽屉页脚那一行：`2026-09-10 09:22 · 4aca01d-dirty`。 */
export const buildLabel = `${BUILD_TIME} · ${GIT_SHA}`;
