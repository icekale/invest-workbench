import assert from 'node:assert/strict';

import { deriveValuationSignal } from '../src/utils/valuation.ts';

assert.equal(deriveValuationSignal(10).label, '偏低');
assert.equal(deriveValuationSignal(30).label, '偏低');
assert.equal(deriveValuationSignal(50).label, '中性');
assert.equal(deriveValuationSignal(70).label, '偏高');
assert.equal(deriveValuationSignal(90).label, '偏高');
assert.equal(deriveValuationSignal(10).advice, '分位偏低');

console.log('check-valuation ok');
