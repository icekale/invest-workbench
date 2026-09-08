export interface FundRank {
  code: string;
  name: string;
  type: string;
  nav: number | null;
  day: number | null;
  week: number | null;
  month: number | null;
  month3: number | null;
  month6: number | null;
  year: number | null;
  year3: number | null;
  ytd: number | null;
  drawdown: number | null;
  stddev: number | null;
  sharpe: number | null;
}

export interface FundDetail extends FundRank {
  manager: string;
  company: string;
}

const APP = 'deviceid=Wap&plat=Wap&product=EFund&Version=6.5.5';
const TYPES: Record<string, string> = {
  '001': '股票型',
  '002': '混合型',
  '003': '债券型',
  '004': '理财型',
  '005': '货币型',
  '006': 'QDII',
  '007': '保本型',
  '008': '指数型',
};

export function num(s: unknown): number | null {
  if (s == null) return null;
  const t = String(s).replace(/%/g, '').trim();
  if (!t || t === '--') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function isShareClass(code: string, name: string): boolean {
  return code.startsWith('96') || /[CH]$|后端/.test(name);
}

export function parseRankItem(row: Record<string, unknown>): FundRank | null {
  const code = String(row.FCODE ?? '').trim();
  const name = String(row.SHORTNAME ?? '').trim();
  if (!code || !name) return null;
  const ftype = String(row.FTYPE ?? '').trim();
  return {
    code,
    name,
    type: ftype && ftype !== '--' ? ftype : TYPES[String(row.FUNDTYPE ?? '')] || '其他',
    nav: num(row.DWJZ),
    day: num(row.RZDF),
    week: num(row.SYL_Z),
    month: num(row.SYL_Y),
    month3: num(row.SYL_3Y),
    month6: num(row.SYL_6Y),
    year: num(row.SYL_1N),
    year3: num(row.SYL_3N),
    ytd: num(row.SYL_JN),
    drawdown: num(row.MAXRETRA1),
    stddev: num(row.STDDEV1),
    sharpe: num(row.SHARP1),
  };
}

export function typeBucket(type: string): string {
  if (type.includes('股票')) return '股票';
  if (type.includes('混合')) return '混合';
  if (type.includes('债券') || type.includes('理财') || type.includes('货币')) return '债券';
  if (type.includes('指数')) return '指数';
  if (/QDII/i.test(type)) return 'QDII';
  return '其他';
}

/** 拾光研选三轴：收益↑ 波动↓ 回撤↓。东财 STDDEV1 是年化波动%，不能套其 OLS 的 Vix 系数。 */
export function researchScore(year: number | null, stddev: number | null, drawdown: number | null): number | null {
  if (year == null || stddev == null || drawdown == null || stddev <= 0 || drawdown <= 0) return null;
  const sharpeLike = year / stddev;
  const calmar = year / drawdown;
  const ddVol = drawdown / stddev;
  // ponytail: tanh 压到 0-100；样本结构变了再调权重
  const s = 50 + 28 * Math.tanh(sharpeLike / 2) + 22 * Math.tanh(calmar / 2) - 18 * Math.tanh((ddVol - 1) * 2);
  return Math.round(Math.max(0, Math.min(100, s)));
}

export function riskNote(stddev: number | null, drawdown: number | null): string {
  if (stddev == null || drawdown == null || stddev <= 0) return '波动/回撤不足';
  const r = drawdown / stddev;
  if (r > 1.5) return '回撤相对波动偏大';
  if (r < 0.7) return '回撤相对波动可控';
  return '回撤与波动匹配';
}

function rankDatas(json: unknown): unknown {
  const body = json as { Datas?: unknown; ErrMsg?: string; ErrorMessage?: string };
  let datas = body.Datas;
  if (typeof datas === 'string') {
    try {
      datas = JSON.parse(datas);
    } catch {
      datas = null;
    }
  }
  if (!Array.isArray(datas)) throw new Error(String(body.ErrMsg || body.ErrorMessage || 'fund rank empty'));
  return datas;
}

export function parseRankBody(json: unknown): FundRank[] {
  const datas = rankDatas(json) as unknown[];
  const out: FundRank[] = [];
  for (const row of datas) {
    if (!row || typeof row !== 'object') continue;
    const item = parseRankItem(row as Record<string, unknown>);
    if (item && !isShareClass(item.code, item.name) && item.nav != null) out.push(item);
  }
  return out;
}

export function parseDetailBody(json: unknown): FundDetail {
  const d = (json as { Datas?: unknown }).Datas;
  if (!d || typeof d !== 'object') throw new Error('fund detail empty');
  const rank = parseRankItem(d as Record<string, unknown>);
  if (!rank) throw new Error('fund detail bad');
  const row = d as Record<string, unknown>;
  return {
    ...rank,
    manager: String(row.JJJL || '—'),
    company: String(row.JJGS || '—'),
  };
}

let rankCache: { at: number; rows: FundRank[] } | null = null;

async function rankFromSample(size: number): Promise<FundRank[]> {
  const { loadSample } = await import('./fund-model');
  const out: FundRank[] = [];
  for (const f of await loadSample()) {
    if (isShareClass(f.code, f.name)) continue;
    out.push({
      code: f.code,
      name: f.name,
      type: f.type,
      nav: null,
      day: null,
      week: null,
      month: null,
      month3: null,
      month6: null,
      year: f.yield,
      year3: null,
      ytd: null,
      drawdown: Math.abs(f.loss),
      stddev: null,
      sharpe: null,
    });
    if (out.length >= size) break;
  }
  return out;
}

export async function fetchFundRank(size = 80): Promise<FundRank[]> {
  if (rankCache && Date.now() - rankCache.at < 10 * 60_000) return rankCache.rows;
  const url = `/em/FundMNewApi/FundMNRank?FundType=0&SortColumn=SYL_1N&Sort=desc&pageIndex=1&pageSize=${size}&${APP}`;
  let last = 'fund rank empty';
  for (let i = 0; i < 2; i++) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`fund rank http ${res.status}`);
      const rows = parseRankBody(await res.json());
      if (rows.length) {
        rankCache = { at: Date.now(), rows };
        return rows;
      }
      last = 'fund rank empty';
    } catch (e) {
      last = e instanceof Error ? e.message : last;
    }
  }
  const fallback = await rankFromSample(size).catch(() => []);
  if (fallback.length) {
    rankCache = { at: Date.now(), rows: fallback };
    return fallback;
  }
  throw new Error(last);
}

