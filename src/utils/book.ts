export interface BookRow {
  code: string;
  name: string;
  quantity: number;
  cost: number;
  tag?: string;
  marketValue: number | null;
  pnl: number | null;
  pnlPct: number | null;
  thesisId?: string;
  action?: string;
}

export interface ThesisLite {
  id: string;
  status: string;
  title: string;
  code: string;
}
export interface JournalLite {
  date: string;
}
export interface TodoLite {
  account?: string;
  name: string;
  reason: string;
  status: string;
  side: string;
}

const yuan = (n: number) => Math.round(n * 100) / 100;

export function summarize(rows: BookRow[], cash: number) {
  const cost = yuan(rows.reduce((s, r) => s + r.cost * r.quantity, 0));
  if (!rows.length) {
    return { cost: 0, mv: 0, pnl: 0, pnlPct: 0, cash, pos: 0, cashPct: cash > 0 ? 1 : 0 };
  }
  if (rows.every((r) => r.marketValue == null)) {
    return {
      cost,
      mv: null as number | null,
      pnl: null as number | null,
      pnlPct: null as number | null,
      cash,
      pos: null as number | null,
      cashPct: null as number | null,
    };
  }
  const mv = yuan(rows.reduce((s, r) => s + (r.marketValue ?? 0), 0));
  const pnl = yuan(mv - cost);
  const total = mv + cash;
  const pos = total > 0 ? mv / total : 0;
  return { cost, mv, pnl, pnlPct: cost > 0 ? pnl / cost : null, cash, pos, cashPct: 1 - pos };
}

export function allocation(rows: BookRow[], cash: number, targets: { code: string; targetWeight: number }[] = []) {
  const parts = rows.filter((r): r is BookRow & { marketValue: number } => r.marketValue != null);
  const invested = parts.reduce((s, r) => s + r.marketValue, 0);
  const total = invested + Math.max(0, cash);
  if (!total) return [] as { name: string; pct: number; target: number | null }[];
  const map = new Map<string, number>();
  for (const p of parts) {
    const k = p.tag || p.name;
    map.set(k, (map.get(k) || 0) + p.marketValue);
  }
  const targetByTag = new Map<string, number>();
  for (const t of targets) {
    const row = rows.find((r) => r.code === t.code);
    const k = row?.tag || row?.name;
    if (!k) continue;
    targetByTag.set(k, (targetByTag.get(k) || 0) + t.targetWeight);
  }
  const targetSum = [...targetByTag.values()].reduce((s, v) => s + v, 0);
  const cashTarget = targetByTag.size ? Math.max(0, 1 - targetSum) : null;
  const items = [...map.entries()]
    .map(([name, v]) => ({ name, pct: v / total, target: targetByTag.get(name) ?? null }))
    .sort((a, b) => b.pct - a.pct);
  if (cash > 0 || cashTarget != null) {
    items.push({ name: '现金', pct: Math.max(0, cash) / total, target: cashTarget });
  }
  return items;
}

export function healthScore(rows: BookRow[], theses: ThesisLite[], journal: JournalLite[], cash: number) {
  const alloc = allocation(rows, cash);
  const hhi = alloc.reduce((s, a) => s + a.pct * a.pct, 0);
  const diversify = Math.round(Math.max(0, Math.min(100, (1 - hhi) * 130)));
  const covered = rows.filter((r) => r.thesisId && theses.some((t) => t.id === r.thesisId && t.status !== 'invalid'));
  const thesis = rows.length ? Math.round((covered.length / rows.length) * 100) : 100;
  const invested = rows.reduce((s, r) => s + (r.marketValue ?? 0), 0);
  const overweight = rows.some((r) => invested > 0 && (r.marketValue ?? 0) / invested > 0.25);
  const weekAgo = Date.now() - 7 * 86400000;
  const recent = journal.some((j) => !Number.isNaN(Date.parse(j.date)) && Date.parse(j.date) >= weekAgo);
  const discipline = overweight ? 68 : recent ? 92 : 80;
  const total = Math.round(diversify * 0.4 + thesis * 0.3 + discipline * 0.3);
  return { diversify, thesis, discipline, total };
}

