/**
 * 净值曲线的数据层。
 *
 * 快照 = 每个交易日收盘、每个账户一条总资产。净值曲线必须从这些真快照推出来；
 * `book.ts` 里的 `sparkSeries()` 是从当前浮盈插值出来的装饰曲线，两者不能混用。
 */

import type { NavSnapshot } from '@/types/invest';

/** 只保留最近 400 个自然日，约一年半交易日。 */
const MAX_POINTS = 400;

/** 老形状的字段名 → 账户 id。2026-09 之前账户写死 stock/etf 两支。 */
const LEGACY_FIELDS: [string, string][] = [
  ['stockTotal', 'stock'],
  ['etfTotal', 'etf'],
];

/**
 * 把任意来源（SQL / 备份文件 / 没升级的设备）的快照归一化成当前形状。
 *
 * 老形状是 `{date, stockTotal, etfTotal}`。**只在这里认老形状** ——
 * `store.restoreSnapshot()` 是云端与备份文件的唯一入口，归一化放这一处，
 * 其余代码就可以假定 `totals` 一定存在。
 */
export function normalizeNavSnapshots(raw: unknown): NavSnapshot[] {
  if (!Array.isArray(raw)) return [];
  const out: NavSnapshot[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const row = r as Record<string, unknown>;
    // date 是合并去重的键（sync-merge.ts 用 `String(x.date)`），丢了这条就失去同步意义
    const date = typeof row.date === 'string' ? row.date : '';
    if (!date) continue;

    const totals: Record<string, number> = {};
    if (row.totals && typeof row.totals === 'object') {
      for (const [k, v] of Object.entries(row.totals as Record<string, unknown>)) {
        if (typeof v === 'number' && Number.isFinite(v)) totals[k] = v;
      }
    } else {
      for (const [field, acc] of LEGACY_FIELDS) {
        const v = row[field];
        if (typeof v === 'number' && Number.isFinite(v)) totals[acc] = v;
      }
    }
    out.push({ date, totals });
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out.slice(-MAX_POINTS);
}

export interface NavCurve {
  /** x 轴标签，MM/DD。 */
  dates: string[];
  /** 单位净值，首个有记录的交易日 = 1。 */
  ys: number[];
  /** 首日与首日总资产，用来在界面上如实标注曲线的起点。 */
  baseDate: string;
  baseTotal: number;
}

/** `2026-09-09` → `09/09`。 */
function mmdd(date: string) {
  return date.slice(5).replace('-', '/');
}

/**
 * 某账户的净值曲线。首个有记录的交易日 = 1。
 *
 * 中途新建的账户从它自己首个有数的日期起算（`totals` 里缺这条键的日子跳过），
 * 否则新账户会被前面那些它还不存在的日期拉成 0。
 * 少于两个点返回 null —— 一个点连不成线，界面上要如实说「还在攒」而不是画个假的。
 */
export function navCurveFor(snapshots: NavSnapshot[], accountId: string): NavCurve | null {
  const points: { date: string; total: number }[] = [];
  for (const s of snapshots) {
    const t = s.totals?.[accountId];
    // t 必须 > 0：清零的账户不能当分母
    if (typeof t === 'number' && Number.isFinite(t) && t > 0) points.push({ date: s.date, total: t });
  }
  if (points.length < 2) return null;
  const baseTotal = points[0].total;
  return {
    dates: points.map((p) => mmdd(p.date)),
    ys: points.map((p) => +(p.total / baseTotal).toFixed(4)),
    baseDate: points[0].date,
    baseTotal,
  };
}
