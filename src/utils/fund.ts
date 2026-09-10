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

function rankDatas(json: unknown): unknown[] {
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
  const datas = rankDatas(json);
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
  const url = `/em/FundMNewApi/FundMNBaseInfo?FCODE=${encodeURIComponent(code)}&${APP}`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      if (json && json.Datas && typeof json.Datas === 'object') {
        return parseDetailBody(json);
      }
    }
  } catch {
    // try sample fallback
  }

  // fallback to statistical.csv sample
  const { loadSample } = await import('./fund-model');
  const all = await loadSample().catch(() => []);
  const found = all.find((f) => f.code === code);
  if (found) {
    return {
      code: found.code,
      name: found.name,
      type: found.type,
      nav: null,
      day: null,
      week: null,
      month: null,
      month3: null,
      month6: null,
      year: found.yield,
      year3: null,
      ytd: null,
      drawdown: Math.abs(found.loss),
      stddev: found.vix,
      sharpe: null,
      manager: found.manager || '—',
      company: found.company || '—',
    };
  }
  throw new Error('未获取到该基金详情');
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
  try {
    const res = await fetch(
      `/em/FundMNewApi/FundMNHisNetList?FCODE=${encodeURIComponent(code)}&pageIndex=1&pageSize=${size}&${APP}`,
    );
    if (res.ok) {
      const pts = parseNavBody(await res.json());
      if (pts.length) return pts;
    }
  } catch {
    // network fallback
  }
  return [];
}

export interface GrowthPoint {
  date: string;
  value: number;
}

export function combineEqualNav(series: NavPoint[][]): GrowthPoint[] {
  const good = series.filter((s) => s.length >= 2);
  if (!good.length) return [];
  const maps = good.map((s) => new Map(s.map((p) => [p.date, p.nav])));
  const dates = [...new Set(good.flatMap((s) => s.map((p) => p.date)))].sort();
  let start = 0;
  while (start < dates.length && !maps.every((m) => m.has(dates[start]))) start += 1;
  if (start >= dates.length - 1) return [];
  const base = maps.map((m) => m.get(dates[start])!);
  const last = base.slice();
  const out: GrowthPoint[] = [];
  for (let i = start; i < dates.length; i++) {
    const d = dates[i];
    for (let j = 0; j < maps.length; j++) {
      const v = maps[j].get(d);
      if (v != null) last[j] = v;
    }
    const growth = last.reduce((s, n, j) => s + n / base[j], 0) / last.length;
    out.push({ date: d, value: Math.round((growth - 1) * 10000) / 100 });
  }
  return out;
}

export function periodReturn(points: GrowthPoint[], months: number): number | null {
  if (points.length < 2) return null;
  const end = points[points.length - 1];
  const t = Date.parse(`${end.date}T00:00:00`);
  if (!Number.isFinite(t)) return null;
  const cut = new Date(t);
  cut.setMonth(cut.getMonth() - months);
  const cutStr = `${cut.getFullYear()}-${String(cut.getMonth() + 1).padStart(2, '0')}-${String(cut.getDate()).padStart(2, '0')}`;
  const start = points.find((p) => p.date >= cutStr) ?? points[0];
  const a = 1 + start.value / 100;
  const b = 1 + end.value / 100;
  if (a <= 0) return null;
  return Math.round((b / a - 1) * 10000) / 100;
}

export const HIST_LABELS = ['<-2%', '-2~-1', '-1~0', '0~1', '1~2', '>2%'] as const;

function histBucket(d: number): number {
  if (d < -2) return 0;
  if (d < -1) return 1;
  if (d < 0) return 2;
  if (d < 1) return 3;
  if (d < 2) return 4;
  return 5;
}

export function dailyReturnHist(points: GrowthPoint[]) {
  const buckets = HIST_LABELS.map((label) => ({ label, n: 0 }));
  let up = 0;
  for (let i = 1; i < points.length; i++) {
    const a = 1 + points[i - 1].value / 100;
    const b = 1 + points[i].value / 100;
    if (a <= 0) continue;
    const d = (b / a - 1) * 100;
    if (d > 0) up += 1;
    buckets[histBucket(d)].n += 1;
  }
  return { buckets, up, days: Math.max(0, points.length - 1) };
}

export interface HoldingSlice {
  name: string;
  code: string;
  kind: '股票' | '债券';
  weight: number;
}

export function parsePositionBody(json: unknown): HoldingSlice[] {
  const d = (json as { Datas?: unknown }).Datas;
  if (!d || typeof d !== 'object') return [];
  const row = d as Record<string, unknown>;
  const out: HoldingSlice[] = [];
  const stocks = Array.isArray(row.fundStocks) ? row.fundStocks : [];
  for (const x of stocks) {
    if (!x || typeof x !== 'object') continue;
    const r = x as Record<string, unknown>;
    const name = String(r.GPJC ?? '').trim();
    const code = String(r.GPDM ?? '').trim();
    const w = num(r.JZBL);
    if (!name || w == null || w <= 0) continue;
    out.push({ name, code, kind: '股票', weight: w });
  }
  const bonds = Array.isArray(row.fundboods) ? row.fundboods : [];
  for (const x of bonds) {
    if (!x || typeof x !== 'object') continue;
    const r = x as Record<string, unknown>;
    const name = String(r.ZQMC ?? '').trim();
    const code = String(r.ZQDM ?? '').trim();
    const w = num(r.ZJZBL) ?? num(r.JZBL);
    if (!name || w == null || w <= 0) continue;
    out.push({ name, code, kind: '债券', weight: w });
  }
  return out;
}

