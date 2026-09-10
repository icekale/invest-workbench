import { fetchOk, withRetry } from './http.ts';

/** 中证官方 xls，浏览器不解。需要成分/权重时另接解析。 */
export function csiFile(code: string, kind: 'cons' | 'closeweight' | 'indicator') {
  const c = code.replace(/\D/g, '').padStart(6, '0');
  if (!/^\d{6}$/.test(c)) throw new Error('csi code');
  return `https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/file/autofile/${kind}/${c}${kind}.xls`;
}

export function cniHistoryUrl(code: string) {
  const c = code.replace(/\D/g, '').padStart(6, '0');
  if (!/^\d{6}$/.test(c)) throw new Error('cni code');
  return `https://www.cnindex.com.cn/sample-detail/download-history?indexcode=${c}`;
}

export function parseSinaBody(text: string) {
  const out = new Map<string, { code: string; name: string; price: number; changePct: number }>();
  for (const line of text.split(/[\n;]/)) {
    const m = line.match(/hq_str_([a-z]{2}\d+)="([^"]*)"/i);
    if (!m || !m[2]) continue;
    const fields = m[2].split(',');
    const price = Number(fields[3]);
    const prev = Number(fields[2]);
    if (!Number.isFinite(price) || price <= 0) continue;
    const changePct = Number.isFinite(prev) && prev !== 0 ? ((price - prev) / prev) * 100 : 0;
    const code = m[1].toLowerCase();
    out.set(code, { code, name: fields[0] || code, price, changePct });
  }
  return out;
}

export async function fetchSinaQuotes(codes: string[]) {
  const uniq = [...new Set(codes.filter(Boolean))];
  if (!uniq.length) return new Map();
  const text = await withRetry(async () => {
    const res = await fetchOk(`/sina/list=${uniq.join(',')}`);
    return new TextDecoder('gbk').decode(await res.arrayBuffer());
  });
  return parseSinaBody(text);
}

export interface TradeDay {
  date: string;
  open: boolean;
}

export function parseSzseMonth(json: unknown, year: number, month: number): TradeDay[] {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('szse month');
  }
  const data = (json as { data?: unknown }).data;
  if (!Array.isArray(data) || !data.length) throw new Error('szse calendar empty');
  const last = new Date(year, month, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  const expect = new Set(Array.from({ length: last }, (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`));
  const seen = new Set<string>();
  const out: TradeDay[] = [];
  for (const rec of data) {
    if (!rec || typeof rec !== 'object') continue;
    const row = rec as { jyrq?: unknown; jybz?: unknown };
    const date = String(row.jyrq ?? '');
    const flag = String(row.jybz ?? '');
    if (flag !== '0' && flag !== '1') throw new Error('szse calendar flag');
    if (!expect.has(date) || seen.has(date)) throw new Error('szse calendar date');
    seen.add(date);
    out.push({ date, open: flag === '1' });
  }
  if (seen.size !== expect.size) throw new Error('szse calendar incomplete');
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchTradeMonth(year: number, month: number): Promise<TradeDay[]> {
  const ym = `${year}-${String(month).padStart(2, '0')}`;
  // 只重试网络与 5xx；parseSzseMonth 的数据校验错误留在重试之外，不该重来
  const json = await withRetry(async () => {
    const res = await fetchOk(`/szse/api/report/exchange/onepersistenthour/monthList?month=${ym}`);
    return (await res.json()) as unknown;
  });
  return parseSzseMonth(json, year, month);
}
