export function parsePosRange(s: string | null | undefined): { lo: number; hi: number } | null {
  if (!s) return null;
  const nums = [...s.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => Number(m[1]));
  if (!nums.length) return null;
  return { lo: Math.min(...nums), hi: Math.max(...nums) };
}

export function accountPos(mv: number, cash: number): number | null {
  const nav = mv + cash;
  if (!(nav > 0)) return null;
  return mv / nav;
}

export function posStatus(
  actual: number | null,
  range: { lo: number; hi: number } | null,
  slack = 1,
): 'ok' | 'over' | 'under' | null {
  if (actual == null || !range) return null;
  const p = actual * 100;
  if (p > range.hi + slack) return 'over';
  if (p < range.lo - slack) return 'under';
  return 'ok';
}

export function fmtPct(n: number | null): string {
  if (n == null) return '—';
  return `${Math.round(n * 100)}%`;
}
