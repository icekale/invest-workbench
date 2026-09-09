import assert from 'node:assert/strict';

import { pickSyncAction } from '../src/utils/cloud-sync.ts';

assert.equal(pickSyncAction(0, null), 'push');
assert.equal(pickSyncAction(0, 100), 'pull');
assert.equal(pickSyncAction(200, 100), 'push');
assert.equal(pickSyncAction(100, 100), 'noop');

console.log('check-sync ok');
