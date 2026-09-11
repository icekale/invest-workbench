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
 * 用户输入的代码 → 场内行情代码（`sh/sz/bj` 前缀）。
 *
 * `000001` 在行情里是**平安银行**（¥11.85）。只认**纯 6 位数字**才补前缀；
 * 带字母的原样退回，绝不剥掉字母再猜 —— 已退役的场外码 `of000001` 一旦被剥成 `000001`
 * 就成平安银行了，价格差一个数量级，界面上不报任何错，只是钱算错了。
 */
export function normalizeCode(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s) return '';
  if (/^(?:sh|sz|bj)\d+$/.test(s)) return s;
  if (!/^\d{6}$/.test(s)) return s;
  if (/^[569]/.test(s)) return `sh${s}`;
  if (/^[0-3]/.test(s)) return `sz${s}`;
  if (/^[48]/.test(s)) return `bj${s}`;
  return s;
}

/**
 * 取行情，**失败当空表**（不抛）。
 *
 * 持仓录入、批量校准、CSV 导入都要「有多少显示多少」：一只票查不到不该让整批失败，
 * 所以这里把 `fetchQuotes` 的异常收成空表，调用方看到的就是「没有行情」。
 */
export async function fetchAnyQuotes(codes: string[]): Promise<Map<string, Quote>> {
  return fetchQuotes(codes).catch(() => new Map<string, Quote>());
}

export async function fetchQuotes(codes: string[]): Promise<Map<string, Quote>> {
  const uniq = [...new Set(codes.filter(Boolean))];
  if (!uniq.length) return new Map();
  // 重试覆盖到读响应体：连接重置常发生在 body 读到一半时
  const text = await withRetry(async () => {
    const res = await fetchOk(`/qt/q=${uniq.join(',')}`);
    return new TextDecoder('gbk').decode(await res.arrayBuffer());
  });
  return parseTencentBody(text);
}
