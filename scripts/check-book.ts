import assert from 'node:assert/strict';

import { allocation, healthScore, pieColor, risks, shortCode, sparkSeries, summarize } from '../src/utils/book.ts';
import {
  calculateLedger,
  parseTransactionsCsv,
  recalculateHoldingsFromTransactions,
  tradeFee,
} from '../src/utils/ledger.ts';
import { scenarioTarget, scenarioUpside } from '../src/utils/scenario.ts';
import { swGroupOf, swL1FromF100, toSecid } from '../src/utils/sw-industry.ts';

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
assert.equal(scenarioTarget(87.191027496382, -0.05, 12), 993.98);
assert.equal(scenarioTarget(100 / 15, 0.1, 15), 110);
assert.equal(scenarioUpside(100, 80), -0.2);
// 最低佣金 5 元：这两笔小额现在按下限收（大额仍走比例，平衡点见 check-accounts.ts）
assert.equal(tradeFee('stock', 10_000), 5);
assert.equal(tradeFee('etf', 10_000), 5);
assert.equal(tradeFee('stock', 100_000), 8);

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

// 同一天先买后卖：必须按录入先后结转成本，不能把卖出当成纯利润
const sameDayCsv = `日期,账户,代码,名称,买卖,成交价,成交量,手续费
2025-02-01,股票,sh600900,长江电力,买入,10,100,0
2025-02-10,股票,sh600900,长江电力,买入,10,100,0
2025-02-10,股票,sh600900,长江电力,卖出,11,200,0`;
const sameDay = parseTransactionsCsv(sameDayCsv);
assert.equal(sameDay.rows.length, 3);

const sameDayHoldings = recalculateHoldingsFromTransactions(sameDay.rows);
assert.equal(sameDayHoldings.length, 0, '当日已全部卖出，不该留幽灵持仓');

const sameDayLedger = calculateLedger(sameDay.rows, 0);
// 成本 2000（两笔各 1000），卖出 2200 → 已实现盈亏 200
assert.equal(sameDayLedger.realizedPnL, 200, '同日买卖的已实现盈亏应为 200');

// 同一天先卖后买（录入顺序相反）：卖出时持仓为 0，不得凭空结转成本
const sellFirstCsv = `日期,账户,代码,名称,买卖,成交价,成交量,手续费
2025-02-01,股票,sh600900,长江电力,买入,10,100,0
2025-02-10,股票,sh600900,长江电力,卖出,11,100,0
2025-02-10,股票,sh600900,长江电力,买入,9,100,0`;
const sellFirst = parseTransactionsCsv(sellFirstCsv);
const sellFirstLedger = calculateLedger(sellFirst.rows, 0);
// 卖出 1100 - 成本 1000 = 100；随后 9 元买回不影响已实现盈亏
assert.equal(sellFirstLedger.realizedPnL, 100, '先卖后买：只算卖出那一笔');
const sellFirstHoldings = recalculateHoldingsFromTransactions(sellFirst.rows);
assert.equal(sellFirstHoldings.length, 1);
assert.equal(sellFirstHoldings[0].quantity, 100);
assert.equal(sellFirstHoldings[0].cost, 9);

assert.equal(swL1FromF100('白酒Ⅱ'), '食品饮料');
assert.equal(swL1FromF100('电池'), '电力设备');
assert.equal(swL1FromF100('银行Ⅱ'), '银行');
assert.equal(swL1FromF100('白色家电'), '家用电器');
assert.equal(toSecid('sh600519'), '1.600519');
assert.equal(toSecid('sz300750'), '0.300750');
const bySw = allocation([row], 2000, [], () => '银行');
assert.equal(bySw[0].name, '银行');
const sw = { '000001': { l1: '银行', l2: '银行Ⅱ' } };
assert.equal(swGroupOf(row, sw, 'l1'), '银行');
assert.equal(swGroupOf(row, sw, 'l2'), '银行Ⅱ');
const l1Alloc = allocation([row], 2000, [], (p) => swGroupOf(p, sw, 'l1'));
assert.equal(l1Alloc[0].name, '银行');
const l2Alloc = allocation([row], 0, [], (p) => swGroupOf(p, sw, 'l2'));
assert.equal(l2Alloc[0].name, '银行Ⅱ');
assert.equal(l2Alloc.length, 1);

// 饼图/图例取色必须按排名，不能按名字哈希：哈希在分组数 > 色板长度时鸽巢原理下必然撞色，
// 表现就是图例里两块颜色一模一样（review 页饼图的实际 bug）。
const pieColors = Array.from({ length: 20 }, (_, i) => pieColor(i, `行业${i}`));
assert.equal(new Set(pieColors).size, 20, `20 个分组应有 20 种不同颜色，实得 ${new Set(pieColors).size} 种（撞色了）`);
assert.equal(pieColor(5, '现金'), '#93a3ad', '现金恒为灰，不与资产色混用');
assert.equal(pieColor(0, '银行'), pieColor(0, '银行'), '同一排名取色应稳定');

import { CATEGORICAL_COLOR_OPTIONS } from '../src/config/color.ts';

// 分类色序的**知觉**可辨性：光看 hex 不同没用，墨绿 #0d706d 与浅海青 #2a8f89 是肉眼难分的两个绿
// （ΔE=12，低于 15 就属于分不开）。饼图前几个名额是大权重切片，必须分得开，所以这里真的算一遍 Lab ΔE。
// 取前 8 名作门槛是有依据的：品牌色原序（DEFAULT_COLOR_OPTIONS）在第 8 名就掉到 ΔE=12.0
// （墨绿 vs 浅海青），重排后的分类色序到第 8 名仍是 20.4 —— 阈值 20 刚好能把两者区分开。
// 前 9 名两序都是 12.0，因为集合里本身就含那对相近绿青，任何排列都避不开（那是“切片太多”的问题）。
const toLab = (hex: string) => {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [1, 3, 5].map((i) => lin(Number.parseInt(hex.slice(i, i + 2), 16) / 255));
  const [x, y, z] = [
    (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047,
    r * 0.2126 + g * 0.7152 + b * 0.0722,
    (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883,
  ];
  const f = (t: number) => (t > 0.008856 ? t ** (1 / 3) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};
const deltaE = (a: string, b: string) => {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
};
const top8 = CATEGORICAL_COLOR_OPTIONS.slice(0, 8);
let worst = Infinity;
for (let i = 0; i < top8.length; i++) {
  for (let j = i + 1; j < top8.length; j++) worst = Math.min(worst, deltaE(top8[i], top8[j]));
}
assert.ok(worst >= 20, `前 8 个分类色的两两最小 ΔE 应 ≥ 20（可辨），实得 ${worst.toFixed(1)}`);

console.log('check-book ok');
