import { authHeader, hasSyncCreds } from './cloud-sync';
import type { MacroSeries } from './macro-cn';
import { MARKET_TTL_MS, marketGet, marketPut } from './market-cache';

export interface AfreRow {
  month: string;
  afre_total: number;
  rmb_loans: number;
  fx_loans: number;
  entrusted_loans: number;
  trust_loans: number;
  undiscounted_bankers_acceptance: number;
  corporate_bonds: number;
  government_bonds: number;
  equity_financing: number;
  abs_by_depository: number;
  loans_written_off: number;
}

export async function fetchAfre(): Promise<AfreRow[]> {
  const hit = await marketGet<AfreRow[]>('pbc:afre', MARKET_TTL_MS);
  if (hit?.length) return hit;
  if (!hasSyncCreds()) throw new Error('未登录');
  const res = await fetch('/sync/afre', { headers: { Authorization: authHeader() } });
  if (!res.ok) throw new Error(`社融 ${res.status}`);
  const rows = (await res.json()) as AfreRow[];
  if (!Array.isArray(rows) || !rows.length) throw new Error('社融全表为空');
  marketPut('pbc:afre', rows, MARKET_TTL_MS);
  return rows;
}

export function afreToSeries(rows: AfreRow[]): MacroSeries | null {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => a.month.localeCompare(b.month));
  const values = sorted.map((r) => r.afre_total);
  const latest = values.at(-1) ?? null;
  const prev = values.length > 1 ? values.at(-2)! : null;
  return {
    code: 'PBC_AFRE',
    name: '社会融资规模增量',
    unit: '亿元',
    source: '人民银行',
    freq: '月',
    updateDate: sorted.at(-1)!.month,
    dates: sorted.map((r) => r.month),
    values,
    latestValue: latest,
    previousValue: prev,
    change: latest != null && prev != null ? latest - prev : null,
  };
}
