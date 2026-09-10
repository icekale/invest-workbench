/**
 * 账户注册表自检：`node --experimental-strip-types scripts/check-accounts.ts`
 *
 * 盯四件会静默出错的事：
 *  1. 性质与 id 分家 —— 新建的股票桶必须拿到股票费率，名字里带 ETF 也不算基金；
 *  2. 老数据迁移 —— 老备份没有注册表，但持仓的 account 字段一直在，一个都不能丢光；
 *  3. 费率 —— `feeRate: 0`（免佣）不能被 `||` 顺手吃掉，退回默认值；
 *  4. 场外基金（`kind: 'fund'`）—— 它和场内是两套规则：不整手、份额可小数、没有 5 元最低佣金。
 */
import assert from 'node:assert/strict';

import {
  activeOf,
  defaultAccounts,
  feeOf,
  isListedFund,
  isOtcFund,
  kindOf,
  makeAccountId,
  matchAccount,
  minCommissionOf,
  nameOf,
  normalizeAccounts,
  rateOf,
  tradesInLots,
  unitOf,
} from '../src/utils/accounts.ts';
import { maxBuyQuantity, tradeFee } from '../src/utils/ledger.ts';

/* ---------- 默认注册表 ---------- */
const def = defaultAccounts();
assert.deepEqual(
  def.map((a) => a.id),
  ['stock', 'etf', 'fund'],
  '三个默认账户：股票 / ETF / 公募基金',
);
assert.ok(def.every((a) => !a.archived));
assert.equal(nameOf(def, 'stock'), '股票账户');
assert.equal(nameOf(def, 'nope'), 'nope', '查不到名字就退回 id，不能空白');

/* ---------- 性质看 kind，不看 id 也不看名字 ---------- */
const custom = normalizeAccounts([
  { id: 'acct_1', name: '红利ETF增强', kind: 'stock' },
  { id: 'acct_2', name: '打新', kind: 'etf' },
  { id: 'acct_3', name: '场外债基', kind: 'fund' },
]);
assert.equal(isListedFund(custom, 'acct_1'), false, '名字里有 ETF，但 kind 是 stock');
assert.equal(isListedFund(custom, 'acct_2'), true, '名字里没有基金字样，但 kind 是 etf');
assert.equal(isOtcFund(custom, 'acct_2'), false, '场内基金不是场外');
assert.equal(isOtcFund(custom, 'acct_3'), true, 'kind 是 fund 才算场外');
assert.equal(kindOf(custom, 'acct_1'), 'stock');

/*
 * 单位与整手。场外基金按金额申购，份额本身就是小数（`MINSG: 10` 是最低申购金额 10 元），
 * 沿用场内的整手会把 1000 元的申购卡成 0 份。
 */
assert.equal(unitOf(custom, 'acct_1'), '股');
assert.equal(unitOf(custom, 'acct_2'), '份');
assert.equal(unitOf(custom, 'acct_3'), '份');
assert.equal(tradesInLots(custom, 'acct_1'), true);
assert.equal(tradesInLots(custom, 'acct_2'), true);
assert.equal(tradesInLots(custom, 'acct_3'), false, '场外基金不整手');

// 老数据的 id 就是性质，只能靠前缀猜
assert.equal(kindOf([], 'etf'), 'etf');
assert.equal(kindOf([], 'fund_2'), 'fund', 'fund_ 前缀是场外基金，不是 ETF');
assert.equal(kindOf([], 'acct_9'), 'stock');
// `etf` 必须先判：「ETF 联接基金」两边都沾，场内那套才是对的
assert.equal(kindOf([], 'etf_lianjie_fund'), 'etf', 'ETF 联接基金归场内');

/* ---------- 费率：自带优先，0 是免佣，不能变成默认值 ---------- */
assert.equal(rateOf(custom, 'acct_1'), 0.00008, 'kind=stock 拿股票默认费率');
assert.equal(rateOf(custom, 'acct_2'), 0.00005, 'kind=etf 拿基金默认费率');
assert.equal(rateOf(normalizeAccounts([{ id: 'a', name: 'a', kind: 'stock', feeRate: 0.0003 }]), 'a'), 0.0003);
assert.equal(rateOf(normalizeAccounts([{ id: 'a', name: 'a', kind: 'stock', feeRate: 0 }]), 'a'), 0, '免佣账户');

/*
 * 最低佣金 5 元。券商按笔收，不足 5 元按 5 元 —— 但只对有佣金的账户成立，
 * 免佣账户不能被子限兜成 5，那就不叫免佣了。金额 0/负也不能凭空算出 5 元。
 */
