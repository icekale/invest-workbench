import assert from 'node:assert/strict';

import { allocation, healthScore, risks, shortCode, sparkSeries, summarize } from '../src/utils/book.ts';
import { calculateLedger, parseTransactionsCsv, recalculateHoldingsFromTransactions } from '../src/utils/ledger.ts';

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

// 校验台账解析、持仓加权成本重算与换手率计算
const csvSample = `日期,账户,代码,名称,买卖,成交价,成交量,手续费
2025-01-01,股票,sh600519,贵州茅台,买入,1600,100,20
2025-01-10,股票,sh600519,贵州茅台,买入,1800,100,20
2025-01-15,股票,sh600519,贵州茅台,卖出,1900,50,20`;
const parsed = parseTransactionsCsv(csvSample);
assert.equal(parsed.success, true);
assert.equal(parsed.rows.length, 3);

const computedHoldings = recalculateHoldingsFromTransactions(parsed.rows);
assert.equal(computedHoldings.length, 1);
assert.equal(computedHoldings[0].quantity, 150);
// 成本应为加权平均成本约 1700
assert.ok(computedHoldings[0].cost > 1690 && computedHoldings[0].cost < 1710);

const ledger = calculateLedger(parsed.rows, 300000);
assert.equal(ledger.tradeCount, 3);
assert.equal(ledger.totalBuyAmount, 340000);
assert.equal(ledger.totalSellAmount, 95000);
assert.ok(ledger.realizedPnL > 9000); // 卖出50股，成本约1700，卖出价1900，盈利约10000减去手续费
assert.ok(ledger.turnoverRate > 0);

console.log('check-book ok');
