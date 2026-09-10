import assert from 'node:assert/strict';

import { deriveValuationSignal, isoDate, realPctDelta } from '../src/utils/valuation.ts';

assert.equal(deriveValuationSignal(10).label, '偏低');
assert.equal(deriveValuationSignal(30).label, '偏低');
assert.equal(deriveValuationSignal(50).label, '中性');
assert.equal(deriveValuationSignal(70).label, '偏高');
assert.equal(deriveValuationSignal(90).label, '偏高');
assert.equal(deriveValuationSignal(10).advice, '分位偏低');

// 中证官网 tradeDate 是 YYYYMMDD，图表/缓存里统一成 YYYY-MM-DD
assert.equal(isoDate('20260909'), '2026-09-09');
assert.equal(isoDate('2026-09-09'), '2026-09-09');
assert.equal(isoDate('2026090'), '');
assert.equal(isoDate(''), '');

// 分位 0..100 的单调分布：PE 14 落在中位附近
const q = Array.from({ length: 101 }, (_, i) => 10 + i * 0.1);
const near = (a: number, b: number) => Math.abs(a - b) <= 1;

// 一个月前 PE 11（约 10 分位），现在 PE 14（约 40 分位）→ 变贵 +30
const up = realPctDelta(
  [
    { d: '2026-08-10', pe: 11 },
    { d: '2026-09-09', pe: 14 },
  ],
  q,
);
assert.ok(up, '应能算出宽基方向');
assert.equal(up.span, 30, `span 应为 30，实得 ${up.span}`);
assert.ok(near(up.from, 10), `from 应约 10，实得 ${up.from}`);
assert.ok(near(up.to, 40), `to 应约 40，实得 ${up.to}`);
assert.ok(up.delta > 0, 'PE 上行时分位应变高');

// 窗口内有多条时取最早那条：基准应是 08-10 而非中间的 09-01
const base = realPctDelta(
  [
    { d: '2026-08-10', pe: 11 },
    { d: '2026-09-01', pe: 12 },
    { d: '2026-09-09', pe: 14 },
  ],
  q,
);
assert.ok(base, '多条样本应能算出方向');
assert.equal(base.span, 30, `应取最早一条作基准（span 30），实得 ${base.span}`);
assert.ok(near(base.from, 10), `from 应来自 08-10（约 10），实得 ${base.from}`);

// 跨度不足不给方向
assert.equal(
  realPctDelta(
    [
      { d: '2026-09-05', pe: 11 },
      { d: '2026-09-09', pe: 14 },
    ],
    q,
  ),
  null,
);
// 窗口外的旧样本不当基准（超 35 天）
assert.equal(
  realPctDelta(
    [
      { d: '2026-06-01', pe: 11 },
      { d: '2026-09-09', pe: 14 },
    ],
    q,
  ),
  null,
);
// 样本不足
assert.equal(realPctDelta([{ d: '2026-09-09', pe: 14 }], q), null);
assert.equal(realPctDelta([], q), null);

console.log('check-valuation ok');
