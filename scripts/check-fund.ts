import assert from 'node:assert/strict';

import {
  isShareClass,
  num,
  parseDetailBody,
  parseNavBody,
  parseRankBody,
  researchScore,
  riskNote,
  typeBucket,
} from '../src/utils/fund.ts';
import {
  fitForest,
  fitMetrics,
  isRecommend,
  mapCategory,
  olsFit,
  parseStatisticalCsv,
  predictForest,
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

console.log('check-fund ok');
