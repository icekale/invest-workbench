import type { PriceScenario } from '@/types/invest';
import { normalizeCode } from '@/utils/quote';
import { SCENARIO_POOL } from '@/utils/scenario-pool';

export const SCENARIO_DEFAULTS = {
  bear: { growth: -0.05, multiple: 12 },
  base: { growth: 0.08, multiple: 15 },
  bull: { growth: 0.15, multiple: 18 },
};

export function scenarioPoolKey(code: string): string {
  const s = code.trim().toLowerCase();
  if (s.includes('hk')) {
    const d = s.replace(/\D/g, '');
    return d ? `hk${d.padStart(5, '0')}` : s;
  }
  return normalizeCode(s.replace(/\.(sh|sz|bj)$/i, ''));
}

export function impliedRef(last: number | null | undefined, multiple: number | null | undefined): number | null {
  if (last == null || last <= 0 || multiple == null || multiple <= 0) return null;
  return last / multiple;
}

/** 目标价 = 参考值 × (1+增长率) × 目标倍数 */
export function scenarioTarget(ref: number | null | undefined, growth: number, multiple: number): number | null {
  if (ref == null || ref <= 0 || !(multiple > 0)) return null;
  return Number((ref * (1 + growth) * multiple).toFixed(2));
}

export function scenarioUpside(last: number | null | undefined, target: number | null): number | null {
  if (last == null || last <= 0 || target == null) return null;
  return (target - last) / last;
}

export function fmtSignedPct(n: number | null): string {
  if (n == null) return '—';
  const p = n * 100;
  if (p < 0) return `(${Math.abs(p).toFixed(1)}%)`;
  return `${p.toFixed(1)}%`;
}

export function defaultScenario(code: string): PriceScenario {
  const pool = SCENARIO_POOL[scenarioPoolKey(code)];
  return {
    code,
    metric: pool?.metric ?? 'eps',
    ref: null,
    bear: { ...(pool?.bear ?? SCENARIO_DEFAULTS.bear) },
    base: { ...(pool?.base ?? SCENARIO_DEFAULTS.base) },
    bull: { ...(pool?.bull ?? SCENARIO_DEFAULTS.bull) },
    note: pool?.note ?? '',
  };
}

export function mergeScenario(code: string, saved?: PriceScenario): PriceScenario {
  const d = defaultScenario(code);
  if (!saved) return d;
  return {
    code,
    metric: saved.metric ?? d.metric,
    ref: saved.ref ?? null,
    bear: { ...d.bear, ...saved.bear },
    base: { ...d.base, ...saved.base },
    bull: { ...d.bull, ...saved.bull },
    note: saved.note || d.note,
  };
}
