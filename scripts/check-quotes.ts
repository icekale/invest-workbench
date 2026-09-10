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

console.log('check-quotes ok');
