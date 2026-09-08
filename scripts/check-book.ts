import assert from 'node:assert/strict';

import { allocation, healthScore, risks, shortCode, sparkSeries, summarize } from '../src/utils/book.ts';

const empty = summarize([], 100);
assert.equal(empty.mv, 0);
assert.equal(empty.cashPct, 1);

const row = {
  code: 'sz000001',
  name: '平安银行',
  quantity: 1000,
  cost: 8,
  tag: '银行',
  marketValue: 10000,
  pnl: 2000,
  pnlPct: 0.25,
};
const s = summarize([row], 2000);
assert.equal(s.mv, 10000);
assert.equal(s.cost, 8000);
assert.equal(s.pnl, 2000);
assert.equal(s.pos, 10000 / 12000);

const alloc = allocation([row], 2000, [{ code: 'sz000001', targetWeight: 0.7 }]);
assert.equal(alloc[0].name, '银行');
assert.equal(alloc[0].target, 0.7);
assert.equal(alloc.at(-1)?.name, '现金');
assert.equal(Math.round((alloc.at(-1)?.target ?? 0) * 100), 30);

const health = healthScore([row], [{ id: 't', status: 'valid', title: 'x', code: 'sz000001' }], [], 2000);
assert.ok(health.total >= 0 && health.total <= 100);

const series = sparkSeries(0.1);
assert.equal(series.length, 30);
assert.equal(series[0], 1);
assert.equal(series.at(-1), 1.1);
assert.ok(series.every((v) => v > 0.5 && v < 2));

const under = risks([row], [], [], 2000, [{ code: 'sz000001', targetWeight: 0.9 }]);
assert.equal(under[0].hint, '调整');
assert.equal(under[0].tone, 'warn');
assert.match(under[0].extra, /^\+/);

assert.equal(shortCode('sh510300'), '510300');
console.log('check-book ok');
