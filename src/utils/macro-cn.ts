/**
 * 宏观数据源：东方财富 datacenter（经 /em-dc/ 反代）。
 * 免费替代万得 EDB 的三大支柱：PMI（景气）、CPI/PPI（物价剪刀差）、GDP（总量）。
 * 10Y 国债收益率暂无免费实时源，前端以「静态参考」标注。
 */
import { fetchOk, withRetry } from './http.ts';

export interface MacroSeries {
  code: string;
  name: string;
  unit: string;
  source: string;
  freq: string;
  updateDate: string;
  dates: string[]; // YYYY-MM
  values: number[];
  latestValue: number | null;
  previousValue: number | null;
  change: number | null;
}

type DcRow = Record<string, unknown>;

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_PREFIX = 'invest-em-dc:';

function cacheKey(report: string, pageSize: number) {
  return `${CACHE_PREFIX}${report}:${pageSize}`;
}

function readCached(report: string, pageSize: number): DcRow[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(report, pageSize));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; rows?: unknown };
    if (!parsed || Date.now() - Number(parsed.at || 0) > CACHE_TTL_MS || !Array.isArray(parsed.rows)) return null;
    return parsed.rows as DcRow[];
  } catch {
    return null;
  }
}

function writeCached(report: string, pageSize: number, rows: DcRow[]) {
  try {
    localStorage.setItem(cacheKey(report, pageSize), JSON.stringify({ at: Date.now(), rows }));
  } catch {
    /* quota */
  }
}

function dcUrl(report: string, pageSize = 12): string {
  return `/em-dc/api/data/v1/get?sortColumns=REPORT_DATE&sortTypes=-1&pageSize=${pageSize}&pageNumber=1&reportName=${report}&columns=ALL`;
}

async function dcRows(report: string, pageSize = 12, force = false): Promise<DcRow[]> {
  if (!force) {
    const hit = readCached(report, pageSize);
    if (hit) return hit;
  }
  const res = await withRetry(() => fetchOk(dcUrl(report, pageSize), { cache: 'no-store' }));
  const json = (await res.json()) as { result?: { data?: unknown } };
  const data = (json.result as { data?: unknown } | null)?.data;
  const rows = Array.isArray(data) ? (data as DcRow[]) : [];
  if (rows.length) writeCached(report, pageSize, rows);
  return rows;
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** REPORT_DATE "YYYY-MM-01 00:00:00" → "YYYY-MM" */
function monthOf(row: DcRow): string {
  const s = String(row.REPORT_DATE ?? '');
  const m = s.match(/^(\d{4}-\d{2})/);
  return m ? m[1] : s.slice(0, 7);
}

function buildSeries(
  meta: { code: string; name: string; unit: string; source: string; freq: string; key: string },
  rows: DcRow[],
): MacroSeries | null {
  const dates: string[] = [];
  const values: number[] = [];
  for (const row of rows) {
    const v = num(row[meta.key]);
    if (v == null) continue;
    dates.push(monthOf(row));
    values.push(v);
  }
  if (!dates.length) return null;
  // 东财返回按月倒序，翻成正序
  dates.reverse();
  values.reverse();
  const latestValue = values[values.length - 1];
  const previousValue = values.length > 1 ? values[values.length - 2] : null;
  const change =
    latestValue != null && previousValue != null ? Math.round((latestValue - previousValue) * 100) / 100 : null;
  const lastDate = dates[dates.length - 1] ?? '';
  return {
    code: meta.code,
    name: meta.name,
    unit: meta.unit,
    source: meta.source,
    freq: meta.freq,
    updateDate: lastDate,
    dates,
    values,
    latestValue,
    previousValue,
    change,
  };
}

export function parsePmi(rows: DcRow[]): MacroSeries | null {
  return buildSeries(
    { code: 'EM_PMI', name: '官方制造业PMI', unit: '%', source: '国家统计局', freq: '月', key: 'MAKE_INDEX' },
    rows,
  );
}

export function parseCpi(rows: DcRow[]): MacroSeries | null {
  return buildSeries(
    { code: 'EM_CPI', name: 'CPI:当月同比', unit: '%', source: '国家统计局', freq: '月', key: 'NATIONAL_SAME' },
    rows,
  );
}

export function parsePpi(rows: DcRow[]): MacroSeries | null {
  return buildSeries(
    { code: 'EM_PPI', name: 'PPI:当月同比', unit: '%', source: '国家统计局', freq: '月', key: 'BASE_SAME' },
    rows,
  );
}

export function parseGdp(rows: DcRow[]): MacroSeries | null {
  return buildSeries(
    { code: 'EM_GDP', name: 'GDP:不变价同比', unit: '%', source: '国家统计局', freq: '季', key: 'SUM_SAME' },
    rows,
  );
}

export async function fetchPmiSeries(pageSize = 12, force = false): Promise<MacroSeries | null> {
  return parsePmi(await dcRows('RPT_ECONOMY_PMI', pageSize, force));
}

export async function fetchCpiSeries(pageSize = 12, force = false): Promise<MacroSeries | null> {
  return parseCpi(await dcRows('RPT_ECONOMY_CPI', pageSize, force));
}

export async function fetchPpiSeries(pageSize = 12, force = false): Promise<MacroSeries | null> {
  return parsePpi(await dcRows('RPT_ECONOMY_PPI', pageSize, force));
}

export async function fetchGdpSeries(pageSize = 12, force = false): Promise<MacroSeries | null> {
  return parseGdp(await dcRows('RPT_ECONOMY_GDP', pageSize, force));
}

export function peekMacroBundle() {
  return {
    pmi: parsePmi(readCached('RPT_ECONOMY_PMI', 12) || []),
    cpi: parseCpi(readCached('RPT_ECONOMY_CPI', 12) || []),
    ppi: parsePpi(readCached('RPT_ECONOMY_PPI', 12) || []),
    gdp: parseGdp(readCached('RPT_ECONOMY_GDP', 12) || []),
  };
}

export async function fetchMacroBundle(force = false) {
  const settled = await Promise.allSettled([
    fetchPmiSeries(12, force),
    fetchCpiSeries(12, force),
    fetchPpiSeries(12, force),
    fetchGdpSeries(12, force),
  ]);
  const pick = (i: number) => {
    const r = settled[i];
    return r.status === 'fulfilled' ? r.value : null;
  };
  return { pmi: pick(0), cpi: pick(1), ppi: pick(2), gdp: pick(3) };
}
