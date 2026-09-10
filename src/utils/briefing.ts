import type {
  AccountId,
  BriefingCite,
  BriefingStance,
  BriefingTodoDraft,
  DailyBriefing,
  MacroEvent,
  MacroWeather,
  TradeAlert,
  TradeSide,
  TradeTodo,
} from '../types/invest.ts';
import { authHeader } from './cloud-sync.ts';
import { formatCN } from './date.ts';
import { withRetry } from './http.ts';
import { parsePosRange } from './position.ts';

export const BRIEFING_MODEL = 'gemini-3.8-flash-high';
export const FAIL_COOLDOWN_MS = 10 * 60 * 1000;
export const QUOTE_WAIT_MS = 8000;
const FAIL_AT_KEY = 'invest-briefing-fail-at';
const STANCES: BriefingStance[] = ['偏多', '中性', '谨慎', '防守'];

export const SYSTEM_PROMPT = [
  '你是投资研究工作台的晨会写手。只根据用户消息里的 JSON 事实包写研判。',
  '禁止使用训练记忆中的行情、新闻或公司基本面。',
  '数字必须来自事实包；没有的字段写「数据不足」，不许编造。',
  '只输出一个 JSON 对象，不要 markdown、不要代码围栏。',
  '字段：date（必须与事实包 date 相同）, headline, stance（偏多|中性|谨慎|防守）,',
  'suggestedStockPos, suggestedEtfPos（字符串，如 60% ~ 70%；基于事实包 weather 微调，无依据则原样抄写）,',
  'stockNote, etfNote, risks（0-3 条字符串）,',
  'todos（0-3 条：account=stock|etf, code, name, side=buy|sell, quantity 数字, reason）。',
  'code 必须是事实包中出现过的代码，或空字符串。',
  '持仓含 last（现价）、cost（成本）、baseTarget（基准目标价）、baseUpside（相对现价空间，小数）、industry（申万一级）。',
  'events 是未来7天会议，重大优先。industries 是产业催化。',
  'indicators 是 PMI/CPI/GDP/社融最新值，有则引用数字，没有则写数据不足。',
  'yesterdayStance 是昨日立场（偏多最松，防守最紧）；headline 或 notes 写清比昨天更紧/更松/持平，没有则写数据不足。',
  'stockNote/etfNote 必须点名空间最极端或行业最集中的持仓，禁止只写宏观套话。',
  '点名会议、估值、持仓时必须用事实包里的 title、name、code 原文。',
  '待办不得与事实包 openTodos 重复（同一 code+side），重复的不要输出。',
  '待办方向须与 stance 一致：偏多不要只卖，谨慎或防守不要只买。',
].join('');

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export interface HoldingSlice {
  account: AccountId;
  code: string;
  name: string;
  quantity: number;
  cost: number;
  marketValue: number | null;
  pnl: number | null;
  pnlPct: number | null;
  health: string;
  action: string;
  last: number | null;
  industry: string;
  baseTarget: number | null;
  baseUpside: number | null;
}

export interface IndustrySlice {
  name: string;
  heat: number;
  trend: string;
  catalyst: string;
  keyTargets?: Array<{ code: string; name?: string }>;
}

export interface ValuationSlice {
  name: string;
  code: string;
  pe: number;
  percentile: number;
  advice: string;
}

export interface FactPackInput {
  date: string;
  weather: MacroWeather;
  indicators: Array<{ name: string; value: string; status: string }>;
  events: MacroEvent[];
  valuation: ValuationSlice[];
  holdings: HoldingSlice[];
  cash: { stock: number; etf: number };
  todos: TradeTodo[];
  alerts: TradeAlert[];
  yesterdayStance: BriefingStance | null;
  industries: IndustrySlice[];
}

export interface BriefingFactPack {
  date: string;
  weather: {
    cycle: string;
    sentiment: string;
    suggestedStockPos: string;
    suggestedEtfPos: string;
  };
  indicators: Array<{ name: string; value: string; status: string }>;
  events: Array<{ date: string; title: string; level: string; impact: string }>;
  valuation: ValuationSlice[];
  accounts: Array<{
    id: AccountId;
    cash: number;
    marketValue: number;
    pnl: number;
    pnlPct: number;
    holdings: Array<{
      code: string;
      name: string;
      weight: number;
      pnlPct: number;
      health: string;
      action: string;
      last: number | null;
      cost: number;
      industry: string;
      baseTarget: number | null;
      baseUpside: number | null;
    }>;
  }>;
  openTodos: Array<{ name: string; code: string; side: string; reason: string }>;
  alerts: Array<{ code: string; type: string; title: string; level: string }>;
  yesterdayStance: BriefingStance | null;
  industries: Array<{ name: string; heat: number; trend: string; catalyst: string; codes: string[] }>;
}

