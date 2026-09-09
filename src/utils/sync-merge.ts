/** 三方合并：ancestor / local / remote。冲突留本地。 */

export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export function same(a: unknown, b: unknown): boolean {
  if (a === undefined && b === undefined) return true;
  if (a === undefined || b === undefined) return false;
  return stableStringify(a) === stableStringify(b);
}

export function mergeScalar<T>(base: T | undefined, local: T | undefined, remote: T | undefined): T | undefined {
  if (same(local, remote)) return local;
  if (same(local, base)) return remote;
  if (same(remote, base)) return local;
  return local !== undefined ? local : remote;
}

export interface MergeConflict {
  table: string;
  key: string;
}

export function mergeByKey<T>(
  table: string,
  base: T[],
  local: T[],
  remote: T[],
  keyOf: (row: T) => string,
): { items: T[]; conflicts: MergeConflict[] } {
  const bMap = indexBy(base, keyOf);
  const lMap = indexBy(local, keyOf);
  const rMap = indexBy(remote, keyOf);
  const keys = new Set([...bMap.keys(), ...lMap.keys(), ...rMap.keys()]);
  const items: T[] = [];
  const conflicts: MergeConflict[] = [];
  for (const key of keys) {
    const b = bMap.get(key);
    const l = lMap.get(key);
    const r = rMap.get(key);
    if (same(l, r)) {
      if (l !== undefined) items.push(l);
      continue;
    }
    if (same(l, b)) {
      if (r !== undefined) items.push(r);
      continue;
    }
    if (same(r, b)) {
      if (l !== undefined) items.push(l);
      continue;
    }
    conflicts.push({ table, key });
    // ponytail: 冲突留本地；要远程优先或弹窗三选一时再改
    if (l !== undefined) items.push(l);
    else if (r !== undefined) items.push(r);
  }
  return { items, conflicts };
}

function indexBy<T>(rows: T[], keyOf: (row: T) => string): Map<string, T> {
  const m = new Map<string, T>();
  for (const row of rows) {
    const k = keyOf(row);
    if (k) m.set(k, row);
  }
  return m;
}

export interface HoldingSlim {
  account: string;
  code: string;
  name: string;
  quantity: number;
  cost: number;
  tag?: string;
  health: string;
  action: string;
  thesisId: string;
}

export function slimHolding(h: Record<string, unknown>): HoldingSlim {
  return {
    account: String(h.account || ''),
    code: String(h.code || ''),
    name: String(h.name || ''),
    quantity: Number(h.quantity || 0),
    cost: Number(h.cost || 0),
    tag: h.tag == null ? undefined : String(h.tag),
    health: String(h.health || 'healthy'),
    action: String(h.action || 'hold'),
    thesisId: String(h.thesisId || ''),
  };
}

export interface BookSnap {
  updatedAt?: number;
  holdings?: HoldingSlim[] | Record<string, unknown>[];
  cash?: { stock?: number; etf?: number };
  transactions?: { id: string; [k: string]: unknown }[];
  todos?: { id: string; [k: string]: unknown }[];
  theses?: { id: string; [k: string]: unknown }[];
  journal?: { id: string; [k: string]: unknown }[];
  opportunities?: { id: string; [k: string]: unknown }[];
  watchlist?: string[];
  customPortfolios?: { id: string; [k: string]: unknown }[];
  navSnapshots?: { date: string; [k: string]: unknown }[];
  prefs?: Record<string, unknown>;
  macroWeather?: Record<string, unknown>;
  macroIndicators?: { id: string; [k: string]: unknown }[];
  macroBriefs?: { id: string; [k: string]: unknown }[];
  macroEvents?: { id: string; [k: string]: unknown }[];
  industryFocus?: { id: string; [k: string]: unknown }[];
  [k: string]: unknown;
}

const PREF_SKIP = new Set(['updatedAt', 'lastCloudSyncAt']);

export function emptySnap(): BookSnap {
  return {
    holdings: [],
    cash: { stock: 0, etf: 0 },
    transactions: [],
    todos: [],
    theses: [],
    journal: [],
    opportunities: [],
    watchlist: [],
    customPortfolios: [],
    navSnapshots: [],
    prefs: {},
    macroIndicators: [],
    macroBriefs: [],
    macroEvents: [],
    industryFocus: [],
  };
}

export function slimSnap(data: BookSnap): BookSnap {
  const holdings = Array.isArray(data.holdings)
    ? data.holdings.map((h) => slimHolding(h as Record<string, unknown>))
    : [];
  const { quotes: _q, at: _at, version: _v, ...rest } = data;
  return { ...rest, holdings };
}

