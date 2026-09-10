/**
 * 账户注册表自检：`node --experimental-strip-types scripts/check-accounts.ts`
 *
 * 盯三件会静默出错的事：
 *  1. 性质与 id 分家 —— 新建的股票桶必须拿到股票费率，名字里带 ETF 也不算基金；
 *  2. 老数据迁移 —— 老备份没有注册表，但持仓的 account 字段一直在，一个都不能丢光；
 *  3. 费率 —— `feeRate: 0`（免佣）不能被 `||` 顺手吃掉，退回默认值。
 */
import assert from 'node:assert/strict';

import {
  activeOf,
  defaultAccounts,
  feeOf,
  isFund,
  kindOf,
  makeAccountId,
  matchAccount,
  nameOf,
  normalizeAccounts,
  rateOf,
} from '../src/utils/accounts.ts';
import { tradeFee } from '../src/utils/ledger.ts';

/* ---------- 默认注册表 ---------- */
const def = defaultAccounts();
assert.deepEqual(
  def.map((a) => a.id),
  ['stock', 'etf'],
);
assert.ok(def.every((a) => !a.archived));
assert.equal(nameOf(def, 'stock'), '股票账户');
assert.equal(nameOf(def, 'nope'), 'nope', '查不到名字就退回 id，不能空白');

/* ---------- 性质看 kind，不看 id 也不看名字 ---------- */
const custom = normalizeAccounts([
  { id: 'acct_1', name: '红利ETF增强', kind: 'stock' },
  { id: 'acct_2', name: '打新', kind: 'etf' },
]);
assert.equal(isFund(custom, 'acct_1'), false, '名字里有 ETF，但 kind 是 stock');
assert.equal(isFund(custom, 'acct_2'), true, '名字里没有基金字样，但 kind 是 etf');
assert.equal(kindOf(custom, 'acct_1'), 'stock');
// 老数据的 id 就是性质，只能靠前缀猜
assert.equal(kindOf([], 'etf'), 'etf');
assert.equal(kindOf([], 'fund_2'), 'etf');
assert.equal(kindOf([], 'acct_9'), 'stock');

/* ---------- 费率：自带优先，0 是免佣，不能变成默认值 ---------- */
assert.equal(rateOf(custom, 'acct_1'), 0.00008, 'kind=stock 拿股票默认费率');
assert.equal(rateOf(custom, 'acct_2'), 0.00005, 'kind=etf 拿基金默认费率');
assert.equal(rateOf(normalizeAccounts([{ id: 'a', name: 'a', kind: 'stock', feeRate: 0.0003 }]), 'a'), 0.0003);
assert.equal(rateOf(normalizeAccounts([{ id: 'a', name: 'a', kind: 'stock', feeRate: 0 }]), 'a'), 0, '免佣账户');
assert.equal(feeOf(custom, 'acct_1', 10_000), 0.8);

/* ---------- 老断言必须保住：费率来源换了，数字不能变 ---------- */
assert.equal(tradeFee('stock', 10_000), 0.8, 'check-book.ts 依赖这条');
assert.equal(tradeFee('etf', 10_000), 0.5);
assert.equal(tradeFee('acct_2', 10_000, custom), 0.5, '注册表里的基金桶');
assert.equal(tradeFee('acct_1', -5, custom), 0, '负数金额不该算出负佣金');

/* ---------- 老备份迁移：没登记的账户补成归档，持仓才不会凭空消失 ---------- */
const migrated = normalizeAccounts(undefined, ['stock', 'etf', 'grid']);
assert.deepEqual(
  migrated.map((a) => a.id),
  ['stock', 'etf', 'grid'],
);
assert.equal(migrated.find((a) => a.id === 'grid')!.archived, true, '补出来的账户收起来');
assert.deepEqual(
  activeOf(migrated).map((a) => a.id),
  ['stock', 'etf'],
  '归档的不出现在在用列表里',
);
// 已经在注册表里的 hint 不该被重复补一条
assert.equal(normalizeAccounts(def, ['stock']).length, 2);
// 脏数据不能把整张表读崩
assert.deepEqual(
  normalizeAccounts('nope').map((a) => a.id),
  ['stock', 'etf'],
  '读不出来就回默认表',
);
assert.deepEqual(
  normalizeAccounts([null, 42, { name: '   ' }]).map((a) => a.id),
  ['stock', 'etf'],
);
const dedup = normalizeAccounts([
  { id: 'x', name: 'x' },
  { id: 'x', name: 'dup' },
]);
assert.equal(dedup.length, 1, '同 id 只留先出现的');
assert.equal(dedup[0].name, 'x');

/* ---------- 解析外部来源的账户名 ---------- */
assert.equal(matchAccount(custom, 'acct_1'), 'acct_1', '按 id 命中');
assert.equal(matchAccount(custom, '打新'), 'acct_2', '按名字命中');
assert.equal(matchAccount(def, 'all'), 'stock', '全市场落到第一个股票桶');
assert.equal(matchAccount(def, ''), 'stock');
assert.equal(matchAccount(def, 'ETF'), 'etf');
assert.equal(matchAccount(def, '查无此账户'), 'stock', '认不出来也要给个活的账户');
assert.equal(matchAccount(custom, 'acct_1'), 'acct_1', '归档账户仍可被点名（迁移老数据要用）');

/* ---------- 新 id 一定不撞 ---------- */
const ids = new Set(def.map((a) => a.id));
for (let i = 0; i < 20; i += 1) {
  const id = makeAccountId([...def, ...[...ids].map((x) => ({ id: x, name: x, kind: 'stock' as const }))]);
  assert.ok(!ids.has(id), `makeAccountId 撞了 ${id}`);
  ids.add(id);
}

console.log('check-accounts ✓');
