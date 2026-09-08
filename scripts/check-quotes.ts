import assert from 'node:assert/strict';

import { calcHolding, normalizeCode, parseTencentBody } from '../src/utils/quote.ts';

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

console.log('check-quotes ok');
