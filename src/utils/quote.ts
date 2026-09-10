import type { Account, AccountId } from '@/types/invest';

import { kindOf } from './accounts.ts';
import { fetchFundDetail } from './fund.ts';
import { fetchOk, withRetry } from './http.ts';

export interface Quote {
  code: string;
  name: string;
  price: number;
  changePct: number;
  change?: number;
  lastClose?: number;
  pe?: number;
  pb?: number;
}

export interface HoldingInput {
  quantity: number;
  cost: number;
}

export interface HoldingNumbers {
  marketValue: number | null;
  pnl: number | null;
  pnlPct: number | null;
  dayPnl: number | null;
  dayPnlPct: number | null;
}

export function parseTencentBody(text: string): Map<string, Quote> {
  const out = new Map<string, Quote>();
  for (const chunk of text.split(';')) {
    const m = chunk.match(/v_([a-z]{2}\d+)=["']([^"']*)["']/i);
    if (!m) continue;
    const fields = m[2].split('~');
    const price = Number(fields[3]);
    const lastClose = Number(fields[4]);
    const change = Number(fields[31]);
    const changePct = Number(fields[32]);
    const pe = Number(fields[39]);
    const pb = Number(fields[46]);
    if (!Number.isFinite(price)) continue;
    out.set(m[1].toLowerCase(), {
      code: m[1].toLowerCase(),
      name: fields[1] || m[1],
      price,
      changePct: Number.isFinite(changePct) ? changePct : 0,
      change: Number.isFinite(change) ? change : Number.isFinite(lastClose) && lastClose > 0 ? price - lastClose : 0,
      lastClose: Number.isFinite(lastClose) ? lastClose : undefined,
      pe: Number.isFinite(pe) && pe > 0 ? pe : undefined,
      pb: Number.isFinite(pb) && pb > 0 ? pb : undefined,
    });
  }
  return out;
}

/**
 * 单只场外基金的行情。查不到官方净值就返回 `null` —— 不猜。
 * 拆成具名函数是因为错误分支要提前退出：写成数组回调里的裸 `return;` 会被 lint 拦下。
 */
async function oneOtcQuote(key: string): Promise<[string, Quote] | null> {
  // `FundMNBaseInfo` 一次就给了名字（SHORTNAME）、最新净值（DWJZ）和当日涨跌（RZDF）
  const detail = await fetchFundDetail(bareFundCode(key)).catch(() => null);
  const nav = detail?.nav;
  // 样例回退里的 nav 恒为 null，所以这里拿不到就是真拿不到，不会凭空造出一个价
  if (!nav || !(nav > 0)) return null;
  const pct = typeof detail?.day === 'number' ? detail.day : 0;
  const prev = pct > -100 ? nav / (1 + pct / 100) : null;
  return [
    key,
    {
      code: key,
      name: detail?.name || key,
      price: nav,
      changePct: pct,
      change: prev == null ? 0 : nav - prev,
      lastClose: prev ?? undefined,
    },
  ];
}

/**
 * 场外基金的「行情」：一天一个官方净值，收盘后才公布。
 *
 * 返回值故意做成和 `fetchQuotes` 同形的 `Map<string, Quote>`，这样 store 的 `enrich` 不用分叉 ——
 * 净值和市价在账面上都是一回事：`市值 = 价 × 份额`。取不到的行直接不进表，于是
 * `calcHolding` 看到的还是没有行情，不会拿 0 当价把浮亏算成 −100%。
 */
export async function fetchOtcQuotes(codes: string[]): Promise<Map<string, Quote>> {
  const otc = [...new Set(codes.filter(isOtcCode))];
  const out = new Map<string, Quote>();
  const pairs = await Promise.all(otc.map((key) => oneOtcQuote(key)));
  for (const pair of pairs) {
    if (pair) out.set(pair[0], pair[1]);
  }
  return out;
}

export function calcHolding(h: HoldingInput, q: Quote | undefined): HoldingNumbers {
  if (!q || !Number.isFinite(q.price)) {
    return { marketValue: null, pnl: null, pnlPct: null, dayPnl: null, dayPnlPct: null };
  }
  const yuan = (n: number) => Math.round(n * 100) / 100;
  const marketValue = yuan(q.price * h.quantity);
  const costValue = yuan(h.cost * h.quantity);
  const pnl = yuan(marketValue - costValue);
  const pnlPct = costValue === 0 ? null : pnl / costValue;
  const chg = typeof q.change === 'number' ? q.change : q.lastClose ? q.price - q.lastClose : 0;
  const dayPnl = yuan(chg * h.quantity);
  const dayPnlPct = q.changePct;
  return { marketValue, pnl, pnlPct, dayPnl, dayPnlPct };
}

