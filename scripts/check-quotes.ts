import assert from 'node:assert/strict';

import {
  bareFundCode,
  calcHolding,
  fetchOtcQuotes,
  fetchQuotes,
  isOtcCode,
  normalizeCode,
  ofCode,
  parseTencentBody,
} from '../src/utils/quote.ts';

const fixture = `v_sz000001="51~平安银行~000001~10.00~9.00~9.50~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~20260907~1.00~11.11~0~0~0~0~0~0~0~0~0~0";`;

const map = parseTencentBody(fixture);
const q = map.get('sz000001');
assert.ok(q, 'missing sz000001');
assert.equal(q.name, '平安银行');
assert.equal(q.price, 10);
assert.equal(q.changePct, 11.11);

const row = calcHolding({ quantity: 1000, cost: 8 }, q);
assert.equal(row.marketValue, 10000);
assert.equal(row.pnl, 2000);
assert.equal(row.pnlPct, 0.25);

const dead = calcHolding({ quantity: 100, cost: 10 }, undefined);
assert.equal(dead.marketValue, null);
assert.equal(dead.pnl, null);

const dust = calcHolding({ quantity: 3, cost: 0.1 }, { ...q, price: 0.1 });
assert.equal(dust.marketValue, 0.3);
assert.equal(dust.pnl, 0);

assert.equal(normalizeCode('510300'), 'sh510300');
assert.equal(normalizeCode('000001'), 'sz000001');
assert.equal(normalizeCode('sz300750'), 'sz300750');
assert.equal(normalizeCode('430047'), 'bj430047');

/* ---------- 上游 5xx 要重试一次：深交所/东财偶发 502 是 DEPLOY.md 记的已知问题 ---------- */
const realFetch = globalThis.fetch;
let calls: string[] = [];

function stubFetch(status: number) {
  calls = [];
  globalThis.fetch = (async (url: string | URL) => {
    calls.push(String(url));
    // 只让第一次失败，第二次放行
    return calls.length === 1 ? new Response('', { status }) : new Response(fixture, { status: 200 });
  }) as typeof fetch;
}

try {
  stubFetch(502);
  const retried = await fetchQuotes(['sz000001']);
  assert.equal(calls.length, 2, '502 应该重试一次');
  assert.equal(retried.get('sz000001')?.price, 10, '重试成功后要真的拿到数据');

  stubFetch(404);
  await assert.rejects(() => fetchQuotes(['sz000001']), /HTTP 404/);
  assert.equal(calls.length, 1, '4xx 是参数/鉴权问题，重试没意义，只能试一次');
} finally {
  globalThis.fetch = realFetch;
}

/*
 * 场外基金代码的命名空间隔离。
 *
 * 这是整个改动里最静默的一条：`000001` 在行情里是平安银行（¥11.85），在场外基金里是
 * 华夏成长（净值 1.262）。两个都“查得到”，界面不报错，只是钱算错一个数量级。
 * 所以下面这些断言守的不是功能，是不出错价。
 */
assert.equal(ofCode('000001'), 'of000001');
assert.equal(ofCode('of000001'), 'of000001', '已带前缀不能变成 ofof…');
assert.equal(ofCode(' 110022 '), 'of110022', '带空白也要能认');
assert.equal(ofCode('abc'), 'abc', '认不出来原样退回，不猜');
assert.equal(isOtcCode('of000001'), true);
assert.equal(isOtcCode('sz000001'), false);
assert.equal(isOtcCode('000001'), false, '裸 6 位码永远是场内，不能当基金');
assert.equal(bareFundCode('of000001'), '000001', '东财要的是裸码');
assert.equal(normalizeCode('of000001'), 'of000001', '套上 sh/sz 就变成另一只股票了');

/* 场外基金不能送进行情接口：剔掉前缀腾讯会拿平安银行的价格回你，不报任何错 */
const otcCalls: string[] = [];
const realFetch2 = globalThis.fetch;
try {
  globalThis.fetch = (async (url: string | URL) => {
    otcCalls.push(String(url));
    return new Response('', { status: 200 });
  }) as typeof fetch;
  const onlyOtc = await fetchQuotes(['of000001']);
  assert.equal(onlyOtc.size, 0, '场外码不进腾讯行情');
  assert.equal(otcCalls.length, 0, '一个请求都不该发出去');
} finally {
  globalThis.fetch = realFetch2;
}

/*
 * 场外净值转「行情」。`FundMNBaseInfo` 一次给了名字（SHORTNAME）、净值（DWJZ）、当日涨跌（RZDF）。
 * 价格就是净值 —— 账本上「市值 = 价 × 份额」对两种资产是同一个式子，所以能拼进同一张表。
 */
const navBody = JSON.stringify({
  Datas: { FCODE: '000001', SHORTNAME: '华夏成长混合', FTYPE: '混合型-灵活', DWJZ: '1.2620', RZDF: '-0.47' },
});
const realFetch3 = globalThis.fetch;
try {
  globalThis.fetch = (async () => new Response(navBody, { status: 200 })) as typeof fetch;
  const navMap = await fetchOtcQuotes(['of000001']);
  const nav = navMap.get('of000001');
  assert.ok(nav, '应该拿到净值行情');
  assert.equal(nav.price, 1.262, '价格就是官方净值');
  assert.equal(nav.name, '华夏成长混合');
  assert.equal(nav.changePct, -0.47, 'RZDF 就是当日涨跌');
  // 上一日净值反推出来，供 calcHolding 算日盈亏（与 changePct 自洽）
  assert.ok(nav.lastClose && Math.abs(nav.lastClose - 1.2679) < 0.001, `反推昨日净值异常：${nav.lastClose}`);
  assert.ok(nav.change && nav.change < 0, '跌了就应该算出负的当日变动');

  // 拿不到净值时不能进表：宁可显示「—」，也不能拿 0 当价把浮亏算成 −100%
  globalThis.fetch = (async () => new Response('{}', { status: 200 })) as typeof fetch;
  assert.equal((await fetchOtcQuotes(['of000001'])).size, 0, '净值缺失就不给行情');
  assert.equal(calcHolding({ quantity: 1000, cost: 1.2 }, undefined).marketValue, null);
} finally {
  globalThis.fetch = realFetch3;
}

console.log('check-quotes ok');