export function risks(
  rows: BookRow[],
  theses: ThesisLite[],
  todos: TodoLite[],
  cash = 0,
  targets: { code: string; targetWeight: number }[] = [],
) {
  const items: { title: string; desc: string; hint: string; extra: string; tone: 'warn' | 'info' | 'ok' }[] = [];
  const invested = rows.reduce((s, r) => s + (r.marketValue ?? 0), 0);
  for (const a of allocation(rows, cash, targets)) {
    if (a.name === '现金' || a.target == null) continue;
    const gap = a.target - a.pct;
    if (Math.abs(gap) < 0.015) continue;
    const under = gap > 0;
    items.push({
      title: `${a.name}${under ? '低于' : '超过'}目标权重`,
      desc: `当前 ${(a.pct * 100).toFixed(1)}% · 目标 ${(a.target * 100).toFixed(1)}%`,
      hint: '调整',
      extra: `${under ? '+' : ''}${Math.round(gap * 100)}%`,
      tone: 'warn',
    });
  }
  for (const r of rows) {
    if (!invested || r.marketValue == null) continue;
    const w = r.marketValue / invested;
    if (w > 0.25) {
      items.push({
        title: `${r.name}超过单票上限`,
        desc: `当前 ${(w * 100).toFixed(1)}% · 上限 25%`,
        hint: '调整',
        extra: `-${Math.round((w - 0.25) * 100)}%`,
        tone: 'warn',
      });
    }
  }
  for (const r of rows) {
    const th = theses.find((t) => t.id === r.thesisId);
    if (th?.status === 'invalid' || th?.status === 'watch') {
      items.push({
        title: `${r.name}论点待复核`,
        desc: th.title,
        hint: th.status === 'invalid' ? '复核' : '耐心',
        extra: th.status === 'invalid' ? '证伪' : '等待',
        tone: 'info',
      });
    }
  }
  for (const t of todos.filter((x) => x.status === 'open').slice(0, 2)) {
    items.push({
      title: `${t.name}${t.side === 'buy' ? '待买' : '待卖'}`,
      desc: t.reason,
      hint: '待办',
      extra: t.side === 'buy' ? '买入' : '卖出',
      tone: 'info',
    });
  }
  if (cash > 0) {
    const rich = invested + cash > 0 && cash / (invested + cash) >= 0.15;
    items.push({
      title: rich ? '现金垫较充足' : '现金垫偏低',
      desc: `剩余可用资金 ¥${Math.round(cash).toLocaleString('zh-CN')}`,
      hint: rich ? '正常' : '关注',
      extra: '',
      tone: rich ? 'ok' : 'warn',
    });
  }
  if (!items.length) {
    items.push({
      title: '整体回撤仍在控制内',
      desc: '没有超配或失效论点',
      hint: '正常',
      extra: '',
      tone: 'ok',
    });
  }
  const pick = (['warn', 'info', 'ok'] as const).flatMap((tone) => items.filter((i) => i.tone === tone).slice(0, 1));
  const rest = items.filter((i) => !pick.includes(i));
  return [...pick, ...rest].slice(0, 3);
}

/** 组合净值：成本日 = 1，终点 = 1 + 浮动盈亏率。不是累计收益率。 */
export function sparkSeries(endPct: number, n = 30) {
  const ys: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const t = n === 1 ? 1 : i / (n - 1);
    const smooth = t * t * (3 - 2 * t);
    const wiggle = Math.sin(i * 1.7) * 0.01 * (1 - t);
    ys.push(+(1 + endPct * smooth + wiggle).toFixed(4));
  }
  ys[n - 1] = +(1 + endPct).toFixed(4);
  return ys;
}

export function shortCode(code: string) {
  return code.replace(/^(sh|sz|bj)/i, '');
}

export function healthNote(score: number, topName: string | undefined) {
  if (score >= 85) return '宽基为主，波动与集中度可控';
  if (score >= 70) return topName ? `集中度略高，关注 ${topName}` : '集中度略高，关注单一敞口';
  return '分散度偏低，先处理超配';
}
