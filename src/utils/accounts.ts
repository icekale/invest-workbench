/**
 * 账户注册表。
 *
 * 账户是「钱分开记的桶」，性质（`kind`）才是决定行为的东西：一只 ETF 装到哪个桶里，
 * 它每手还是 100 份、费率还是万 0.5。所以判断一律走 `kind`，`id` 只做标识。
 * 于是新建一个 `kind: 'stock'` 的「打新账户」自动拿到股数单位和万 0.8 的费率。
 *
 * 三种 kind 是三种**交易模型**，不是一个名字的三种写法，别用一个 `isFund` 一把抓：
 * 场内（`stock`/`etf`）看行情、整手 100、券商佣金有 5 元下限；
 * 场外（`fund`）看净值、份数可小数、申购费无下限。见 `src/types/invest.ts` 的 `AccountKind`。
 *
 * 但**默认注册表只给场内的两个桶**。场外那套规则完整保留（见 `isOtcFund`/`tradesInLots`/`rateOf`），
 * 谁要记公募基金，在「管理账户」里自己建一个 `kind: 'fund'` 的桶就有了 ——
 * 一个没人用的空桶不该默认占着面板和手工校准的版面。
 */

import type { Account, AccountId, AccountKind } from '@/types/invest';

export function defaultAccounts(): Account[] {
  return [
    { id: 'stock', name: '股票账户', kind: 'stock' },
    { id: 'etf', name: 'ETF 账户', kind: 'etf' },
  ];
}

/*
 * 退役的默认桶名：`公募基金账户` 曾经在默认表里（id 固定为 `fund`），现在不给默认了。
 * 已经存进注册表的那一条不会因为默认表变了就自己消失（`normalizeAccounts` 会原样保留存量），
 * 所以这里明写一条退役规则，否则老状态被回写一次它就又回来了。
 *
 * 只退役**没被动过**的那一个 —— id 和名字都对得上。用户改过名、或另起了 id 的自建基金桶一律保留，
 * 不然会连它的持仓一起失联。真有持仓/流水的（hints 里还带着 `fund`）会在下面被补成归档，不会凭空消失。
 */
const RETIRED_FUND_NAME = '公募基金账户';

export function activeOf(accounts: Account[]): Account[] {
  return accounts.filter((a) => !a.archived);
}

export function findAccount(accounts: Account[], id: AccountId): Account | undefined {
  return accounts.find((a) => a.id === id);
}

/** 界面上的账户名。注册表里找不到就退回 id —— 宁可显示 `etf` 也不要空白。 */
export function nameOf(accounts: Account[], id: AccountId): string {
  return findAccount(accounts, id)?.name || id;
}

export function kindOf(accounts: Account[], id: AccountId): AccountKind {
  return findAccount(accounts, id)?.kind ?? guessKind(id);
}

/**
 * 展示用账户名。事件/产业里的 `all`／空值说的是全市场，不是某个桶 ——
 * 不能拿它去 `nameOf`，否则界面上会凭空出现一个叫 `all` 的账户。
 */
export function labelOf(accounts: Account[], raw?: string): string {
  const want = String(raw ?? '').trim();
  if (!want || want === 'all') return '全市场';
  return nameOf(accounts, want);
}

/** 场外基金（`kind: 'fund'`）：按净值计价、不整手、收申购费、没有最低佣金。 */
export function isOtcFund(accounts: Account[], id: AccountId): boolean {
  return kindOf(accounts, id) === 'fund';
}

/** 场内基金/ETF（`kind: 'etf'`）。和场外基金是两套规则，不要混着用。 */
export function isListedFund(accounts: Account[], id: AccountId): boolean {
  return kindOf(accounts, id) === 'etf';
}

/** 计价单位。股票是「股」，场内/场外基金都是「份」。 */
export function unitOf(accounts: Account[], id: AccountId): string {
  return kindOf(accounts, id) === 'stock' ? '股' : '份';
}

/**
 * 是否按整手（100 股/份）交易。
 *
 * 只有场内品种是整手；场外基金按金额申购、按份额赎回，份额本身就是小数
 * （`MINSG: 10` 是最低申购金额 10 元，不是最低份额）。
 */
export function tradesInLots(accounts: Account[], id: AccountId): boolean {
  return kindOf(accounts, id) !== 'fund';
}

/**
 * 券商佣金的最低收费（元）。券商按**笔**收，一笔委托算下来不足 5 元时按 5 元收。
 *
 * 只对**有佣金**的账户成立：`feeRate: 0` 是免佣账户，免佣就没有「最低 5 元」这回事，
 * 所以下限不套在它头上。这两条规则在 `scripts/check-accounts.ts` 里有断言守着。
 */
export const MIN_COMMISSION = 5;

/**
 * 该账户的最低佣金。免佣账户是 0，其余按 MIN_COMMISSION。
 *
 * 场外基金恒为 0：它收的是**申购费**，不是券商佣金，「不足 5 元按 5 元」那条规定不适用于它。
 */
export function minCommissionOf(accounts: Account[], id: AccountId): number {
  if (kindOf(accounts, id) === 'fund') return 0;
  return rateOf(accounts, id) > 0 ? MIN_COMMISSION : 0;
}

/**
 * 单笔费率。账户自带 `feeRate` 优先，否则按性质取默认值。
 *
 * 三者的默认值不是同一个东西：股票/ETF 是券商**佣金**（万 0.8 / 万 0.5），
 * 场外基金是**申购费**（0.15%，多数平台的一折费率）。
 * 申购费本来该按 `金额 - 金额/(1+费率)` 算，这里和佣金统一成 `金额 × 费率` ——
 * 整体差相对值 0.0002%，而全库的成本结转都建在 `金额 × 费率` 上，单独破一处会更乱。
 */
