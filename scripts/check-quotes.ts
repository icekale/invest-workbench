import assert from 'node:assert/strict';

import { calcHolding, fetchQuotes, normalizeCode, parseTencentBody } from '../src/utils/quote.ts';

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
 * 退役的场外码（`of` 前缀）绝不能被剥成裸码。
 *
 * 这是整个改动里最静默的一条：`of000001` 是华夏成长（净值 1.262），剥掉前缀就成了
 * `000001` 平安银行（¥11.85）。两个都“查得到”，界面不报错，只是钱算错一个数量级。
 * 场外桶已整体退役，这些码查不到行情是对的 —— 显示「—」比显示一个差一个数量级的价格诚实。
 */
assert.equal(normalizeCode('of000001'), 'of000001', '场外码原样保留，绝不剥前缀');
assert.equal(normalizeCode(' 510300 '), 'sh510300', '带空白也要先 trim 再判市场');
assert.equal(normalizeCode('abc'), 'abc', '认不出来原样退回');

/* 就算存量持仓把 of 码送进行情接口，请求里带的也必须还是带前缀的那个码 */
const otcCalls: string[] = [];
const realFetch2 = globalThis.fetch;
try {
  globalThis.fetch = (async (url: string | URL) => {
    otcCalls.push(String(url));
    return new Response('', { status: 200 });
  }) as typeof fetch;
  assert.equal((await fetchQuotes(['of000001'])).size, 0, '退役的场外码不该有行情');
  assert.ok(otcCalls[0]?.includes('of000001'), `请求里带的必须是带前缀的场外码：${otcCalls[0]}`);
} finally {
  globalThis.fetch = realFetch2;
}

/* 拿不到行情时不能进表：宁可显示「—」，也不能拿 0 当价把浮亏算成 −100% */
assert.equal(calcHolding({ quantity: 1000, cost: 1.2 }, undefined).marketValue, null);

console.log('check-quotes ok');
