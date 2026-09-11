import assert from 'node:assert/strict';

import type { IndexValuationConfig, PeDistribution } from '../src/utils/valuation.ts';
import {
  buildItem,
  deriveValuationSignal,
  isoDate,
  parseIndexQuotes,
  percentileFromQuantiles,
  realPctDelta,
} from '../src/utils/valuation.ts';

// 腾讯指数字段下标：错一格不会报错，只会让整张估值表的点位与分位静默错掉。
// vals[30] 是时间戳、vals[37] 是成交额（万元），都不是涨跌幅/市盈率。
const indexFixture = (price: number, changePct: number, pe: string, pb: string) => {
  const vals = Array.from({ length: 51 }).fill('0');
  vals[3] = String(price);
  vals[30] = '20260908161415'; // 时间戳
  vals[32] = String(changePct);
  vals[37] = '49208662'; // 成交额（万元）
  vals[39] = pe;
  vals[46] = pb;
  return `v_sh000300="${vals.join('~')}"`;
};

const parsed = parseIndexQuotes(indexFixture(4523.1, -0.36, '14.02', '1.52'));
const hs300 = parsed.get('sh000300');
assert.ok(hs300, '应解析出 sh000300');
assert.equal(hs300.price, 4523.1);
assert.equal(hs300.changePct, -0.36, '涨跌幅必须取 vals[32]，取到时间戳会得到天文数字');
assert.equal(hs300.pe, 14.02, 'PE 必须取 vals[39]，取到成交额会得到几千万倍');
assert.equal(hs300.pb, 1.52);
assert.ok(Math.abs(hs300.changePct) < 100, `涨跌幅应是百分比，实得 ${hs300.changePct}`);

// PE/PB 非正（亏损或缺失）时归 0，不能把负数带进分位
const loss = parseIndexQuotes(indexFixture(1000, 0, '-5', '0')).get('sh000300');
assert.ok(loss);
assert.equal(loss.pe, 0);
assert.equal(loss.pb, 0);

// 一次多只指数：分号分隔、大小写归一
const second = indexFixture(2, 2, '20', '2');
const multi = parseIndexQuotes(`${indexFixture(1, 1, '10', '1')};v_SZ399006=${second.slice(11)}`);
assert.deepEqual(
  [...multi.keys()].sort((a, b) => a.localeCompare(b)),
  ['sh000300', 'sz399006'],
);
assert.equal(multi.get('sz399006')?.pe, 20);

assert.equal(parseIndexQuotes('').size, 0);
assert.equal(parseIndexQuotes('garbage').size, 0);

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

// PE 与分位必须同源：分位查的是中证 dist.quantiles，被查的 PE 也必须是中证的 dist.currentPe。
// 拿腾讯 PE 去查中证分布不会报错，只会静默把指数顶到极端分位（实测科创50 腾讯 129.73 vs 中证 69.82）。
const kc50: IndexValuationConfig = {
  code: 'sh000688',
  name: '科创50',
  category: 'broad',
  categoryLabel: '宽基',
  etfCode: '588000',
  etfName: '科创50ETF',
  description: '',
  peStats: { min: 20, p20: 30, p50: 45, p80: 70, max: 120, avg: 50 },
};
const dist: PeDistribution = {
  quantiles: Array.from({ length: 101 }, (_, i) => 20 + i),
  currentPe: 69.82,
  lastClose: 1000,
  lastChangePct: 0,
  lastDate: '2026-09-08',
  years: 10,
};
const mixed = buildItem(kc50, { price: 1000, changePct: 0, pe: 129.73, pb: 1.5 }, dist, '2026-09-08 16:00');
assert.equal(mixed.pe, 69.82, `有真实分布时 PE 应取中证的 69.82（同源），实得 ${mixed.pe}`);
assert.ok(
  mixed.pePercentile >= 45 && mixed.pePercentile <= 55,
  `中证 PE 69.82 在 20..120 的均匀分布里应约 50 分位，实得 ${mixed.pePercentile}`,
);
assert.notEqual(mixed.signal, 'high', '同源后科创50 不该被判成「偏高」');

// 实测科创50 十年分布 max=105.42。腾讯 PE 129.73 超出上沿必须是 100%，不能跟中证 69.82 的 ~67% 混在一起。
const starQ = [23.38, 33.23, 49.47, 75.98, 105.42];
assert.equal(percentileFromQuantiles(129.73, starQ), 100);
const csiPct = percentileFromQuantiles(69.82, starQ);
assert.ok(csiPct >= 50 && csiPct <= 80, `中证 PE 69.82 应落在 p50–p80，实得 ${csiPct}`);

// 拿不到真实分布时才退回腾讯 PE —— 此时分位也是手填基准，UI 会标 manual。
const manual = buildItem(kc50, { price: 1000, changePct: 0, pe: 12, pb: 1.5 }, null, '2026-09-08 16:00');
assert.equal(manual.pe, 12, '无分布时应退回腾讯 PE');
assert.equal(manual.peStatsBasis, 'manual');

console.log('check-valuation ok');
