/**
 * 解析钩子：让 node --experimental-strip-types 直跑 src 里的 TS 模块时
 * 支持 tsconfig 的 `@/*` → `src/*` 别名，以及无扩展名相对导入（自动补 .ts）。
 * 由 scripts/loader.mjs 通过 module.register() 挂载。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_ROOT = path.join(PROJECT_ROOT, 'src');

/** 依次尝试 base、base.ts、base/index.ts，返回第一个存在的文件路径 */
function resolveCandidate(base) {
  for (const candidate of [base, `${base}.ts`, path.join(base, 'index.ts')]) {
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      // 不存在，试下一个
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  // 1. `@/xxx` → 项目 src 下的真实路径
  if (specifier.startsWith('@/')) {
    const file = resolveCandidate(path.join(SRC_ROOT, specifier.slice(2)));
    if (file) return nextResolve(pathToFileURL(file).href, context);
  }

  // 2. TS 源文件里的无扩展名相对导入 → 自动补 .ts
  const parentPath = context.parentURL ? fileURLToPath(context.parentURL) : '';
  const inTsTree = parentPath.endsWith('.ts') && parentPath.startsWith(PROJECT_ROOT);
  if (inTsTree && (specifier.startsWith('./') || specifier.startsWith('../'))) {
    const base = path.resolve(path.dirname(parentPath), specifier);
    if (base.startsWith(SRC_ROOT)) {
      const file = resolveCandidate(base);
      if (file) return nextResolve(pathToFileURL(file).href, context);
    }
  }

  return nextResolve(specifier, context);
}
