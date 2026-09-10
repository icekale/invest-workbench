import { authHeader, hasSyncCreds } from './cloud-sync';

export const MARKET_TTL_MS = 6 * 3600 * 1000;
export const CATALYST_TTL_MS = 15 * 60 * 1000;
const mem = new Map<string, { exp: number; data: unknown }>();

/** 最近一次成功写入缓存的时间（键 → 毫秒）。自检表用它回答「这数据新鲜吗」。 */
const OK_KEY = 'market-last-ok-v1';

function stampOk(key: string) {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(OK_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    map[key] = Date.now();
    localStorage.setItem(OK_KEY, JSON.stringify(map));
  } catch {
    /* 记不上不影响功能，自检表少一列而已 */
  }
}

export function lastOkAt(key: string): number | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(OK_KEY);
    if (!raw) return null;
    const v = (JSON.parse(raw) as Record<string, number>)[key];
    return typeof v === 'number' ? v : null;
  } catch {
    return null;
  }
}

/**
 * 按前缀找最近一次成功时间。估值是按标的一个键存的（csidx-pe-dist-v2-sh000300-10…），
 * 只能按前缀取最新的那一个 —— 这也正好是自检表想知道的信息。
 */
export function lastOkFor(prefix: string): number | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(OK_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, number>;
    let best: number | null = null;
    for (const [k, v] of Object.entries(map)) {
      if (k.startsWith(prefix) && typeof v === 'number' && (best === null || v > best)) best = v;
    }
    return best;
  } catch {
    return null;
  }
}

/**
 * 清空内存缓存。只影响本页；服务端那份由后续的成功请求覆盖。
 * 「重取数据」按钮用它：清完内存再带 force 跑一遍 loader，写回的就是新的。
 */
export function marketClearMemory() {
  mem.clear();
}

/**
 * force=true 时内存和服务端都当没有，逼调用方真的去打上游。
 * 注意它只跳过**读**；把结果写回去仍然是调用方的事（成功才会写）。
 */
export async function marketGet<T>(key: string, ttlMs = MARKET_TTL_MS, force = false): Promise<T | null> {
  if (force) return null;
  const hit = mem.get(key);
  if (hit && Date.now() < hit.exp) return hit.data as T;
  if (!hasSyncCreds()) return null;
  try {
    const res = await fetch(`/sync/cache?k=${encodeURIComponent(key)}`, {
      headers: { Authorization: authHeader() },
    });
    if (res.status !== 200) return null;
    const data = (await res.json()) as T;
    mem.set(key, { exp: Date.now() + ttlMs, data });
    return data;
  } catch {
    return null;
  }
}

export function marketPut(key: string, data: unknown, ttlMs = MARKET_TTL_MS) {
  mem.set(key, { exp: Date.now() + ttlMs, data });
  stampOk(key);
  if (!hasSyncCreds()) return;
  void fetch(`/sync/cache?k=${encodeURIComponent(key)}&ttl=${Math.round(ttlMs / 1000)}`, {
    method: 'PUT',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).catch(() => {});
}