const LEVEL_RANK: Record<string, number> = { 重大: 0, 关键: 1, 关注: 2 };

export function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00+08:00`);
  d.setDate(d.getDate() + days);
  return formatCN(d);
}

function r4(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 10000) / 10000;
}

function num(n: number | null | undefined): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

export function cacheKey(date: string): string {
  return `invest-briefing-v2-${date}`;
}

export function allowedCodes(pack: BriefingFactPack): Set<string> {
  const s = new Set<string>();
  for (const v of pack.valuation) {
    if (v.code) s.add(v.code);
  }
  for (const a of pack.accounts) {
    for (const h of a.holdings) {
      if (h.code) s.add(h.code);
    }
  }
  for (const t of pack.openTodos) {
    if (t.code) s.add(t.code);
  }
  for (const a of pack.alerts) {
    if (a.code) s.add(a.code);
  }
  for (const i of pack.industries) {
    for (const c of i.codes) {
      if (c) s.add(c);
    }
  }
  return s;
}

export function buildFactPack(input: FactPackInput): BriefingFactPack {
  const end = shiftDate(input.date, 7);
  const events = input.events
    .filter((e) => e.date >= input.date && e.date <= end)
    .sort((a, b) => {
      const lr = (LEVEL_RANK[a.level] ?? 9) - (LEVEL_RANK[b.level] ?? 9);
      return lr || a.date.localeCompare(b.date);
    })
    .slice(0, 8)
    .map((e) => ({ date: e.date, title: e.title, level: e.level, impact: e.impact }));

  const valuation = [...input.valuation]
    .sort((a, b) => Math.abs(b.percentile - 50) - Math.abs(a.percentile - 50))
    .slice(0, 8)
    .map((v) => ({
      name: v.name,
      code: v.code,
      pe: v.pe,
      percentile: v.percentile,
      advice: v.advice,
    }));

  const accounts: BriefingFactPack['accounts'] = (['stock', 'etf'] as AccountId[]).map((id) => {
    const rows = input.holdings.filter((h) => h.account === id);
    const mv = rows.reduce((s, h) => s + num(h.marketValue), 0);
    const cost = rows.reduce((s, h) => s + h.cost * h.quantity, 0);
    const pnl = rows.reduce((s, h) => s + num(h.pnl), 0);
    const picked = [...rows].sort((a, b) => Math.abs(num(b.pnlPct)) - Math.abs(num(a.pnlPct))).slice(0, 20);
    return {
      id,
      cash: input.cash[id],
      marketValue: mv,
      pnl,
      pnlPct: cost === 0 ? 0 : pnl / cost,
      holdings: picked.map((h) => ({
        code: h.code,
        name: h.name,
        weight: mv > 0 ? num(h.marketValue) / mv : 0,
        pnlPct: num(h.pnlPct),
        health: h.health,
        action: h.action,
        last: h.last,
        cost: h.cost,
        industry: h.industry,
        baseTarget: h.baseTarget,
        baseUpside: r4(h.baseUpside),
      })),
    };
  });

  return {
    date: input.date,
    weather: {
      cycle: input.weather.cycle,
      sentiment: input.weather.sentiment,
      suggestedStockPos: input.weather.suggestedStockPos,
      suggestedEtfPos: input.weather.suggestedEtfPos,
    },
    indicators: input.indicators.slice(0, 4).map((i) => ({ name: i.name, value: i.value, status: i.status })),
    events,
    valuation,
    accounts,
    openTodos: input.todos
      .filter((t) => t.status === 'open')
      .slice(0, 8)
      .map((t) => ({ name: t.name, code: t.code, side: t.side, reason: t.reason })),
    alerts: input.alerts.slice(0, 8).map((a) => ({
      code: a.code,
      type: a.type,
      title: a.title,
      level: a.level,
    })),
    yesterdayStance: input.yesterdayStance,
    industries: [...input.industries]
      .sort((a, b) => b.heat - a.heat)
      .slice(0, 6)
      .map((i) => ({
        name: i.name,
        heat: i.heat,
        trend: i.trend,
        catalyst: i.catalyst.slice(0, 80),
        codes: (i.keyTargets ?? [])
          .slice(0, 2)
          .map((t) => t.code)
          .filter(Boolean),
      })),
  };
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export function briefingBlob(b: Pick<DailyBriefing, 'headline' | 'stockNote' | 'etfNote' | 'risks' | 'todos'>): string {
  return [b.headline, b.stockNote, b.etfNote, ...b.risks, ...b.todos.map((t) => t.name + t.code + t.reason)].join('\n');
}

export function collectCites(
  b: Pick<DailyBriefing, 'headline' | 'stockNote' | 'etfNote' | 'risks' | 'todos'>,
  pack: BriefingFactPack,
): BriefingCite[] {
  const text = briefingBlob(b);
  const out: BriefingCite[] = [];
  const seen = new Set<string>();
  const add = (cite: BriefingCite) => {
    if (seen.has(cite.label) || out.length >= 6) return;
    seen.add(cite.label);
    out.push(cite);
  };
  for (const e of pack.events) {
    if (e.title.length >= 2 && text.includes(e.title)) add({ kind: 'event', label: `${e.date.slice(5)} ${e.title}` });
  }
  for (const v of pack.valuation) {
    if ((v.name.length >= 2 && text.includes(v.name)) || (v.code && text.includes(v.code))) {
      add({ kind: 'valuation', label: `${v.name} ${v.percentile}%分位` });
    }
  }
  const todoCodes = new Set(b.todos.map((t) => t.code).filter(Boolean));
  for (const a of pack.accounts) {
    for (const h of a.holdings) {
      const hit =
        todoCodes.has(h.code) || (h.code && text.includes(h.code)) || (h.name.length >= 2 && text.includes(h.name));
      if (!hit) continue;
      const up = h.baseUpside == null ? '' : ` 空间${h.baseUpside >= 0 ? '+' : ''}${(h.baseUpside * 100).toFixed(0)}%`;
      add({ kind: 'holding', label: `${h.name}${up}` });
    }
  }
  return out;
}

export function stanceConflicts(b: Pick<DailyBriefing, 'stance' | 'todos'>): string[] {
  const buys = b.todos.filter((t) => t.side === 'buy').length;
  const sells = b.todos.filter((t) => t.side === 'sell').length;
  if (b.stance === '偏多' && sells > 0 && buys === 0) return ['立场偏多，待办却全是卖'];
  if ((b.stance === '谨慎' || b.stance === '防守') && buys > 0 && sells === 0) {
    return [`立场${b.stance}，待办却全是买`];
  }
  return [];
}

function posField(v: unknown): string | undefined {
  const s = asString(v).trim();
  return parsePosRange(s) ? s : undefined;
}

export function weatherFromBriefing(
  b: Pick<DailyBriefing, 'headline' | 'stance' | 'suggestedStockPos' | 'suggestedEtfPos'>,
  prev?: MacroWeather | null,
  now = new Date(),
): MacroWeather {
  return {
    cycle: b.headline,
    sentiment: b.stance,
    suggestedStockPos: posField(b.suggestedStockPos) ?? prev?.suggestedStockPos ?? '',
    suggestedEtfPos: posField(b.suggestedEtfPos) ?? prev?.suggestedEtfPos ?? '',
    updatedAt: `今日 ${now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 晨会写入`,
  };
}

export function weatherMatchesBriefing(
  w: MacroWeather | null | undefined,
  b: Pick<DailyBriefing, 'headline' | 'stance' | 'suggestedStockPos' | 'suggestedEtfPos'>,
): boolean {
  if (!w) return false;
  if (w.cycle !== b.headline || w.sentiment !== b.stance) return false;
  if (posField(b.suggestedStockPos) && w.suggestedStockPos !== b.suggestedStockPos) return false;
  if (posField(b.suggestedEtfPos) && w.suggestedEtfPos !== b.suggestedEtfPos) return false;
  return true;
}

export function decorateBriefing(b: DailyBriefing, pack: BriefingFactPack): DailyBriefing {
  const seen = new Set<string>();
  const todos = b.todos.filter((t) => {
    const k = todoDraftKey(t);
    if (seen.has(k)) return false;
    if (pack.openTodos.some((o) => todoDraftKey(o) === k)) return false;
    seen.add(k);
    return true;
  });
  const next = { ...b, todos };
  return { ...next, cites: collectCites(next, pack), conflicts: stanceConflicts(next) };
}

export function parseBriefing(raw: unknown, pack: BriefingFactPack, today: string): DailyBriefing {
  if (!raw || typeof raw !== 'object') throw new Error('not object');
  const o = raw as Record<string, unknown>;
  const headline = asString(o.headline).trim();
  const stance = o.stance as BriefingStance;
  if (!headline) throw new Error('empty headline');
  if (asString(o.date) !== today) throw new Error('bad date');
  if (!STANCES.includes(stance)) throw new Error('bad stance');
  if (!Array.isArray(o.risks) || o.risks.length > 3) throw new Error('bad risks');
  if (!Array.isArray(o.todos) || o.todos.length > 3) throw new Error('bad todos');
  const codes = allowedCodes(pack);
  const todos: BriefingTodoDraft[] = o.todos.map((row) => {
    if (!row || typeof row !== 'object') throw new Error('bad todo');
    const t = row as Record<string, unknown>;
    const account = t.account as AccountId;
    const side = t.side as TradeSide;
    const code = asString(t.code);
    if (account !== 'stock' && account !== 'etf') throw new Error('bad account');
    if (side !== 'buy' && side !== 'sell') throw new Error('bad side');
    if (code && !codes.has(code)) throw new Error('unknown code');
    const quantity = num(typeof t.quantity === 'number' ? t.quantity : Number(t.quantity));
    return {
      account,
      code,
      name: asString(t.name),
      side,
      quantity,
      reason: asString(t.reason),
    };
  });
  return decorateBriefing(
    {
      date: today,
      headline,
      stance,
      stockNote: asString(o.stockNote),
      etfNote: asString(o.etfNote),
      risks: o.risks.map((r) => asString(r)).filter(Boolean),
      todos,
      suggestedStockPos: posField(o.suggestedStockPos),
      suggestedEtfPos: posField(o.suggestedEtfPos),
    },
    pack,
  );
}

export function parseModelContent(content: string, pack: BriefingFactPack, today: string): DailyBriefing {
  const trimmed = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  return parseBriefing(JSON.parse(trimmed), pack, today);
}

export function readCachedBriefing(storage: StorageLike, today: string): DailyBriefing | null {
  const raw = storage.getItem(cacheKey(today));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DailyBriefing;
    if (parsed?.date !== today || !parsed.headline) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedBriefing(storage: StorageLike, today: string, briefing: DailyBriefing): void {
  storage.setItem(cacheKey(today), JSON.stringify(briefing));
  storage.removeItem(FAIL_AT_KEY);
}

export function writeFailAt(storage: StorageLike, now: number): void {
  storage.setItem(FAIL_AT_KEY, String(now));
}

export function shouldSkipAutoFetch(storage: StorageLike, now: number): boolean {
  const raw = storage.getItem(FAIL_AT_KEY);
  if (!raw) return false;
  const at = Number(raw);
  if (!Number.isFinite(at)) return false;
  return now - at < FAIL_COOLDOWN_MS;
}

export function clearTodayCache(storage: StorageLike, today: string): void {
  storage.removeItem(cacheKey(today));
  storage.removeItem(FAIL_AT_KEY);
}

export function todoDraftKey(d: { code: string; name: string; side: string }): string {
  return `${d.side}:${d.code || d.name}`;
}

export function alreadyOpen(
  todos: Array<{ code: string; name: string; side: string; status: string }>,
  draft: { code: string; name: string; side: string },
): boolean {
  const key = todoDraftKey(draft);
  return todos.some((t) => t.status === 'open' && todoDraftKey(t) === key);
}

export async function requestBriefing(
  pack: BriefingFactPack,
  deps: { fetchImpl?: typeof fetch; today: string },
): Promise<DailyBriefing> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const res = await withRetry(async () => {
    const r = await fetchImpl('/llm/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
      body: JSON.stringify({
        model: BRIEFING_MODEL,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(pack) },
        ],
      }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r;
  });
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('empty model content');
  return parseModelContent(content, pack, deps.today);
}

export async function ensureTodayBriefing(opts: {
  pack: BriefingFactPack;
  storage: StorageLike;
  today: string;
  now?: number;
  force?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<{ status: 'ready' | 'fail'; briefing: DailyBriefing | null }> {
  const now = opts.now ?? Date.now();
  if (!opts.force) {
    const cached = readCachedBriefing(opts.storage, opts.today);
    if (cached) return { status: 'ready', briefing: cached };
    if (shouldSkipAutoFetch(opts.storage, now)) return { status: 'fail', briefing: null };
  } else {
    clearTodayCache(opts.storage, opts.today);
  }
  try {
    const briefing = await requestBriefing(opts.pack, { fetchImpl: opts.fetchImpl, today: opts.today });
    writeCachedBriefing(opts.storage, opts.today, briefing);
    return { status: 'ready', briefing };
  } catch {
    writeFailAt(opts.storage, now);
    return { status: 'fail', briefing: null };
  }
}
