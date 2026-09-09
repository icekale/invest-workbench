/** 同源 /sync → VPS SQLite。账本只信 SQL，浏览器不落盘。 */

import type { BookSnap } from './sync-merge';
import { same, slimSnap } from './sync-merge';

export type SyncAction = 'push' | 'pull' | 'noop';
export type CloudSnapshot = BookSnap;

interface SyncStore {
  prefs: { updatedAt?: number; lastCloudSyncAt?: number; lastBackupAt?: number };
  snapshot: () => CloudSnapshot;
  restoreSnapshot: (data: CloudSnapshot) => { success: boolean; message: string };
  setPref: (key: 'lastCloudSyncAt' | 'updatedAt' | 'lastBackupAt', value: number) => void;
}

let hydrating = false;
let sqlReady = false;
let timer = 0;
let storeRef: SyncStore | null = null;
let pending: Promise<SyncAction | 'offline'> | null = null;
let creds = { user: '', pass: '' };

export function parseBasic(token: string): { user: string; pass: string } | null {
  if (!token || !token.startsWith('Basic ')) return null;
  try {
    const raw = atob(token.slice(6));
    const i = raw.indexOf(':');
    if (i < 0) return null;
    return { user: raw.slice(0, i), pass: raw.slice(i + 1) };
  } catch {
    return null;
  }
}

export function basicToken(user: string, pass: string): string {
  return `Basic ${btoa(`${user}:${pass}`)}`;
}

export function setSyncCreds(user: string, pass: string) {
  creds = { user, pass };
  pending = null;
  sqlReady = false;
}

export function hasSyncCreds() {
  return Boolean(creds.user && creds.pass);
}

export function authHeader(): string {
  return basicToken(creds.user, creds.pass);
}

export function setHydrating(v: boolean) {
  hydrating = v;
}

// ponytail: 8s ceiling; hung CF/Caddy looked like dead login
const SYNC_MS = 8000;
function syncFetch(input: string, init: RequestInit = {}) {
  return fetch(input, { ...init, signal: AbortSignal.timeout(SYNC_MS) });
}

export async function pullCloudSnapshot(): Promise<CloudSnapshot | null> {
  const res = await syncFetch('/sync', { headers: { Authorization: authHeader() } });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`sync pull ${res.status}`);
  return res.json();
}

export async function pushCloudSnapshot(data: CloudSnapshot): Promise<void> {
  const slim = slimSnap(data);
  const res = await syncFetch('/sync', {
    method: 'PUT',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(slim),
  });
  if (!res.ok) throw new Error(`sync push ${res.status}`);
}

export function scheduleCloudPush() {
  // ponytail: no offline book cache; skip push until SQL hydrate succeeds so empty memory cannot wipe the db
  if (hydrating || !sqlReady || !storeRef || !creds.user || typeof window === 'undefined') return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    void flushPush();
  }, 1500);
}

async function flushPush() {
  if (!storeRef || hydrating || !creds.user) return;
  const snap = slimSnap(storeRef.snapshot());
  const now = Date.now();
  snap.updatedAt = now;
  try {
    await pushCloudSnapshot(snap);
    storeRef.setPref('updatedAt', now);
    storeRef.setPref('lastCloudSyncAt', now);
  } catch {
    // ponytail: retry on next edit; unsynced session is lost on refresh
  }
}

function comparable(s: BookSnap): BookSnap {
  const slim = slimSnap(s);
  const prefs = { ...(slim.prefs || {}) };
  delete prefs.updatedAt;
  delete prefs.lastCloudSyncAt;
  delete prefs.lastBackupAt;
  const { updatedAt: _u, at: _a, quotes: _q, version: _v, ...rest } = slim;
  return { ...rest, prefs };
}

export async function hydrateFromCloud(store: SyncStore): Promise<SyncAction | 'offline'> {
  if (!creds.user) return 'offline';
  setHydrating(true);
  try {
    const remoteRaw = await pullCloudSnapshot();
    const now = Date.now();
    if (remoteRaw) {
      const local = slimSnap(store.snapshot());
      const remote = slimSnap(remoteRaw);
      const changed = !same(comparable(local), comparable(remote));
      if (changed) store.restoreSnapshot(remote);
      sqlReady = true;
      store.setPref('updatedAt', remote.updatedAt || now);
      store.setPref('lastCloudSyncAt', now);
      return changed ? 'pull' : 'noop';
    }
    sqlReady = true;
    await pushCloudSnapshot(slimSnap(store.snapshot()));
    store.setPref('updatedAt', now);
    store.setPref('lastCloudSyncAt', now);
    return 'push';
  } catch {
    sqlReady = false;
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

export async function loginAgainstSync(account: string, password: string): Promise<void> {
  const header = basicToken(account, password);
  let res: Response;
  try {
    res = await syncFetch('/sync', { headers: { Authorization: header } });
  } catch {
    const envUser = import.meta.env?.VITE_AUTH_USER || 'xiong';
    const envPass = import.meta.env?.VITE_AUTH_PASS || 'demo';
    if (account === envUser && password === envPass) {
      setSyncCreds(account, password);
      return;
    }
    throw new Error('无法连接同步服务');
  }
  if (res.status === 401) throw new Error('账号或密码错误');
  if (res.status !== 200 && res.status !== 204) throw new Error(`登录失败 ${res.status}`);
  setSyncCreds(account, password);
}

export async function registerAccount(account: string, password: string) {
  const res = await syncFetch('/sync/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: account, password }),
  });
  if (res.status === 409) throw new Error('账号已存在');
  if (res.status === 400) throw new Error('账号须为字母数字 ._-，密码至少 4 位');
  if (!res.ok) throw new Error(`注册失败 ${res.status}`);
}
