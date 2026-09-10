/**
 * 宏观数据源：东方财富 datacenter（经 /em-dc/ 反代）。
 * PMI / CPI / PPI / GDP 四大支柱；社融全表走 /sync/afre（央行 xlsx）。
 */
import { afreToSeries, fetchAfre } from './afre.ts';
import { fetchOk, withRetry } from './http.ts';
import { marketGet, marketPut } from './market-cache';

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

const CACHE_PREFIX = 'invest-em-dc:';

function cacheKey(report: string, pageSize: number) {
  return `${CACHE_PREFIX}${report}:${pageSize}`;
}

function dcUrl(report: string, pageSize = 12): string {
  return `/em-dc/api/data/v1/get?sortColumns=REPORT_DATE&sortTypes=-1&pageSize=${pageSize}&pageNumber=1&reportName=${report}&columns=ALL`;
}

async function dcRows(report: string, pageSize = 12, force = false): Promise<DcRow[]> {
  if (!force) {
    const hit = await marketGet<DcRow[]>(cacheKey(report, pageSize));
    if (hit?.length) return hit;
  }
  const res = await withRetry(() => fetchOk(dcUrl(report, pageSize), { cache: 'no-store' }));
  const json = (await res.json()) as { result?: { data?: unknown } };
  const data = (json.result as { data?: unknown } | null)?.data;
  const rows = Array.isArray(data) ? (data as DcRow[]) : [];
  if (rows.length) marketPut(cacheKey(report, pageSize), rows);
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

export async function peekMacroBundle() {
  const [pmi, cpi, ppi, gdp] = await Promise.all([
    marketGet<DcRow[]>(cacheKey('RPT_ECONOMY_PMI', 12)),
    marketGet<DcRow[]>(cacheKey('RPT_ECONOMY_CPI', 12)),
    marketGet<DcRow[]>(cacheKey('RPT_ECONOMY_PPI', 12)),
    marketGet<DcRow[]>(cacheKey('RPT_ECONOMY_GDP', 12)),
  ]);
  return {
    pmi: parsePmi(pmi || []),
    cpi: parseCpi(cpi || []),
    ppi: parsePpi(ppi || []),
    gdp: parseGdp(gdp || []),
  };
}

export function seriesToIndicator(s: MacroSeries): { name: string; value: string; status: string } {
  const value = s.latestValue == null ? '—' : `${s.latestValue}${s.unit}`;
  const ch = s.change == null ? '' : `${s.change >= 0 ? '+' : ''}${s.change}${s.unit}`;
  const status = [ch, s.updateDate].filter(Boolean).join(' · ');
  return { name: s.name, value, status };
}

export async function liveMacroIndicators(): Promise<Array<{ name: string; value: string; status: string }>> {
  let bundle = await peekMacroBundle();
  if (![bundle.pmi, bundle.cpi, bundle.gdp].some(Boolean)) {
    try {
      bundle = await fetchMacroBundle(false);
    } catch {
      /* 卡片稍后再拉 */
    }
  }
  let afre: MacroSeries | null = null;
  try {
    afre = afreToSeries(await fetchAfre('flow'));
  } catch {
    /* 社融可空 */
  }
  return [bundle.pmi, bundle.cpi, bundle.gdp, afre]
    .filter((s): s is MacroSeries => !!s && s.latestValue != null)
    .map(seriesToIndicator);
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
