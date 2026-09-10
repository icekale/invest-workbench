import assert from 'node:assert/strict';

import type { PctHistory } from '../src/utils/val-history.ts';
import { deltasFor, mergeHistory, pctDeltaOf, stampSnapshot } from '../src/utils/val-history.ts';

const TODAY = '2026-09-09';

// 三次快照：08-10 -> 08-20 -> 09-09。08-20 的值刻意与端点都不同，
// 用来验证基准取的是「窗口内最早」而不是「最近一条」。
let h: PctHistory = {};
h = stampSnapshot(h, '2026-08-10', [
  { name: '农林牧渔', pePercentile: 55 },
  { name: '银行', pePercentile: 72 },
]);
h = stampSnapshot(h, '2026-08-20', [
  { name: '农林牧渔', pePercentile: 45 },
  { name: '银行', pePercentile: 74 },
]);
h = stampSnapshot(h, TODAY, [
  { name: '农林牧渔', pePercentile: 35 },
  { name: '银行', pePercentile: 74 },
]);

// 同日重复记录覆盖，不追加
const twice = stampSnapshot(h, TODAY, [{ name: '农林牧渔', pePercentile: 35 }]);
assert.equal((twice['农林牧渔'] ?? []).filter((p) => p.d === TODAY).length, 1, '同日应覆盖');

// 基准取窗口内最早一条（08-10，跨 30 天）：55 -> 35 = -20，分位在往下走。
// 若错取 08-20 作基准会得到 -10，所以这个断言同时锁定「取最早」的语义。
const down = pctDeltaOf(h, '农林牧渔', TODAY);
assert.ok(down, '应能算出方向');
assert.equal(down.span, 30, `span 应为 30，实得 ${down.span}`);
assert.equal(down.from, 55, `from 应是窗口内最早那天的分位 55，实得 ${down.from}`);
assert.equal(down.delta, -20, `delta 应为 -20，实得 ${down.delta}`);

// 银行 72 -> 74，小幅上行（基准也是 08-10）
const up = pctDeltaOf(h, '银行', TODAY);
assert.ok(up, '银行应能算出方向');
assert.equal(up.delta, 2, `银行 delta 应为 2，实得 ${up.delta}`);

// 历史跨度不足不给方向（08-30 距 09-09 只有 10 天？用更近的样本）
const short: PctHistory = {
  A: [
    { d: '2026-09-05', p: 10 },
    { d: TODAY, p: 20 },
  ],
};
assert.equal(pctDeltaOf(short, 'A', TODAY), null, '跨度不足应返回 null');

// 只有一天的样本不算
assert.equal(pctDeltaOf({ A: [{ d: TODAY, p: 10 }] }, 'A', TODAY), null, '单日样本应返回 null');
assert.equal(pctDeltaOf(h, '不存在的行业', TODAY), null, '未知标的应返回 null');

// 窗口外的旧数据不当基准（100 天前已超出 35 天回看窗口）
const stale: PctHistory = {
  B: [
    { d: '2026-06-01', p: 5 },
    { d: TODAY, p: 60 },
  ],
};
assert.equal(pctDeltaOf(stale, 'B', TODAY), null, '窗口外样本不应作基准');

// 合并去重
const merged = mergeHistory(h, { 农林牧渔: [{ d: TODAY, p: 35 }] });
assert.equal(merged['农林牧渔']!.length, 3, `合并后应去重为 3 条，实得 ${merged['农林牧渔']!.length}`);

// 上限裁剪：保留最近 60 条
let many: PctHistory = {};
for (let i = 0; i < 80; i++) {
  const day = `2026-${String(Math.floor(i / 28) + 5).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`;
  many = stampSnapshot(many, day, [{ name: 'C', pePercentile: i % 100 }]);
}
assert.equal(many.C!.length, 60, '应只保留最近 60 条');
assert.equal(many.C![59]!.d, '2026-07-24', '应保留最新的记录');

// 批量方向表：只有历史足够的标的才有值
const table = deltasFor(h, TODAY, ['农林牧渔', '银行', '没数据的']);
assert.equal(Object.keys(table).length, 2, '没历史的不应出现在方向表里');
assert.equal(table['农林牧渔']!.delta, -20);
assert.equal(table['没数据的'], undefined);

console.log('check-val-history ✓');
