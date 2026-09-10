import assert from 'node:assert/strict';

import {
  applyConflictPicks,
  emptySnap,
  mergeByKey,
  mergeScalar,
  same,
  threeWaySnapshot,
} from '../src/utils/sync-merge.ts';

const a = {
  account: 'etf',
  code: 'sh510300',
  name: 'a',
  quantity: 1,
  cost: 1,
  health: 'healthy',
  action: 'hold',
  thesisId: '',
};
const b = { ...a, quantity: 2 };
const c = { ...a, code: 'sz159915', name: 'c' };

assert.equal(same(a, { ...a }), true);
assert.equal(same(a, b), false);

{
  const out = mergeByKey('holdings', [a], [b], [a], (h) => `${h.account}:${h.code}`);
  assert.equal(out.items[0].quantity, 2);
  assert.equal(out.conflicts.length, 0);
}

{
  const out = mergeByKey('holdings', [a], [a], [b], (h) => `${h.account}:${h.code}`);
  assert.equal(out.items[0].quantity, 2);
}

{
  const out = mergeByKey('holdings', [a], [b], [{ ...a, cost: 9 }], (h) => `${h.account}:${h.code}`);
  assert.equal(out.conflicts.length, 1);
  assert.equal(out.items[0].quantity, 2);
}

{
  const out = mergeByKey('holdings', [a], [a, c], [a], (h) => `${h.account}:${h.code}`);
  assert.equal(out.items.length, 2);
}

assert.equal(mergeScalar(1, 2, 1), 2);
assert.equal(mergeScalar(1, 1, 3), 3);

{
  const { merged, conflicts } = threeWaySnapshot(
    { ...emptySnap(), holdings: [a], cash: { stock: 1, etf: 1 } },
    { ...emptySnap(), holdings: [b, c], cash: { stock: 1, etf: 5 } },
    { ...emptySnap(), holdings: [a], cash: { stock: 8, etf: 1 } },
  );
  assert.equal((merged.holdings || []).length, 2);
  assert.equal(merged.cash?.etf, 5);
  assert.equal(merged.cash?.stock, 8);
  assert.equal(conflicts.length, 0);
}

/*
 * 现金合并按三边的键并集，不能只认 stock/etf。
 * 账户是自定义资金桶：写死两个键的话，自建账户（含公募基金账户）的现金
 * 在同步冲突合并里会被静默丢掉 —— 表现是“同步一次就少一笔钱”，且不报任何错。
 */
{
  const { merged } = threeWaySnapshot(
    { ...emptySnap(), cash: { stock: 1, etf: 1, acct_3: 100 } },
    { ...emptySnap(), cash: { stock: 1, etf: 1, acct_3: 200 } },
    { ...emptySnap(), cash: { stock: 1, etf: 1, acct_3: 100, of_acct: 66 } },
  );
  assert.equal(merged.cash?.acct_3, 200, '自建账户现金要进合并结果');
  assert.equal(merged.cash?.of_acct, 66, '只在一边出现的账户也不能丢');
  assert.equal(merged.cash?.stock, 1, '写死过的老键照旧');
}

{
  const { merged, conflicts } = threeWaySnapshot(
    { ...emptySnap(), holdings: [a] },
    { ...emptySnap(), holdings: [b] },
    { ...emptySnap(), holdings: [{ ...a, cost: 9 }] },
  );
  assert.ok(conflicts.length >= 1);
  const remote = applyConflictPicks(merged, conflicts, 'remote');
  const row = (remote.holdings || []).find((h) => (h as { code: string }).code === 'sh510300') as { cost: number };
  assert.equal(row.cost, 9);
}

console.log('check-sync ok');
