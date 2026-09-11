import assert from 'node:assert/strict';

import {
  combineEqualNav,
  dailyReturnHist,
  fetchFundPosition,
  isShareClass,
  mergePositions,
  num,
  parseDetailBody,
  parseNavBody,
  parsePositionBody,
  parseRankBody,
  periodReturn,
  researchScore,
  riskNote,
  typeBucket,
} from '../src/utils/fund.ts';
import {
  fitForest,
  fitMetrics,
  isRecommend,
  mapCategory,
  matchPortfolio,
  olsFit,
  parseStatisticalCsv,
  portfolioStats,
  predictForest,
  riskProfile,
  suggestFunds,
} from '../src/utils/fund-model.ts';

const rank = parseRankBody({
  Datas: [
    {
      FCODE: '960033',
      SHORTNAME: '农银消费主题混合H',
      FUNDTYPE: '002',
      DWJZ: '--',
      SYL_1N: '304.68',
    },
    {
      FCODE: '021180',
      SHORTNAME: '易方达产业机遇混合C',
      FUNDTYPE: '002',
      DWJZ: '3.0652',
      SYL_1N: '176.72',
    },
    {
      FCODE: '002910',
      SHORTNAME: '易方达供给改革混合',
      FUNDTYPE: '002',
      FTYPE: '混合型-灵活',
      DWJZ: '8.2293',
      RZDF: '-0.66',
      SYL_Z: '-3.26',
      SYL_Y: '-5.10',
      SYL_1N: '189.47',
      SYL_3N: '207.87',
      SYL_JN: '123.32',
    },
  ],
});
assert.equal(rank.length, 1);
assert.equal(rank[0].code, '002910');
assert.equal(rank[0].type, '混合型-灵活');
assert.equal(rank[0].year, 189.47);
assert.equal(rank[0].day, -0.66);
assert.throws(() => parseRankBody({ Datas: null, ErrMsg: '网络繁忙，请稍后重试！' }), /网络繁忙/);
assert.equal(
  parseRankBody({
    Datas: JSON.stringify([{ FCODE: '002910', SHORTNAME: '易方达供给改革混合', DWJZ: '8.22', SYL_1N: '1' }]),
  }).length,
  1,
);

const detail = parseDetailBody({
  Datas: {
    FCODE: '002910',
    SHORTNAME: '易方达供给改革混合',
    FTYPE: '混合型-灵活',
    DWJZ: '8.2293',
    SYL_1N: '189.47',
    JJJL: '杨宗昌',
    JJGS: '易方达基金',
    MAXRETRA1: '16.2503',
    STDDEV1: '36.4018',
    SHARP1: '5.4319',
  },
});
assert.equal(detail.manager, '杨宗昌');
assert.equal(detail.drawdown, 16.2503);
assert.equal(num('--'), null);
assert.equal(isShareClass('960033', '农银消费主题混合H'), true);

const nav = parseNavBody({
  Datas: [
    { FSRQ: '2026-09-07', DWJZ: '8.2293' },
    { FSRQ: '2026-09-04', DWJZ: '8.2840' },
    { FSRQ: '2026-09-03', DWJZ: '--' },
  ],
});
assert.equal(nav.length, 2);
assert.equal(nav[0].date, '2026-09-04');
assert.equal(nav[1].nav, 8.2293);
assert.equal(typeBucket('混合型-灵活'), '混合');
assert.equal(typeBucket('股票型'), '股票');
assert.equal(researchScore(null, 10, 10), null);
assert.ok(researchScore(20, 10, 10)! > researchScore(20, 20, 20)!);
assert.ok(researchScore(20, 10, 10)! > researchScore(20, 10, 20)!);
assert.equal(riskNote(10, 16), '回撤相对波动偏大');
assert.equal(riskNote(10, 8), '回撤与波动匹配');
assert.equal(riskNote(10, 6), '回撤相对波动可控');

assert.equal(mapCategory('债券型-混合一级'), '混合债');
assert.equal(mapCategory('债券型-中短债'), '中短债');
const sample = parseStatisticalCsv(
  'code,name,category,risk,company,manager,size,rating,quota,institutionalProportion,shares,bonds,cash,yield,vix,loss,last1y,valueDate\n000001,华夏成长混合,混合型,中风险,华夏,张三,20,5,-1,60,80,10,10,20,1.2,-10,18,2026-01-01\n',
);
assert.equal(sample[0].type, '混合型');
assert.equal(isRecommend(sample[0]), true);
const pool = parseStatisticalCsv(
  'code,name,category,risk,company,manager,size,rating,quota,institutionalProportion,shares,bonds,cash,yield,vix,loss,last1y,valueDate\n000001,华夏成长混合A,混合型,中风险,华夏,张三,20,5,-1,60,80,10,10,20,1.2,-10,18,2026-01-01\n000002,华夏成长混合C,混合型,中风险,华夏,张三,20,5,-1,60,80,10,10,21,1.2,-9,18,2026-01-01\n000003,深回撤混合,混合型,高风险,华夏,张三,20,5,-1,60,80,10,10,30,2,-20,18,2026-01-01\n000004,限额混合,混合型,中风险,华夏,张三,20,5,100,60,80,10,10,8,1,-1,8,2026-01-01\n',
);
const hit = matchPortfolio(pool, 12);
assert.deepEqual(
  hit.map((f) => f.code),
  ['000001'],
);
assert.equal(riskProfile(0.6).label, '保守型');
assert.equal(riskProfile(4).label, '平衡型');
const st = portfolioStats(sample);
assert.equal(st.yield, 20);
assert.equal(st.loss, -10);
assert.equal(portfolioStats([]).yield, 0);

