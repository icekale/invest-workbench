/**
 * 估值分位历史：每天把当日各标的分位存一份，攒起来就能看出分位在往上还是往下。
 *
 * 只看分位绝对值会漏掉方向 —— 35% 分位可能是从 60% 一路跌下来的（下跌中继，还得等），
 * 也可能是从 20% 涨上来的（反转启动，已经错过一段）。这两种情况操作相反，
 * 而单看「35%」完全区分不出来。
 *
 * 没有外部数据源可依赖，所以纯自积累：快照写服务端缓存（跨设备）+ localStorage（未登录也能用），
 * 两边取并集，越跑越准。
 */
import { marketGet, marketPut } from './market-cache.ts';

export interface PctPoint {
  /** YYYY-MM-DD */
  d: string;
  /** 当日 PE 分位 0~100 */
  p: number;
}

export type PctHistory = Record<string, PctPoint[]>;

export const PCT_HISTORY_KEY = 'val-pct-history-v1';

/** 每标的保留最近 60 个快照日（够算 1~3 个月） */
const MAX_POINTS = 60;
/** 「近1月」的回看窗口（自然日） */
const LOOKBACK_DAYS = 35;
/** 历史短于这么久就不给方向，免得把两天的噪声当趋势 */
export const MIN_SPAN_DAYS = 10;

export interface PctDelta {
  /** 实际跨了多少自然日 */
  span: number;
  /** 分位变化（正 = 变贵） */
  delta: number;
  from: number;
  to: number;
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00+08:00`);
  const b = Date.parse(`${to}T00:00:00+08:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86400000);
}

function localStore(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function mergeHistory(a: PctHistory, b: PctHistory): PctHistory {
  const out: PctHistory = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const byDay = new Map<string, number>();
    for (const pt of [...(a[key] ?? []), ...(b[key] ?? [])]) {
      if (pt && typeof pt.d === 'string' && Number.isFinite(pt.p)) byDay.set(pt.d, pt.p);
    }
    out[key] = [...byDay.entries()]
      .sort((x, y) => x[0].localeCompare(y[0]))
      .slice(-MAX_POINTS)
      .map(([d, p]) => ({ d, p }));
  }
  return out;
}

export function readLocalHistory(): PctHistory {
  const ls = localStore();
  if (!ls) return {};
  try {
    const raw = ls.getItem(PCT_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? (parsed as PctHistory) : {};
  } catch {
    return {};
  }
}

function writeLocalHistory(h: PctHistory) {
  const ls = localStore();
  if (!ls) return;
  try {
    ls.setItem(PCT_HISTORY_KEY, JSON.stringify(h));
  } catch {
    /* 配额满/隐私模式：服务端那份还在，忽略 */
  }
}

/** 写入当日快照（同名同一天覆盖，不重复追加）。 */
export function stampSnapshot(
  history: PctHistory,
  day: string,
  items: Array<{ name: string; pePercentile: number }>,
): PctHistory {
  const next: PctHistory = { ...history };
  for (const it of items) {
    if (!it?.name || !Number.isFinite(it.pePercentile)) continue;
    const pts = (next[it.name] ?? []).filter((pt) => pt.d !== day);
    pts.push({ d: day, p: it.pePercentile });
    next[it.name] = pts.sort((a, b) => a.d.localeCompare(b.d)).slice(-MAX_POINTS);
  }
  return next;
}

/**
 * 某个标的距今日最近的「分位变化」。
 * 取回看窗口内最早的一条做基准，历史不足 MIN_SPAN_DAYS 返回 null（宁可不显示也不编）。
 */
export function pctDeltaOf(
  history: PctHistory,
  name: string,
  today: string,
  lookback = LOOKBACK_DAYS,
  minSpan = MIN_SPAN_DAYS,
): PctDelta | null {
  const pts = (history[name] ?? []).filter((pt) => pt.d <= today);
  if (pts.length < 2) return null;
  const now = pts[pts.length - 1];
  let base: PctPoint | null = null;
  for (const pt of pts) {
    if (daysBetween(pt.d, today) <= lookback) {
      base = pt;
      break; // 升序，第一条就是窗口内最早的
    }
  }
  if (!base || base.d === now.d) return null;
  const span = daysBetween(base.d, today);
  if (span < minSpan) return null;
  return { span, delta: now.p - base.p, from: base.p, to: now.p };
}

/** 给一组标的名称算出方向表，键为名称。 */
export function deltasFor(history: PctHistory, today: string, names: string[]): Record<string, PctDelta> {
  const out: Record<string, PctDelta> = {};
  for (const name of names) {
    const d = pctDeltaOf(history, name, today);
    if (d) out[name] = d;
  }
  return out;
}

/** 只读历史（服务端优先，合并本地）。 */
export async function loadPctHistory(): Promise<PctHistory> {
  const remote = await marketGet<PctHistory>(PCT_HISTORY_KEY).catch(() => null);
  return mergeHistory(readLocalHistory(), remote ?? {});
}

/** 记一份当日快照并返回历史全量。失败不抛，不阻塞估值主流程。 */
export async function recordPctSnapshot(
  day: string,
  items: Array<{ name: string; pePercentile: number }>,
): Promise<PctHistory> {
  const remote = await marketGet<PctHistory>(PCT_HISTORY_KEY).catch(() => null);
  const next = stampSnapshot(mergeHistory(readLocalHistory(), remote ?? {}), day, items);
  writeLocalHistory(next);
  marketPut(PCT_HISTORY_KEY, next);
  return next;
}
