import { authHeader, hasSyncCreds } from './cloud-sync';

const TTL_MS = 6 * 3600 * 1000;
const mem = new Map<string, { at: number; data: unknown }>();

export async function marketGet<T>(key: string): Promise<T | null> {
  const hit = mem.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data as T;
  if (!hasSyncCreds()) return null;
  try {
    const res = await fetch(`/sync/cache?k=${encodeURIComponent(key)}`, {
      headers: { Authorization: authHeader() },
    });
    if (res.status !== 200) return null;
    const data = (await res.json()) as T;
    mem.set(key, { at: Date.now(), data });
    return data;
  } catch {
    return null;
  }
}

export function marketPut(key: string, data: unknown) {
  mem.set(key, { at: Date.now(), data });
  if (!hasSyncCreds()) return;
  void fetch(`/sync/cache?k=${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).catch(() => {});
}