// suggestFunds：机会池排行只有东财前 80 名，名称搜索必须能落到全样本。
// 这组断言守的就是 C4 那个死胡同：搜一个排 80 名以外的基金，不该只得到空表。
assert.deepEqual(
  suggestFunds(pool, '深回撤').map((f) => f.code),
  ['000003'],
  '按名称片段要命中全样本，不受排行 80 名限制',
);
assert.deepEqual(
  suggestFunds(pool, '000002').map((f) => f.code),
  [],
  '6 位纯数字当代码，由调用方直接跳详情，不出建议',
);
assert.deepEqual(
  suggestFunds(pool, '限额').map((f) => f.code),
  ['000004'],
  '限购基金也必须搜得到——搜不到就是死胡同换个地方长出来',
);
assert.deepEqual(suggestFunds(pool, ''), [], '空串不出建议');
assert.deepEqual(suggestFunds(pool, '   '), [], '全空白也不出建议');
assert.equal(suggestFunds(pool, '混合', 2).length, 2, 'limit 要生效');
assert.deepEqual(
  suggestFunds(pool, ' 深回撤 ').map((f) => f.code),
  ['000003'],
  '两端空白要能容忍（输入框里很常见）',
);

const g = combineEqualNav([
  [
    { date: '2026-01-01', nav: 1 },
    { date: '2026-01-02', nav: 1.1 },
    { date: '2026-02-01', nav: 1.21 },
  ],
  [
    { date: '2026-01-01', nav: 2 },
    { date: '2026-02-01', nav: 2.2 },
  ],
]);
assert.equal(g[0].value, 0);
assert.equal(g[g.length - 1].value, 15.5);
assert.equal(periodReturn(g, 1), 15.5);
assert.equal(combineEqualNav([[{ date: '2026-01-01', nav: 1 }]]).length, 0);
assert.equal(periodReturn([], 1), null);
const hist = dailyReturnHist([
  { date: '2026-01-01', value: 0 },
  { date: '2026-01-02', value: 1.5 },
  { date: '2026-01-03', value: -1 },
]);
assert.equal(hist.days, 2);
assert.equal(hist.up, 1);
assert.equal(
  hist.buckets.reduce((s, b) => s + b.n, 0),
  2,
);

const pos = parsePositionBody({
  Datas: {
    fundStocks: [{ GPDM: '600519', GPJC: '贵州茅台', JZBL: '10' }],
    fundboods: [{ ZQDM: '230023', ZQMC: '23国债23', ZJZBL: '8' }],
  },
});
assert.equal(pos.length, 2);
assert.equal(parsePositionBody({ Datas: null }).length, 0);
const merged = mergePositions([pos, [{ name: '贵州茅台', code: '600519', kind: '股票', weight: 10 }]]);
assert.equal(merged[0].name, '贵州茅台');
assert.equal(merged[0].weight, 10);

const y = [5, 7, 9, 11];
const x1 = [1, 2, 3, 4];
const x2 = [0, 1, 0, 1];
const m = olsFit(y, [x1, x2]);
assert.ok(Math.abs(m.b[1] - 2) < 1e-6);
assert.ok(m.r2 > 0.99);

const rows = Array.from({ length: 80 }, (_, i) => {
  const a = i / 20;
  const b = (i % 5) / 5;
  return { x: [a, b], y: -0.7 + 0.17 * a - 4 * b };
});
const trees = fitForest(rows, 12, 4, 4, 1);
const hat = rows.map((r) => predictForest(trees, r.x));
assert.ok(
  fitMetrics(
    rows.map((r) => r.y),
    hat,
  ).r2 > 0.9,
);

// 进上游的码必须剥掉 `of` 前缀。传前缀不报错而是回空表（实测 fundStocks=0），
// 会静默呈现成「这只基金没披露」—— 所以拿真实请求 URL 钉住。
{
  const realFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (input: string | URL) => {
    urls.push(String(input));
    return new Response(
      JSON.stringify({ Datas: { fundStocks: [{ GPDM: '600519', GPJC: '贵州茅台', JZBL: '6.45' }] } }),
      {
        headers: { 'content-type': 'application/json' },
      },
    );
  }) as typeof fetch;
  try {
    await fetchFundPosition('of000001');
    assert.ok(urls[0].includes('FCODE=000001'), `要发裸码，实际发了 ${urls[0]}`);
    assert.ok(!urls[0].includes('of000001'), '不能把 of 前缀发上去');
    // 大写/带空白的也算同一种写法
    await fetchFundPosition(' OF519066 ');
    assert.ok(urls[1].includes('FCODE=519066'), `要去空白且小写，实际发了 ${urls[1]}`);
  } finally {
    globalThis.fetch = realFetch;
  }
}

console.log('check-fund ok');
