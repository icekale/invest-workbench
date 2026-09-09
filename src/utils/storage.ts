/**
 * localStorage 启动清理：防止长期使用后缓存与流水无限膨胀。
 * 在 main.ts 应用启动时执行一次。
 */
const WIND_CACHE_PREFIX = 'wind-cache-v1-';
const EM_DC_PREFIX = 'invest-em-dc:';
const WIND_CACHE_MAX_AGE_MS = 24 * 3600 * 1000; // 万得缓存 TTL 6h，这里给 24h 宽限后清除
const TX_MAX = 5000; // 交易流水上限（保留最新）

export function runStorageHygiene() {
  try {
    // 1. 清理过期万得 / 东财宏观缓存
    const expired: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith(WIND_CACHE_PREFIX)) {
        try {
          const raw = localStorage.getItem(k);
          if (!raw) continue;
          const cached = JSON.parse(raw) as { ts?: number };
          if (!cached?.ts || Date.now() - cached.ts > WIND_CACHE_MAX_AGE_MS) expired.push(k);
        } catch {
          expired.push(k);
        }
      } else if (k.startsWith(EM_DC_PREFIX)) {
        try {
          const raw = localStorage.getItem(k);
          if (!raw) continue;
          const cached = JSON.parse(raw) as { at?: number };
          if (!cached?.at || Date.now() - cached.at > WIND_CACHE_MAX_AGE_MS) expired.push(k);
        } catch {
          expired.push(k);
        }
      }
    }
    expired.forEach((k) => localStorage.removeItem(k));

    // 2. 交易流水上限（保留最新的 TX_MAX 条）
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('invest-v2-transactions')) continue;
      const txRaw = localStorage.getItem(k);
      if (!txRaw) continue;
      const tx = JSON.parse(txRaw) as unknown[];
      if (Array.isArray(tx) && tx.length > TX_MAX) {
        localStorage.setItem(k, JSON.stringify(tx.slice(0, TX_MAX)));
      }
    }
  } catch {
    // 清理失败不影响启动
  }
}
