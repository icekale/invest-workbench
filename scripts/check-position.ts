import assert from 'node:assert/strict';

import { accountPos, fmtPct, parsePosRange, posStatus } from '../src/utils/position.ts';

assert.deepEqual(parsePosRange('60% ~ 70%'), { lo: 60, hi: 70 });
assert.deepEqual(parsePosRange('75%'), { lo: 75, hi: 75 });
assert.equal(parsePosRange(''), null);
assert.equal(accountPos(70, 30), 0.7);
assert.equal(accountPos(0, 0), null);
assert.equal(posStatus(0.72, { lo: 60, hi: 70 }), 'over');
assert.equal(posStatus(0.5, { lo: 60, hi: 70 }), 'under');
assert.equal(posStatus(0.65, { lo: 60, hi: 70 }), 'ok');
assert.equal(fmtPct(0.72), '72%');

console.log('check-position ok');