export function rateOf(accounts: Account[], id: AccountId): number {
  const own = findAccount(accounts, id)?.feeRate;
  if (Number.isFinite(own)) return own as number;
  // 默认值是施工时就有的数：股票 0.00008（万 0.8）、ETF 0.00005（万 0.5）。最低佣金见 MIN_COMMISSION。
  const kind = kindOf(accounts, id);
  if (kind === 'fund') return 0.0015;
  return kind === 'etf' ? 0.00005 : 0.00008;
}

/**
 * 一笔委托的佣金。费率算出来低于最低佣金时按下限收。
 *
 * 下限放在这里而不是调用方，是因为所有费用计算都从这走：store 落库（`src/store/modules/invest.ts:355`）、
 * 交易试算面板、CSV 导入的回落（`src/utils/ledger.ts:119`）、台账手填的默认值
 * （`src/pages/plan/components/TransactionLedger.vue:315`）。放这里四处一起生效，
 * 只在 UI 里加下限会导致预览和实际扣款不是一个数。
 */
export function feeOf(accounts: Account[], id: AccountId, amount: number): number {
  if (!(amount > 0)) return 0;
  return Math.max(amount * rateOf(accounts, id), minCommissionOf(accounts, id));
}

export function nameTaken(accounts: Account[], name: string, exceptId?: AccountId): boolean {
  const key = name.trim();
  return accounts.some((a) => a.id !== exceptId && a.name.trim() === key);
}

/**
 * 新账户 id。不做「股票→gupiao」这类拼音映射：id 是内部标识，用户看到的是 name，
 * 而 `acct_3` 既唯一又不依赖不存在的拼音表。
 */
export function makeAccountId(accounts: Account[]): AccountId {
  const used = new Set(accounts.map((a) => a.id));
  let n = accounts.length + 1;
  while (used.has(`acct_${n}`)) n += 1;
  return `acct_${n}`;
}

/**
 * 老数据里 id 就是性质（`'etf'`），新数据里 id 随机，所以只能靠前缀猜。
 * `etf` 必须排在 `fund` 前面判：「ETF 联接基金」这类名字两边都沾，场内那套才是对的。
 */
export function guessKind(id: AccountId): AccountKind {
  if (/etf/i.test(id)) return 'etf';
  if (/fund|公募|场外|基金/i.test(id)) return 'fund';
  return 'stock';
}

/**
 * 把 id 解析成注册表里真实存在的账户。
 *
 * `'all'`/空值（事件和简报说的是全市场，不是某个桶）落到第一个同性质的账户。
 * 先按 id 精确匹配，再按名字，最后按性质 —— 免得两个股票桶时随机落错。
 */
export function matchAccount(accounts: Account[], raw?: string): AccountId {
  const list = accounts.length ? accounts : defaultAccounts();
  const want = String(raw ?? '').trim();
  const byId = list.find((a) => a.id === want);
  if (byId) return byId.id;
  const byName = list.find((a) => a.name === want);
  if (byName) return byName.id;
  const kind = guessKind(want);
  return (list.find((a) => a.kind === kind) ?? list[0]).id;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * 把任意来源的注册表归一化：SQL、备份文件、本机老数据、未来版本。
 *
 * 老格式没有账户注册表，但**持仓和账本的 account 字段一直在**，所以 hints 里
 * 「出现过」的账户一个都不能丢：被丢掉账户，持仓会从所有面板上消失。
 * 也正是靠这里，未知账户能自己长出来（老备份 / 手改过的 JSON）。
 */
export function normalizeAccounts(raw: unknown, hints: string[] = []): Account[] {
  const out: Account[] = [];
  const ids = new Set<AccountId>();

  if (Array.isArray(raw)) {
    for (const r of raw) {
      if (!r || typeof r !== 'object') continue;
      const row = r as Record<string, unknown>;
      const rawId = str(row.id);
      const id = /^[\w.-]{1,32}$/.test(rawId) ? rawId : str(row.name).trim();
      // 同一 id 出现两次时保留先出现的：archiveAccount 打在副本上也比撞车好
      if (!id || ids.has(id)) continue;
      const name = str(row.name).trim() || id;
      if (id === 'fund' && name === RETIRED_FUND_NAME) continue;
      ids.add(id);
      const kind: AccountKind =
        row.kind === 'fund' ? 'fund' : row.kind === 'etf' ? 'etf' : row.kind === 'stock' ? 'stock' : guessKind(id);
      const acc: Account = { id, name, kind };
      const rate = row.feeRate;
      if (typeof rate === 'number' && Number.isFinite(rate) && rate >= 0) acc.feeRate = rate;
      if (row.archived === true) acc.archived = true;
      out.push(acc);
    }
  }

  if (!out.length) {
    out.push(...defaultAccounts());
    // 默认表的 id 也得登记，否则 hints 会把 stock/etf 再补一遍（变成归档的重复账户）
    for (const a of out) ids.add(a.id);
  }
  /*
   * 默认账户要给**已有注册表**补上。只靠上面那条 `!out.length` 不够：老用户的注册表非空，
   * 永远走不到那里，新加的默认账户就只对全新安装生效，界面上永远看不到它。
   * 按 id 补不会把用户收起来的账户翻出来 —— 归档只是打标记，行还在表里。
   */
  for (const d of defaultAccounts()) {
    if (ids.has(d.id)) continue;
    ids.add(d.id);
    out.push({ ...d });
  }
  // 注册表里没登记的账户会被补成「归档」——它往往还留着持仓，收起来比藏起来诚实
  for (const hint of hints) {
    const id = String(hint ?? '');
    if (!id || ids.has(id)) continue;
    ids.add(id);
    out.push({ id, name: id, kind: guessKind(id), archived: true });
  }
  return out;
}
