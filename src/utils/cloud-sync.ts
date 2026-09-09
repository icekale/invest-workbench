/** 同源 /sync → VPS SQLite。浏览器 localStorage 只是缓存。 */

export type SyncAction = 'push' | 'pull' | 'noop';

const user = import.meta.env?.VITE_AUTH_USER || 'xiong';
const pass = import.meta.env?.VITE_AUTH_PASS || 'demo';

function authHeader(): string {
  return `Basic ${btoa(`${user}:${pass}`)}`;
}

export function pickSyncAction(localAt: number, remoteAt: number | null): SyncAction {
  if (remoteAt == null) return 'push';
  if (remoteAt > localAt) return 'pull';
  if (localAt > remoteAt) return 'push';
  return 'noop';
}

export interface CloudSnapshot {
  updatedAt?: number;
  at?: string;
  holdings?: unknown[];
  cash?: unknown;
  [k: string]: unknown;
}

interface SyncStore {
  prefs: { updatedAt?: number; lastCloudSyncAt?: number; lastBackupAt?: number };
  snapshot: () => CloudSnapshot;
  restoreSnapshot: (data: CloudSnapshot) => { success: boolean; message: string };
  setPref: (key: 'lastCloudSyncAt' | 'updatedAt' | 'lastBackupAt', value: number) => void;
}

let hydrating = false;
let timer = 0;
let storeRef: SyncStore | null = null;
let pending: Promise<SyncAction | 'offline'> | null = null;

export function setHydrating(v: boolean) {
  hydrating = v;
}

export async function pullCloudSnapshot(): Promise<CloudSnapshot | null> {
  const res = await fetch('/sync', { headers: { Authorization: authHeader() } });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`sync pull ${res.status}`);
  return res.json();
}

export async function pushCloudSnapshot(data: CloudSnapshot): Promise<void> {
  const { quotes: _q, ...rest } = data;
  const res = await fetch('/sync', {
    method: 'PUT',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(rest),
  });
  if (!res.ok) throw new Error(`sync push ${res.status}`);
}

export function scheduleCloudPush() {
  if (hydrating || !storeRef || typeof window === 'undefined') return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    void flushPush();
  }, 1500);
}

async function flushPush() {
  if (!storeRef || hydrating) return;
  const snap = storeRef.snapshot();
  const now = Date.now();
  snap.updatedAt = now;
  try {
    await pushCloudSnapshot(snap);
    storeRef.setPref('updatedAt', now);
    storeRef.setPref('lastCloudSyncAt', now);
  } catch {
    // ponytail: offline keeps localStorage; retry on next edit
  }
}

export async function hydrateFromCloud(store: SyncStore): Promise<SyncAction | 'offline'> {
  setHydrating(true);
  try {
    const remote = await pullCloudSnapshot();
    const localAt = store.prefs.updatedAt || 0;
    const remoteAt = remote ? Number(remote.updatedAt || Date.parse(String(remote.at || '')) || 0) : null;
    const action = pickSyncAction(localAt, remoteAt && remoteAt > 0 ? remoteAt : remote ? 1 : null);
    if (action === 'pull' && remote) {
      store.restoreSnapshot(remote);
      const ts = Number(remote.updatedAt || Date.now());
      store.setPref('updatedAt', ts);
      store.setPref('lastCloudSyncAt', Date.now());
    } else if (action === 'push') {
      const now = Date.now();
      const snap = store.snapshot();
      snap.updatedAt = now;
      await pushCloudSnapshot(snap);
      store.setPref('updatedAt', now);
      store.setPref('lastCloudSyncAt', now);
    } else if (action === 'noop') {
      store.setPref('lastCloudSyncAt', Date.now());
    }
    return action;
  } catch {
    return 'offline';
  } finally {
    setHydrating(false);
  }
}

export function bindCloudSync(store: SyncStore): Promise<SyncAction | 'offline'> {
  storeRef = store;
  if (!pending) pending = hydrateFromCloud(store);
  return pending;
}
