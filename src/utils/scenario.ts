export const FAIR_PE = 15;

export const SCENARIO_DEFAULTS = {
  bear: { growth: -0.05, multiple: 12 },
  base: { growth: 0.08, multiple: 15 },
  bull: { growth: 0.15, multiple: 18 },
};

export function scenarioTarget(
  last: number | null | undefined,
  pe: number | null | undefined,
  growth: number,
  multiple: number,
): number | null {
  if (last == null || last <= 0) return null;
  const baseMul = pe && pe > 0 ? pe : FAIR_PE;
  const mul = multiple > 0 ? multiple : baseMul;
  return Number((last * (1 + growth) * (mul / baseMul)).toFixed(2));
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
