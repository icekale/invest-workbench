/**
 * 净值曲线自检：`node --experimental-strip-types scripts/check-nav-history.ts`
 *
 * 重点是「加账户不能把旧快照读坏」和「点不够时不画假线」——两件都是静默出错的事，
 * 上线后只会表现为一张看起来正常的错图。
 */
import assert from 'node:assert/strict';

import { navCurveFor, normalizeNavSnapshots } from '../src/utils/nav-history.ts';

/* ---------- 老形状迁移：2026-09 之前的 {date, stockTotal, etfTotal} ---------- */
const legacy = normalizeNavSnapshots([
  { date: '2026-09-09', stockTotal: 511290.68, etfTotal: 485909.1 },
  { date: '2026-09-10', stockTotal: 512481.41, etfTotal: 484150.14 },
]);
assert.equal(legacy.length, 2);
assert.deepEqual(legacy[0].totals, { stock: 511290.68, etf: 485909.1 });
assert.deepEqual(legacy[1].totals, { stock: 512481.41, etf: 484150.14 });
assert.ok(!('stockTotal' in legacy[0]), '迁移后不该再留着老字段');

/* ---------- 新形状原样通过，多出来的账户不被吞 ---------- */
const fresh = normalizeNavSnapshots([{ date: '2026-09-10', totals: { stock: 100, etf: 200, grid: 300 } }]);
assert.deepEqual(fresh[0].totals, { grid: 300, stock: 100, etf: 200 });

/* ---------- 脏数据：不能把整条曲线读崩 ---------- */
assert.deepEqual(normalizeNavSnapshots(null), []);
assert.deepEqual(normalizeNavSnapshots('nope'), []);
assert.deepEqual(normalizeNavSnapshots([null, 42, {}]), [], '没有 date 的行丢掉');
assert.deepEqual(
  normalizeNavSnapshots([{ date: '2026-09-10', totals: { stock: 100, bad: 'x', nan: Number.NaN, inf: Infinity } }])[0]
    .totals,
  { stock: 100 },
  '非有限数字不能进 totals',
);

/* ---------- 排序 + 上限 ---------- */
const unsorted = normalizeNavSnapshots([
  { date: '2026-09-11', totals: { stock: 3 } },
  { date: '2026-09-09', totals: { stock: 1 } },
  { date: '2026-09-10', totals: { stock: 2 } },
]);
assert.deepEqual(
  unsorted.map((s) => s.date),
  ['2026-09-09', '2026-09-10', '2026-09-11'],
  '日期必须升序，navCurveFor 靠它定基准日',
);
const many = Array.from({ length: 500 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 0, 1 + i));
  return { date: d.toISOString().slice(0, 10), totals: { stock: i } };
});
assert.equal(normalizeNavSnapshots(many).length, 400, '只留最近 400 条');
assert.equal(normalizeNavSnapshots(many)[399].totals.stock, 499, '留下的是最新的，不是最早的');

/* ---------- 曲线基准：首个有记录的交易日 = 1 ---------- */
const two = normalizeNavSnapshots([
  { date: '2026-09-09', stockTotal: 511290.68, etfTotal: 485909.1 },
  { date: '2026-09-10', stockTotal: 512481.41, etfTotal: 484150.14 },
]);
const stockCurve = navCurveFor(two, 'stock');
assert.ok(stockCurve);
assert.equal(stockCurve.ys[0], 1, '首日必须是 1');
assert.equal(stockCurve.baseDate, '2026-09-09');
assert.equal(stockCurve.ys[1], +(512481.41 / 511290.68).toFixed(4));
assert.deepEqual(stockCurve.dates, ['09/09', '09/10']);
// ETF 仓这两天是跌的，基准也得是 1
assert.equal(navCurveFor(two, 'etf')!.ys[0], 1);
assert.ok(navCurveFor(two, 'etf')!.ys[1] < 1);

/* ---------- 点不够返回 null，不许插值凑数 ---------- */
assert.equal(navCurveFor(two, 'grid'), null, '没有该账户');
assert.equal(navCurveFor([], 'stock'), null, '一条都没有');
assert.equal(navCurveFor([two[0]], 'stock'), null, '只有一个点连不成线');

/* ---------- 中途新建的账户从自己首个有数的日期起算，不被前面的空值拉成 0 ---------- */
const midJoin = normalizeNavSnapshots([
  { date: '2026-09-01', totals: { stock: 1000, grid: 0 } },
  { date: '2026-09-02', totals: { stock: 1010 } },
  { date: '2026-09-03', totals: { stock: 1020, grid: 500 } },
  { date: '2026-09-04', totals: { stock: 1030, grid: 550 } },
]);
const gridCurve = navCurveFor(midJoin, 'grid');
assert.ok(gridCurve);
assert.deepEqual(gridCurve.dates, ['09/03', '09/04'], 'grid 从它有数的第一天起');
assert.equal(gridCurve.ys[0], 1, '新账户首个有数的日子就是它的 1，不是 0');
assert.equal(gridCurve.ys[1], +(550 / 500).toFixed(4));

console.log('check-nav-history ✓');