/**
 * 场外基金代码前缀。
 *
 * `000001` 在行情里是**平安银行**（¥11.85），在场外基金里是**华夏成长**（净值 1.2620）——
 * 同一个 6 位码两个完全不同的东西，价格差一个数量级。所以场外基金一律带 `of` 前缀，
 * 与行情的 `sh/sz/bj` 彻底分家；不带前缀的 6 位码永远按行情解析，永远。
 * 这就是「不能把场外基金代码直接丢给 `fetchQuotes`」的原因：
 * 腾讯会爽快地拿平安银行的价格回你，界面上不报任何错，只是钱算错了。
 */
export const OTC_PREFIX = 'of';

export function isOtcCode(code: string): boolean {
  return /^of\d{6}$/.test(
    String(code ?? '')
      .trim()
      .toLowerCase(),
  );
}

/** 用户输入的 6 位场外基金码 → `of000001`。已带前缀的原样返回，认不出来就原样退回。 */
export function ofCode(raw: string): string {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (isOtcCode(s)) return s;
  const d = s.replace(/\D/g, '');
  return d.length === 6 ? `${OTC_PREFIX}${d}` : s;
}

/** `of000001` → `000001`：东财基金接口要的是裸 6 位码。 */
export function bareFundCode(code: string): string {
  return String(code ?? '')
    .trim()
    .toLowerCase()
    .replace(/^of/, '');
}

export function normalizeCode(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s) return '';
  // 场外基金自带命名空间：套上 sh/sz/bj 就变成股票代码了，那是静默错价
  if (isOtcCode(s)) return s;
  if (/^(?:sh|sz|bj)\d+$/.test(s)) return s;
  const d = s.replace(/\D/g, '');
  if (d.length !== 6) return s;
  if (/^[569]/.test(d)) return `sh${d}`;
  if (/^[0-3]/.test(d)) return `sz${d}`;
  if (/^[48]/.test(d)) return `bj${d}`;
  return s;
}

/**
 * 按账户性质归一化用户输入的代码。
 *
 * 同一个 `000001`，在股票账户里是平安银行（¥11.85），在公募基金账户里是华夏成长（净值 1.2620）。
 * 所以「输入码 → 落库码」这一步必须带上账户：场外补 `of`，场内补 `sh/sz/bj`。
 * 持仓录入、交易弹窗、机会池转待办都走这里 —— 以前三处各写各的，只有部分路径加了前缀，
 * 结果就是同一只基金在两个页面是两个代码。
 */
export function normalizeForAccount(accounts: Account[], account: AccountId, raw: string): string {
  return kindOf(accounts, account) === 'fund' ? ofCode(raw) : normalizeCode(raw);
}

/**
 * 场内走行情、场外走净值，一次拿全。
 *
 * 调用方不该自己分叉：`fetchQuotes` 是故意把 `of` 码滤掉的（挡静默错价），
 * 直接拿它查场外基金只会得到空表，再被当成「查不到这个代码」拒掉。
 */
export async function fetchAnyQuotes(codes: string[]): Promise<Map<string, Quote>> {
  const [listed, otc] = await Promise.all([
    fetchQuotes(codes).catch(() => new Map<string, Quote>()),
    fetchOtcQuotes(codes).catch(() => new Map<string, Quote>()),
  ]);
  otc.forEach((q, k) => listed.set(k, q));
  return listed;
}

export async function fetchQuotes(codes: string[]): Promise<Map<string, Quote>> {
  // 场外基金码一律不进场行情接口：`of000001` 腾讯不认；而剥掉前缀就变成平安银行了
  const uniq = [...new Set(codes.filter((c) => c && !isOtcCode(c)))];
  if (!uniq.length) return new Map();
  // 重试覆盖到读响应体：连接重置常发生在 body 读到一半时
  const text = await withRetry(async () => {
    const res = await fetchOk(`/qt/q=${uniq.join(',')}`);
    return new TextDecoder('gbk').decode(await res.arrayBuffer());
  });
  return parseTencentBody(text);
}