assert.equal(feeOf(custom, 'acct_1', 20_000), 5, '股票万 0.8：2 万只算 1.6，低于下限按下限');
assert.equal(tradeFee('stock', 10_000), 5, '股票小额按下限');
assert.equal(tradeFee('etf', 10_000), 5, '基金小额按下限');
assert.equal(tradeFee('acct_2', 10_000, custom), 5, '注册表里的基金桶同样有下限');

// 平衡点：比例值正好等于 5 的那一档。股票万 0.8 → 62 500；基金万 0.5 → 10 万
assert.equal(tradeFee('stock', 62_500), 5, '股票恰好到下限');
assert.equal(tradeFee('stock', 100_000), 8, '股票过平衡点后回到比例');
assert.equal(tradeFee('etf', 100_000), 5, '基金恰好到下限');
assert.equal(tradeFee('etf', 200_000), 10, '基金过平衡点后回到比例');

// 免佣账户：费率就是 0，没有被下限变成 5
const freeAcct = normalizeAccounts([{ id: 'free', name: '免佣', kind: 'stock', feeRate: 0 }]);
assert.equal(minCommissionOf(freeAcct, 'free'), 0, '免佣账户没有最低佣金');
assert.equal(tradeFee('free', 10_000, freeAcct), 0, '免佣账户小额也是 0');
assert.equal(minCommissionOf(custom, 'acct_1'), 5, '有佣金的账户才有下限');

/*
 * 场外基金收的是**申购费**，不是券商佣金，「不足 5 元按 5 元」那条规定不适用于它。
 * 下限一旦套上去，1000 元的申购会被算成 5 元费用（真实是 1.5 元）。
 */
assert.equal(rateOf(custom, 'acct_3'), 0.0015, '场外基金默认申购费 0.15%');
assert.equal(minCommissionOf(custom, 'acct_3'), 0, '场外基金没有最低佣金');
assert.equal(feeOf(custom, 'acct_3', 1000), 1.5, '1000 元申购费 1.5 元，不能被抬到 5 元');
assert.equal(feeOf(custom, 'acct_3', 100), 0.15, '小额申购同样按比例');

// 零/负金额不能凭空算出 5 元
assert.equal(tradeFee('acct_1', -5, custom), 0, '负数金额不该算出负佣金');
assert.equal(tradeFee('acct_1', 0, custom), 0, '零金额不该算出最低佣金');

/*
 * 最大可买股数。加上最低佣金后 `cash / (price * (1 + rate))` 会多报一手，
 * 然后被成交校验打回（表现为点「满仓」报「可用现金不足」），所以这里把它钉住。
 */
// 1 万股 × 10 元：比例佣金 8 元 > 5，所以正常吃满现金
assert.equal(maxBuyQuantity('stock', 10, 1005, custom), 100, '够付 5 元最低佣金');
// 现金 1002 只差 3 元：比例式会报 100 股，但实际要付 1000+5=1005
assert.equal(maxBuyQuantity('stock', 10, 1002, custom), 0, '差 3 元付不起最低佣金，不能报 100 股');
assert.equal(maxBuyQuantity('stock', 10, 1007, custom), 100, '多出 2 元就买得起');

/*
 * 只算比例档不够：比例档会报出一个被校验打回的手数，然后直接归零——
 * 而少一手其实是买得起的。下面这个是拿变异测试逼出来的反例：
 * 现金 2004 只够 100 股（1000 + 5 元佣金），但比例档会报 200 股（2000 + 5 = 2005，付不起）。
 * 最低档 `cash - 5 = 1999` 才能找回那 100 股。
 */
assert.equal(maxBuyQuantity('stock', 10, 2004, custom), 100, '比例档报多了要退回一手，不能归零');
assert.equal(maxBuyQuantity('stock', 10, 2005, custom), 200, '刚好付得起 200 股的手续费就买 200');
assert.equal(maxBuyQuantity('stock', 10, 3004, custom), 200, '3004 只够 200 股');
assert.equal(maxBuyQuantity('stock', 10, 5004, custom), 400, '5004 只够 400 股');

// 过平衡点后走比例档：单价 100、现金 10 万 → 900 股（10 万全买要付 8 元佣金，付不起 1000 股）
assert.equal(maxBuyQuantity('stock', 100, 100_000, custom), 900, '大额走比例档');
assert.equal(maxBuyQuantity('stock', 100, 99_995, custom), 900, '现金差 5 元只少一手，不是清零');
assert.equal(maxBuyQuantity('stock', 100, 9_995, custom), 0, '买不起一手时就是 0，不能向上取');
// 免佣账户没有 5 元门槛：1000 元买 10 元的股正好 100 股
assert.equal(maxBuyQuantity('free', 10, 1000, freeAcct), 100, '免佣账户 1000 元刚好买 100 股');
assert.equal(maxBuyQuantity('free', 10, 999, freeAcct), 0, '免佣账户差 1 元也买不起');