export function mergePositions(bags: HoldingSlice[][]): HoldingSlice[] {
  if (!bags.length) return [];
  const w = 1 / bags.length;
  const map = new Map<string, HoldingSlice>();
  for (const bag of bags) {
    for (const p of bag) {
      const k = `${p.kind}:${p.code || p.name}`;
      const prev = map.get(k);
      const add = p.weight * w;
      if (prev) prev.weight += add;
      else map.set(k, { ...p, weight: add });
    }
  }
  return [...map.values()].sort((a, b) => b.weight - a.weight);
}

export async function fetchFundPosition(code: string): Promise<HoldingSlice[]> {
  // 上游只认裸 6 位：
  // 传 `of000001` 不报错，而是回一个空 Datas（实测 fundStocks=0），
  // 静默呈现成「这只基金没披露」—— 凡进 API 的码一律在边界处剥前缀，
  // 免得又变成「每个调用方都得记得剥」的约定。
  // 这里不 import utils/quote.ts 的 bareFundCode：quote.ts 反过来 import 本文件的
  // fetchFundDetail，会成环。前缀规则以 quote.ts 为准（两边同一个正则）。
  const bare = String(code ?? '')
    .trim()
    .toLowerCase()
    .replace(/^of/, '');
  const url = `/em/FundMNewApi/FundMNInverstPosition?FCODE=${encodeURIComponent(bare)}&${APP}`;
  let last = 'fund position empty';
  for (let i = 0; i < 2; i++) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`fund position http ${res.status}`);
      const rows = parsePositionBody(await res.json());
      if (rows.length) return rows;
      last = 'fund position empty';
    } catch (e) {
      last = e instanceof Error ? e.message : last;
    }
  }
  throw new Error(last);
}

export interface LookThroughRow {
  name: string;
  code: string;
  kind: '股票' | '债券';
  /** 穿透后占该基金账户总市值的百分比 */
  weight: number;
  /** 穿透后的金额（元） */
  value: number;
}

export interface LookThrough {
  rows: LookThroughRow[];
  /** 披露持仓覆盖到的基金市值比例（%）。季报只公布前十大重仓，覆盖不到 100% 是常态。 */
  coverage: number;
  /** 拿到披露数据的基金数 / 参与穿透的基金数 */
  done: number;
  total: number;
}

/**
 * 把多只基金的披露持仓按**市值加权**合成一张穿透表。
 *
 * 不能用 `mergePositions` 的等权合成：那是给 FOF 选品看「一篮子基金平均持了什么」的，
 * 而我实际投在每只基金上的钱不一样多 —— 等权会把 1000 元和 10 万元的持仓算成同等影响。
 *
 * 金额口径是 `该基金市值 × 该股占基金净值比`；分母是**参与穿透的基金市值合计**，
 * 所以 `weight` 说的是「这只股票占我基金仓位的百分之几」，不是它占某只基金的比例。
 *
 * `coverage` 必须如实算：拿不到披露数据的基金（停牌、新基金、接口挂了）市值照样进分母，
 * 于是覆盖度会相应变低 —— 不然用户会以为眼前这张表就是全部。
 */
export function lookThrough(bags: { value: number; positions: HoldingSlice[] }[]): LookThrough {
  const usable = bags.filter((b) => b.value > 0);
  const total = usable.reduce((s, b) => s + b.value, 0);
  const done = usable.filter((b) => b.positions.length > 0).length;
  if (!(total > 0)) return { rows: [], coverage: 0, done, total: usable.length };

  const map = new Map<string, LookThroughRow>();
  let covered = 0;
  for (const bag of usable) {
    for (const p of bag.positions) {
      if (!(p.weight > 0)) continue;
      const value = (bag.value * p.weight) / 100;
      covered += value;
      // 同一只标的可能既在 fundStocks 又在 fundboods（可转债），按 kind 分开记
      const key = `${p.kind}:${p.code || p.name}`;
      const prev = map.get(key);
      if (prev) {
        prev.value += value;
        prev.weight += (value / total) * 100;
      } else {
        map.set(key, { name: p.name, code: p.code, kind: p.kind, weight: (value / total) * 100, value });
      }
    }
  }
  return {
    rows: [...map.values()].sort((a, b) => b.value - a.value),
    coverage: (covered / total) * 100,
    done,
    total: usable.length,
  };
}

/*
 * 披露持仓几乎不变（季报一年四期），所以按基金代码在内存里记住：切账户来回看、
 * 面板重新挂载时不重复打接口。与 `src/utils/sw-industry.ts` 的 memo 同一个做法。
 * 只缓存真拿到的结果 —— 接口偶发失败不能被记成「这只基金没有持仓」。
 */
const positionMemo = new Map<string, HoldingSlice[]>();

export async function cachedFundPosition(code: string): Promise<HoldingSlice[]> {
  const hit = positionMemo.get(code);
  if (hit) return hit;
  const rows = await fetchFundPosition(code).catch(() => [] as HoldingSlice[]);
  if (rows.length) positionMemo.set(code, rows);
  return rows;
}

/** 一次拿到多只基金的穿透表。传 `of` 前缀的码也行 —— 剥前缀在 fetchFundPosition 的边界处做（上游只认裸 6 位，传前缀会静默返回空表）。 */
export async function fetchFundLookThrough(funds: { code: string; value: number }[]): Promise<LookThrough> {
  const bags = await Promise.all(
    funds.map(async (f) => ({ value: f.value, positions: await cachedFundPosition(f.code) })),
  );
  return lookThrough(bags);
}

export function fmtPct(n: number | null): string {
  return n == null ? '—' : `${n.toFixed(2)}%`;
}
