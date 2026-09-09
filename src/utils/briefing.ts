import type {
  AccountId,
  BriefingStance,
  BriefingTodoDraft,
  DailyBriefing,
  MacroEvent,
  MacroIndicator,
  MacroWeather,
  TradeAlert,
  TradeSide,
  TradeTodo,
} from '../types/invest.ts';
import { formatCN } from './date.ts';
import { withRetry } from './http.ts';

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
  'stockNote, etfNote, risks（0-3 条字符串）,',
  'todos（0-3 条：account=stock|etf, code, name, side=buy|sell, quantity 数字, reason）。',
  'code 必须是事实包中出现过的代码，或空字符串。',
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
  indicators: MacroIndicator[];
  events: MacroEvent[];
  valuation: ValuationSlice[];
  holdings: HoldingSlice[];
  cash: { stock: number; etf: number };
  todos: TradeTodo[];
  alerts: TradeAlert[];
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
    }>;
  }>;
  openTodos: Array<{ name: string; code: string; side: string; reason: string }>;
  alerts: Array<{ code: string; type: string; title: string; level: string }>;
}

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00+08:00`);
  d.setDate(d.getDate() + 1);
  return formatCN(d);
}

function num(n: number | null | undefined): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

export function cacheKey(date: string): string {
  return `invest-briefing-${date}`;
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
  return s;
}

export function buildFactPack(input: FactPackInput): BriefingFactPack {
  const tomorrow = nextDay(input.date);
  const events = input.events
    .filter((e) => e.date === input.date || e.date === tomorrow)
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
  };
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
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
  return {
    date: today,
    headline,
    stance,
    stockNote: asString(o.stockNote),
    etfNote: asString(o.etfNote),
    risks: o.risks.map((r) => asString(r)).filter(Boolean),
    todos,
  };
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
      headers: { 'Content-Type': 'application/json' },
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