// 非正价格/现金不能报出数量，也不能算出 NaN
assert.equal(maxBuyQuantity('stock', 0, 10_000, custom), 0);
assert.equal(maxBuyQuantity('stock', 10, 0, custom), 0);
assert.equal(maxBuyQuantity('stock', -10, 10_000, custom), 0);

/* ---------- 老断言：费率来源换了，大额数字不能变 ---------- */

/*
 * 场外基金不能整手。这是钱的路上的坑：净值 1.262、现金 1000 元含申购费能买 791.20 份，
 * 沿用场内的 100 份整手会向下取到 700 份，把可买的钱平白锁住。
 *
 * 注意份数不是 `1000 / 1.262 = 792.39` —— 申购费是按金额另收的，
 * 真上界要按 `cash / (1 + 费率)` 先扣费用（与场内佣金同一个式子）。
 */
const otc = normalizeAccounts([{ id: 'of_acct', name: '公募', kind: 'fund' }]);
assert.equal(maxBuyQuantity('of_acct', 1.262, 1000, otc), 791.2, '净值 1.262、现金 1000 → 791.20 份（不是 700）');
assert.equal(maxBuyQuantity('of_acct', 1.262, 100, otc), 79.12, '小额同样按份算');
// 报出来的份数必须真的付得起（含申购费），否则成交校验会把它打回
const otcQty = maxBuyQuantity('of_acct', 1.262, 1000, otc);
const otcAmount = Number((1.262 * otcQty).toFixed(2));
assert.ok(otcAmount + tradeFee('of_acct', otcAmount, otc) <= 1000, '不含费用的份数会被现金校验拒掉');
// 场外没有 5 元门槛：现金 4 元也能买 3.16 份，而股票账户会归零
assert.equal(maxBuyQuantity('of_acct', 1.262, 4, otc), 3.16, '申购费无下限，小额也能买');
assert.equal(maxBuyQuantity('stock', 1.262, 4, otc), 0, '股票侧同样现金仍归零（买不起一手）');

/* ---------- 老备份迁移：没登记的账户补成归档，持仓才不会凭空消失 ---------- */
const migrated = normalizeAccounts(undefined, ['stock', 'etf', 'grid']);
assert.deepEqual(
  migrated.map((a) => a.id),
  ['stock', 'etf', 'fund', 'grid'],
  '默认表补齐后才是没登记的 hint',
);
assert.equal(migrated.find((a) => a.id === 'grid')!.archived, true, '补出来的账户收起来');
assert.deepEqual(
  activeOf(migrated).map((a) => a.id),
  ['stock', 'etf', 'fund'],
  '归档的不出现在在用列表里',
);
/*
 * 老用户的注册表非空，加新默认账户时走的是「按 id 补」那条路 ——
 * 只看 `!out.length` 的话「公募基金账户」就只对全新安装生效，老用户永远看不到它。
 */
const legacy = normalizeAccounts([
  { id: 'stock', name: '股票账户', kind: 'stock' },
  { id: 'etf', name: 'ETF 账户', kind: 'etf' },
]);
assert.deepEqual(
  legacy.map((a) => a.id),
  ['stock', 'etf', 'fund'],
  '老注册表也要补上公募基金账户',
);
assert.equal(legacy.find((a) => a.id === 'fund')!.archived, undefined, '补出来的默认账户是活的，不是归档');
// 已经在注册表里的 hint 不该被重复补一条
assert.equal(normalizeAccounts(def, ['stock']).length, 3);
// 脏数据不能把整张表读崩
assert.deepEqual(
  normalizeAccounts('nope').map((a) => a.id),
  ['stock', 'etf', 'fund'],
  '读不出来就回默认表',
);
assert.deepEqual(
  normalizeAccounts([null, 42, { name: '   ' }]).map((a) => a.id),
  ['stock', 'etf', 'fund'],
);
const dedup = normalizeAccounts([
  { id: 'x', name: 'x' },
  { id: 'x', name: 'dup' },
]);
// 同 id 只留先出现的（总数里有被补上的三个默认账户，所以看的是 x 自己的条数）
assert.deepEqual(
  dedup.filter((a) => a.id === 'x').map((a) => a.name),
  ['x'],
  '同 id 只留先出现的',
);
assert.equal(dedup[0].name, 'x');

/* ---------- 解析外部来源的账户名 ---------- */
assert.equal(matchAccount(custom, 'acct_1'), 'acct_1', '按 id 命中');
assert.equal(matchAccount(custom, '打新'), 'acct_2', '按名字命中');
assert.equal(matchAccount(def, 'all'), 'stock', '全市场落到第一个股票桶');
assert.equal(matchAccount(def, ''), 'stock');
assert.equal(matchAccount(def, 'ETF'), 'etf');
assert.equal(matchAccount(def, '公募基金账户'), 'fund', '按名字能点到公募基金账户');
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
