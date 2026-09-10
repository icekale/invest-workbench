/**
 * 账户注册表。
 *
 * 账户是「钱分开记的桶」，性质（`kind`）才是决定行为的东西：一只 ETF 装到哪个桶里，
 * 它每手还是 100 份、费率还是万 0.5。所以判断一律走 `kind`，`id` 只做标识。
 * 于是新建一个 `kind: 'stock'` 的「打新账户」自动拿到股数单位和万 0.8 的费率。
 */

import type { Account, AccountId, AccountKind } from '@/types/invest';

export function defaultAccounts(): Account[] {
  return [
    { id: 'stock', name: '股票账户', kind: 'stock' },
    { id: 'etf', name: 'ETF 账户', kind: 'etf' },
  ];
}

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

export function isFund(accounts: Account[], id: AccountId): boolean {
  return kindOf(accounts, id) === 'etf';
}

/** 单笔费率。账户自带 `feeRate` 优先，否则按性质取默认值。 */
export function rateOf(accounts: Account[], id: AccountId): number {
  const own = findAccount(accounts, id)?.feeRate;
  // 默认值是施工时就有的数：股票 0.00008（万 0.8）、基金 0.00005（万 0.5），无最低佣金。
  return Number.isFinite(own) ? (own as number) : isFund(accounts, id) ? 0.00005 : 0.00008;
}

export function feeOf(accounts: Account[], id: AccountId, amount: number): number {
  return Math.max(0, amount * rateOf(accounts, id));
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

/** 老数据里 id 就是性质（`'etf'`），新数据里 id 随机，所以只能靠前缀猜。 */
export function guessKind(id: AccountId): AccountKind {
  return /etf|fund|基金/i.test(id) ? 'etf' : 'stock';
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
  const kind = /etf|fund|基金/i.test(want) ? 'etf' : 'stock';
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
      ids.add(id);
      const kind: AccountKind = row.kind === 'etf' ? 'etf' : row.kind === 'stock' ? 'stock' : guessKind(id);
      const acc: Account = { id, name: str(row.name).trim() || id, kind };
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
  // 注册表里没登记的账户会被补成「归档」——它往往还留着持仓，收起来比藏起来诚实
  for (const hint of hints) {
    const id = String(hint ?? '');
    if (!id || ids.has(id)) continue;
    ids.add(id);
    out.push({ id, name: id, kind: guessKind(id), archived: true });
  }
  return out;
}
