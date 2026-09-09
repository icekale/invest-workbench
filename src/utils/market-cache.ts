import { authHeader, hasSyncCreds } from './cloud-sync';

export const MARKET_TTL_MS = 6 * 3600 * 1000;
export const CATALYST_TTL_MS = 15 * 60 * 1000;
const mem = new Map<string, { exp: number; data: unknown }>();

export async function marketGet<T>(key: string, ttlMs = MARKET_TTL_MS): Promise<T | null> {
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
  if (!hasSyncCreds()) return;
  void fetch(`/sync/cache?k=${encodeURIComponent(key)}&ttl=${Math.round(ttlMs / 1000)}`, {
    method: 'PUT',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).catch(() => {});
}
