export interface Quote {
  code: string;
  name: string;
  price: number;
  changePct: number;
  change?: number;
  lastClose?: number;
  pe?: number;
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
    if (!Number.isFinite(price)) continue;
    out.set(m[1].toLowerCase(), {
      code: m[1].toLowerCase(),
      name: fields[1] || m[1],
      price,
      changePct: Number.isFinite(changePct) ? changePct : 0,
      change: Number.isFinite(change) ? change : Number.isFinite(lastClose) && lastClose > 0 ? price - lastClose : 0,
      lastClose: Number.isFinite(lastClose) ? lastClose : undefined,
      pe: Number.isFinite(pe) && pe > 0 ? pe : undefined,
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

export function normalizeCode(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s) return '';
  if (/^(?:sh|sz|bj)\d+$/.test(s)) return s;
  const d = s.replace(/\D/g, '');
  if (d.length !== 6) return s;
  if (/^[569]/.test(d)) return `sh${d}`;
  if (/^[0-3]/.test(d)) return `sz${d}`;
  if (/^[48]/.test(d)) return `bj${d}`;
  return s;
}

export async function fetchQuotes(codes: string[]): Promise<Map<string, Quote>> {
  const uniq = [...new Set(codes.filter(Boolean))];
  if (!uniq.length) return new Map();
  const res = await fetch(`/qt/q=${uniq.join(',')}`);
  if (!res.ok) throw new Error(`quote http ${res.status}`);
  const text = new TextDecoder('gbk').decode(await res.arrayBuffer());
  return parseTencentBody(text);
}