export async function fetchFundDetail(code: string): Promise<FundDetail> {
  const res = await fetch(`/em/FundMNewApi/FundMNBaseInfo?FCODE=${encodeURIComponent(code)}&${APP}`);
  if (!res.ok) throw new Error(`fund detail http ${res.status}`);
  return parseDetailBody(await res.json());
}

export async function fetchFundDetails(codes: string[]): Promise<FundDetail[]> {
  const rows = await Promise.all(codes.map((c) => fetchFundDetail(c).catch(() => null)));
  return rows.filter((x): x is FundDetail => x != null);
}

export interface NavPoint {
  date: string;
  nav: number;
}

export function parseNavBody(json: unknown): NavPoint[] {
  const datas = (json as { Datas?: unknown }).Datas;
  if (!Array.isArray(datas)) throw new Error('fund nav empty');
  const out: NavPoint[] = [];
  for (const row of datas) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const date = String(r.FSRQ ?? '').trim();
    const nav = num(r.DWJZ);
    if (!date || nav == null) continue;
    out.push({ date, nav });
  }
  out.reverse();
  return out;
}

export async function fetchFundNav(code: string, size = 250): Promise<NavPoint[]> {
  const res = await fetch(
    `/em/FundMNewApi/FundMNHisNetList?FCODE=${encodeURIComponent(code)}&pageIndex=1&pageSize=${size}&${APP}`,
  );
  if (!res.ok) throw new Error(`fund nav http ${res.status}`);
  return parseNavBody(await res.json());
}

export function fmtPct(n: number | null): string {
  return n == null ? '—' : `${n.toFixed(2)}%`;
}