export function threeWaySnapshot(
  base: BookSnap,
  local: BookSnap,
  remote: BookSnap,
): { merged: BookSnap; conflicts: MergeConflict[] } {
  const b = { ...emptySnap(), ...base };
  const l = { ...emptySnap(), ...local };
  const r = { ...emptySnap(), ...remote };
  const conflicts: MergeConflict[] = [];
  const take = <T>(table: string, keyOf: (row: T) => string, src: { b: T[]; l: T[]; r: T[] }) => {
    const out = mergeByKey(table, src.b, src.l, src.r, keyOf);
    conflicts.push(...out.conflicts);
    return out.items;
  };

  const holdings = take('holdings', (h) => `${(h as HoldingSlim).account}:${(h as HoldingSlim).code}`, {
    b: (b.holdings || []) as HoldingSlim[],
    l: (l.holdings || []) as HoldingSlim[],
    r: (r.holdings || []) as HoldingSlim[],
  });
  const transactions = take('transactions', (x) => String(x.id), {
    b: b.transactions || [],
    l: l.transactions || [],
    r: r.transactions || [],
  });
  const todos = take('todos', (x) => String(x.id), {
    b: b.todos || [],
    l: l.todos || [],
    r: r.todos || [],
  });
  const theses = take('theses', (x) => String(x.id), {
    b: b.theses || [],
    l: l.theses || [],
    r: r.theses || [],
  });
  const journal = take('journal', (x) => String(x.id), {
    b: b.journal || [],
    l: l.journal || [],
    r: r.journal || [],
  });
  const opportunities = take('opportunities', (x) => String(x.id), {
    b: b.opportunities || [],
    l: l.opportunities || [],
    r: r.opportunities || [],
  });
  const customPortfolios = take('customPortfolios', (x) => String(x.id), {
    b: b.customPortfolios || [],
    l: l.customPortfolios || [],
    r: r.customPortfolios || [],
  });
  const navSnapshots = take('navSnapshots', (x) => String(x.date), {
    b: b.navSnapshots || [],
    l: l.navSnapshots || [],
    r: r.navSnapshots || [],
  });
  const macroIndicators = take('macroIndicators', (x) => String(x.id), {
    b: b.macroIndicators || [],
    l: l.macroIndicators || [],
    r: r.macroIndicators || [],
  });
  const macroBriefs = take('macroBriefs', (x) => String(x.id), {
    b: b.macroBriefs || [],
    l: l.macroBriefs || [],
    r: r.macroBriefs || [],
  });
  const macroEvents = take('macroEvents', (x) => String(x.id), {
    b: b.macroEvents || [],
    l: l.macroEvents || [],
    r: r.macroEvents || [],
  });
  const industryFocus = take('industryFocus', (x) => String(x.id), {
    b: b.industryFocus || [],
    l: l.industryFocus || [],
    r: r.industryFocus || [],
  });

  const watchAs = (xs: string[] | undefined) => (xs || []).map((id) => ({ id }));
  const watchMerged = mergeByKey(
    'watchlist',
    watchAs(b.watchlist),
    watchAs(l.watchlist),
    watchAs(r.watchlist),
    (x) => x.id,
  );
  conflicts.push(...watchMerged.conflicts);

  const prefs: Record<string, unknown> = {};
  const prefKeys = new Set([
    ...Object.keys(b.prefs || {}),
    ...Object.keys(l.prefs || {}),
    ...Object.keys(r.prefs || {}),
  ]);
  for (const k of prefKeys) {
    if (PREF_SKIP.has(k)) continue;
    const v = mergeScalar((b.prefs || {})[k], (l.prefs || {})[k], (r.prefs || {})[k]);
    if (v !== undefined) prefs[k] = v;
  }

  const cash = {
    stock: Number(mergeScalar(b.cash?.stock, l.cash?.stock, r.cash?.stock) ?? 0),
    etf: Number(mergeScalar(b.cash?.etf, l.cash?.etf, r.cash?.etf) ?? 0),
  };

  const merged: BookSnap = {
    holdings,
    cash,
    transactions,
    todos,
    theses,
    journal,
    opportunities,
    watchlist: watchMerged.items.map((x) => x.id),
    customPortfolios,
    navSnapshots,
    prefs,
    macroWeather: (mergeScalar(b.macroWeather, l.macroWeather, r.macroWeather) || {}) as Record<string, unknown>,
    macroIndicators,
    macroBriefs,
    macroEvents,
    industryFocus,
  };
  return { merged, conflicts };
}
