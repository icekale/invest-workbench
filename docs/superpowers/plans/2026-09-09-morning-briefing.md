# 晨会研判 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每天第一次打开「研究与决策」时，用 Pinia 已有事实请求 `/llm` 生成一张晨会研判卡，待办草稿需确认才写入。

**Architecture:** 纯函数在 `src/utils/briefing.ts`（组包、校验、缓存、请求）。`BriefingCard.vue` 只渲染。`index.vue` 负责等待行情并触发。Caddy `/llm*` 反代到现成 OpenAI 兼容代理，密钥不出 VPS。不进 SQLite 账本。

**Tech Stack:** 现有 Vue 3 + Pinia + TypeScript。检查脚本沿用 `node --experimental-strip-types scripts/check-*.ts`。不新增依赖、不加测试框架、不加聊天页。

**Spec:** `docs/superpowers/specs/2026-09-09-morning-briefing-design.md`

---

## File map

| 路径 | 职责 |
|---|---|
| `src/types/invest.ts` | `BriefingStance` / `BriefingTodoDraft` / `DailyBriefing` |
| `src/utils/briefing.ts` | 事实包、校验、缓存、`POST /llm/v1/chat/completions` |
| `scripts/check-briefing.ts` | 不接真模型的自检 |
| `src/pages/research/state.ts` | 估值列表 + 研判卡状态 |
| `src/pages/research/BriefingCard.vue` | 卡片 UI |
| `src/pages/research/index.vue` | 宏观 pane 顶部挂卡片；进入页面时触发 |
| `src/pages/research/ValuationRadar.vue` | 把估值列表写入 `state.ts` |
| `src/pages/research/research.less` | 卡片样式 |
| `package.json` | `check:briefing` |
| `vite.config.ts` | 本地 `/llm` 代理 |
| `DEPLOY.md` | `/llm` 行 |

`TradeTodo` 没有日期字段。规格里「同一自然日 code+side 去重」落实为：任意 `status=open` 且 `code+side` 相同（code 为空则 `name+side`）则跳过。

估值不在 Pinia。第一期允许事实包 `valuation` 为空；`ValuationRadar` 若已写入 `state.ts` 则带上。不为研判单独打万得/东财。

---

### Task 1: 类型 + 失败的自检

**Files:**
- Modify: `src/types/invest.ts`（文件末尾、`ExecuteTradeResult` 之后）
- Create: `scripts/check-briefing.ts`
- Modify: `package.json`（scripts 里 `check:macro` 旁加一行）

- [ ] **Step 1: 追加类型**

在 `src/types/invest.ts` 末尾追加：

```ts
export type BriefingStance = '偏多' | '中性' | '谨慎' | '防守';

export interface BriefingTodoDraft {
  account: AccountId;
  code: string;
  name: string;
  side: TradeSide;
  quantity: number;
  reason: string;
}

export interface DailyBriefing {
  date: string;
  headline: string;
  stance: BriefingStance;
  stockNote: string;
  etfNote: string;
  risks: string[];
  todos: BriefingTodoDraft[];
}
```

- [ ] **Step 2: 写自检（此时会失败，因为还没有 `briefing.ts`）**

创建 `scripts/check-briefing.ts`：

```ts
import assert from 'node:assert/strict';

import {
  alreadyOpen,
  buildFactPack,
  cacheKey,
  parseBriefing,
  parseModelContent,
  readCachedBriefing,
  shouldSkipAutoFetch,
  writeCachedBriefing,
  writeFailAt,
  type FactPackInput,
} from '../src/utils/briefing.ts';

const today = '2026-09-09';

const input: FactPackInput = {
  date: today,
  weather: {
    cycle: '复苏前期',
    sentiment: '中性',
    suggestedStockPos: '60% ~ 70%',
    suggestedEtfPos: '75% ~ 85%',
    updatedAt: today,
  },
  indicators: [{ name: 'PMI', value: '49.4', status: '弱势筑底', hint: '', id: 'pmi', theme: 'warning' }],
  events: Array.from({ length: 10 }, (_, i) => ({
    id: `e${i}`,
    date: i === 0 ? today : '2026-09-10',
    title: `会议${i}`,
    category: '宏观政策',
    level: '关注',
    impact: '影响',
    beneficiaries: [],
    body: 'http://news.example/secret-body-should-not-leak',
  })),
  valuation: [
    { name: '沪深300', code: 'sh000300', pe: 13.58, percentile: 62, advice: '中性持有' },
    { name: '中证2000', code: 'sh000852', pe: 28, percentile: 15, advice: '低估' },
  ],
  holdings: [
    {
      account: 'etf',
      code: 'sh510300',
      name: '沪深300ETF',
      quantity: 1000,
      cost: 4,
      marketValue: 4500,
      pnl: 500,
      pnlPct: 0.125,
      health: 'healthy',
      action: 'hold',
    },
  ],
  cash: { stock: 10000, etf: 20000 },
  todos: [{ id: 'td1', account: 'etf', code: 'sh510300', name: '沪深300ETF', side: 'sell', quantity: 0, reason: '旧', status: 'open' }],
  alerts: [{ id: 'a1', code: 'sh510300', name: '沪深300ETF', account: 'etf', type: 'take_profit', level: 'info', title: '止盈', detail: '', suggestedAction: 'reduce', triggerTime: today }],
};

const pack = buildFactPack(input);
assert.equal(pack.date, today);
assert.ok(pack.events.length <= 8);
assert.equal(pack.valuation[0].code, 'sh000852'); // |15-50| > |62-50|，极端项在前
assert.equal(JSON.stringify(pack).includes('http://news.example'), false);
assert.equal(JSON.stringify(pack).includes('secret-body'), false);
assert.equal(pack.accounts[0].id, 'etf');
assert.ok(pack.accounts[0].holdings[0].weight > 0);

const ok = parseBriefing(
  {
    date: today,
    headline: '中性持有，兑现部分300',
    stance: '中性',
    stockNote: '数据不足',
    etfNote: '沪深300分位62%，可减',
    risks: ['外部冲击'],
    todos: [{ account: 'etf', code: 'sh510300', name: '沪深300ETF', side: 'sell', quantity: 0, reason: '分位偏高' }],
  },
  pack,
  today,
);
assert.equal(ok.todos.length, 1);

assert.throws(() => parseBriefing({ ...ok, date: '2020-01-01' }, pack, today));
assert.throws(() => parseBriefing({ ...ok, todos: [ok.todos[0], ok.todos[0], ok.todos[0], ok.todos[0]] }, pack, today));
assert.throws(() =>
  parseBriefing(
    { ...ok, todos: [{ account: 'etf', code: 'sz999999', name: '假', side: 'buy', quantity: 0, reason: 'x' }] },
    pack,
    today,
  ),
);
assert.throws(() => parseBriefing({ ...ok, stance: '狂喜' }, pack, today));
assert.throws(() => parseBriefing({ ...ok, headline: '' }, pack, today));

const emptyCode = parseBriefing(
  {
    ...ok,
    todos: [{ account: 'stock', code: '', name: '仓位', side: 'buy', quantity: 0, reason: '现金多' }],
  },
  pack,
  today,
);
assert.equal(emptyCode.todos[0].code, '');

const fenced = parseModelContent(
  '```json\n' + JSON.stringify(ok) + '\n```',
  pack,
  today,
);
assert.equal(fenced.headline, ok.headline);

assert.equal(cacheKey(today), 'invest-briefing-2026-09-09');

const mem = new Map<string, string>();
const storage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => {
    mem.set(k, v);
  },
  removeItem: (k: string) => {
    mem.delete(k);
  },
};
writeCachedBriefing(storage, today, ok);
assert.equal(readCachedBriefing(storage, today)?.headline, ok.headline);
assert.equal(readCachedBriefing(storage, '2026-09-10'), null);

assert.equal(shouldSkipAutoFetch(storage, 1_000_000), false);
writeFailAt(storage, 1_000_000);
assert.equal(shouldSkipAutoFetch(storage, 1_000_000 + 60_000), true);
assert.equal(shouldSkipAutoFetch(storage, 1_000_000 + 11 * 60_000), false);

assert.equal(alreadyOpen(input.todos, ok.todos[0]), true);
assert.equal(alreadyOpen([], ok.todos[0]), false);

console.log('check-briefing ok');
```

`package.json` 的 `scripts` 增加：

```json
"check:briefing": "node --experimental-strip-types scripts/check-briefing.ts",
```

- [ ] **Step 3: 跑自检，确认失败**

```bash
npm run check:briefing
```

Expected: 失败，报找不到 `../src/utils/briefing.ts`。

- [ ] **Step 4: 实现 `src/utils/briefing.ts`**

创建 `src/utils/briefing.ts`（相对路径导入，方便 node 自检；类型用 `import type`）：

```ts
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
import { fetchOk, withRetry } from './http.ts';

export const BRIEFING_MODEL = 'grok-3';
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
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
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
  for (const v of pack.valuation) if (v.code) s.add(v.code);
  for (const a of pack.accounts) for (const h of a.holdings) if (h.code) s.add(h.code);
  for (const t of pack.openTodos) if (t.code) s.add(t.code);
  for (const a of pack.alerts) if (a.code) s.add(a.code);
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
  const res = await withRetry(() =>
    fetchOk('/llm/v1/chat/completions', {
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
    }),
  );
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
```

`http.ts` 的 `fetchOk` 用全局 `fetch`。`requestBriefing` 里当前 `fetchOk` **不会**走 `deps.fetchImpl`。改 `src/utils/http.ts` 会动公共路径，不要改。改成本文件内联：

把 `requestBriefing` 里的 `withRetry(() => fetchOk(...))` 换成：

```ts
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
```

并删掉 `import { fetchOk, withRetry }` 中的 `fetchOk`，只留 `withRetry`。

- [ ] **Step 5: 跑自检，确认通过**

```bash
npm run check:briefing
```

Expected: 打印 `check-briefing ok`。

- [ ] **Step 6: Commit**

```bash
git add src/types/invest.ts src/utils/briefing.ts scripts/check-briefing.ts package.json
git commit -m "feat: add morning briefing pack and parser"
```

---

### Task 2: 卡片 UI

**Files:**
- Create: `src/pages/research/BriefingCard.vue`
- Modify: `src/pages/research/research.less`（`.macro-weather-card` 之前插入）
- Modify: `src/pages/research/state.ts`
- 不要改 `MacroCompass.vue`：卡片挂在 `index.vue` 宏观 pane 顶部（Task 3），视觉仍在天气卡上方

- [ ] **Step 1: 扩展 `src/pages/research/state.ts`**

```ts
import { ref } from 'vue';

import type { DailyBriefing } from '@/types/invest';
import type { IndexValuationItem } from '@/utils/valuation';

export const bargainCount = ref(0);
export const macroState = ref<'never' | 'loading' | 'ok' | 'error'>('never');
export const valuationItems = ref<IndexValuationItem[]>([]);
export const briefing = ref<DailyBriefing | null>(null);
export const briefingStatus = ref<'idle' | 'loading' | 'ready' | 'fail'>('idle');
```

- [ ] **Step 2: 创建 `src/pages/research/BriefingCard.vue`**

```vue
<template>
  <t-card class="briefing-card">
    <div class="briefing-card__head">
      <div>
        <span class="briefing-card__title">今日晨会研判</span>
        <t-tag
          v-if="briefing && briefingStatus === 'ready'"
          size="small"
          variant="light"
          :theme="stanceTheme"
        >
          {{ briefing.stance }}
        </t-tag>
      </div>
      <t-button size="small" variant="outline" :loading="briefingStatus === 'loading'" @click="$emit('retry')">
        {{ briefingStatus === 'ready' ? '重新生成' : '重试' }}
      </t-button>
    </div>

    <div v-if="briefingStatus === 'loading'" class="briefing-card__muted">正在生成今日研判…</div>
    <div v-else-if="briefingStatus === 'fail' || !briefing" class="briefing-card__muted">今日研判未生成</div>
    <template v-else>
      <p class="briefing-card__headline">{{ briefing.headline }}</p>
      <div class="briefing-card__notes">
        <div><span>股票</span>{{ briefing.stockNote }}</div>
        <div><span>ETF</span>{{ briefing.etfNote }}</div>
      </div>
      <ul v-if="briefing.risks.length" class="briefing-card__risks">
        <li v-for="(r, i) in briefing.risks" :key="i">{{ r }}</li>
      </ul>
      <div v-for="(todo, i) in briefing.todos" :key="i" class="briefing-card__todo">
        <div>
          <strong>{{ todo.side === 'buy' ? '买' : '卖' }} {{ todo.name || todo.code || '未指定标的' }}</strong>
          <p>{{ todo.reason }}</p>
        </div>
        <t-button
          size="small"
          theme="primary"
          variant="outline"
          :disabled="written.has(todoKey(todo))"
          @click="$emit('commit', todo)"
        >
          {{ written.has(todoKey(todo)) ? '已写入' : '写入待办' }}
        </t-button>
      </div>
    </template>
  </t-card>
</template>
<script setup lang="ts">
import { computed } from 'vue';

import type { BriefingTodoDraft } from '@/types/invest';
import { todoDraftKey } from '@/utils/briefing';

import { briefing, briefingStatus } from './state';

defineProps<{
  written: Set<string>;
}>();
defineEmits<{ retry: []; commit: [todo: BriefingTodoDraft] }>();

const stanceTheme = computed(() => {
  const s = briefing.value?.stance;
  if (s === '偏多') return 'danger';
  if (s === '防守') return 'success';
  return 'warning';
});

function todoKey(todo: BriefingTodoDraft) {
  return todoDraftKey(todo);
}
</script>
```

- [ ] **Step 3: `research.less` 在 `.macro-weather-card` 前插入**

```less
.briefing-card {
  .briefing-card__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .briefing-card__title {
    font-size: 15px;
    font-weight: 700;
    margin-right: 8px;
  }

  .briefing-card__headline {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 10px;
  }

  .briefing-card__muted {
    font-size: 13px;
    color: var(--td-text-color-secondary);
  }

  .briefing-card__notes {
    display: grid;
    gap: 8px;
    margin-bottom: 10px;

    div {
      font-size: 13px;
      line-height: 1.55;
    }

    span {
      display: inline-block;
      min-width: 36px;
      margin-right: 8px;
      color: var(--td-text-color-secondary);
      font-size: 12px;
    }
  }

  .briefing-card__risks {
    margin: 0 0 10px;
    padding-left: 18px;
    color: var(--td-text-color-secondary);
    font-size: 12px;
  }

  .briefing-card__todo {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;
    border-top: 1px solid var(--td-border-level-1-color, #e6eaed);

    p {
      margin: 4px 0 0;
      font-size: 12px;
      color: var(--td-text-color-secondary);
    }
  }
}
```

- [ ] **Step 4: 本步不改页面挂载**

卡片组件先独立存在。挂到宏观 pane 顶部放 Task 3，避免改 `MacroCompass.vue` 再往外穿 retry。

- [ ] **Step 5: Commit**

```bash
git add src/pages/research/BriefingCard.vue src/pages/research/state.ts src/pages/research/research.less
git commit -m "feat: add morning briefing card"
```

---

### Task 3: 进入研究页时触发

**Files:**
- Modify: `src/pages/research/index.vue`
- Modify: `src/pages/research/ValuationRadar.vue`（`valList.value = await fetchIndexValuations()` 之后多一行）

- [ ] **Step 1: ValuationRadar 写入共享列表**

在 `ValuationRadar.vue` 的 script 增加：

```ts
import { valuationItems } from './state';
```

在 `valList.value = await fetchIndexValuations()` 之后：

```ts
valuationItems.value = valList.value;
```

- [ ] **Step 2: 改 `src/pages/research/index.vue`**

模板宏观 pane 换成 Task 2 最终那段。script 全文件替换为：

```ts
import './research.less';

import { computed, onMounted, reactive, ref, watch } from 'vue';

import { useInvestStore } from '@/store';
import type { BriefingTodoDraft } from '@/types/invest';
import {
  alreadyOpen,
  buildFactPack,
  ensureTodayBriefing,
  QUOTE_WAIT_MS,
  todoDraftKey,
  type FactPackInput,
  type HoldingSlice,
} from '@/utils/briefing';
import { todayCN } from '@/utils/date';
import { MessagePlugin } from 'tdesign-vue-next';

import BriefingCard from './BriefingCard.vue';
import EtfRadar from './EtfRadar.vue';
import MacroCompass from './MacroCompass.vue';
import ResearchDesk from './ResearchDesk.vue';
import { bargainCount, briefing, briefingStatus, macroState, valuationItems } from './state';
import ValuationRadar from './ValuationRadar.vue';

defineOptions({ name: 'ResearchIndex' });

type Tab = 'macro' | 'valuation' | 'desk';

const invest = useInvestStore();
const tab = ref<Tab>('macro');
const seen = reactive({ desk: false });
const openTodos = computed(() => invest.todos.filter((t) => t.status === 'open'));
const writtenKeys = computed(() => {
  const s = new Set<string>();
  for (const t of invest.todos) if (t.status === 'open') s.add(todoDraftKey(t));
  return s;
});

watch(tab, (v) => {
  if (v === 'desk') seen.desk = true;
});

function openTab(next: Tab) {
  tab.value = next;
}

function factInput(): FactPackInput {
  const holdings: HoldingSlice[] = invest.enriched.map((h) => ({
    account: h.account,
    code: h.code,
    name: h.name,
    quantity: h.quantity,
    cost: h.cost,
    marketValue: h.marketValue ?? null,
    pnl: h.pnl ?? null,
    pnlPct: h.pnlPct ?? null,
    health: h.health,
    action: h.action,
  }));
  return {
    date: todayCN(),
    weather: invest.macroWeather,
    indicators: invest.macroIndicators,
    events: invest.macroEvents,
    valuation: valuationItems.value.map((v) => ({
      name: v.name,
      code: v.code,
      pe: v.pe,
      percentile: v.pePercentile,
      advice: v.advice,
    })),
    holdings,
    cash: invest.cash,
    todos: invest.todos,
    alerts: invest.activeAlerts,
  };
}

async function waitQuotes() {
  const start = Date.now();
  while (invest.quoteLoading && Date.now() - start < QUOTE_WAIT_MS) {
    await new Promise((r) => setTimeout(r, 200));
  }
}

async function bootBriefing(force = false) {
  if (typeof localStorage === 'undefined') return;
  briefingStatus.value = 'loading';
  if (!force) await waitQuotes();
  const result = await ensureTodayBriefing({
    pack: buildFactPack(factInput()),
    storage: localStorage,
    today: todayCN(),
    force,
  });
  briefing.value = result.briefing;
  briefingStatus.value = result.status === 'ready' ? 'ready' : 'fail';
}

function commitBriefingTodo(todo: BriefingTodoDraft) {
  if (alreadyOpen(invest.todos, todo)) return;
  invest.addTodo({
    account: todo.account,
    code: todo.code,
    name: todo.name,
    side: todo.side,
    quantity: todo.quantity || 0,
    reason: todo.reason,
  });
  MessagePlugin.success('已写入待办');
}

onMounted(() => {
  void bootBriefing(false);
});
```

模板顶部 import 区对应的组件已在 script。确认 `<valuation-radar />` 仍在估值 pane，这样 `v-show` 仍会挂载并回填 `valuationItems`（可能晚于第一次组包，允许空估值）。

- [ ] **Step 3: 类型检查**

```bash
npx vue-tsc --noEmit
npm run check:briefing
```

Expected: 两者通过。

- [ ] **Step 4: Commit**

```bash
git add src/pages/research/index.vue src/pages/research/ValuationRadar.vue src/pages/research/BriefingCard.vue
git commit -m "feat: boot daily briefing on research page"
```

---

### Task 4: 本地代理与部署说明

**Files:**
- Modify: `vite.config.ts`（`'/szse'` 块后面加 `/llm`）
- Modify: `DEPLOY.md`（反代表加一行）

- [ ] **Step 1: `vite.config.ts` 增加**

```ts
        '/llm': {
          target: 'http://127.0.0.1:8096',
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/llm/, ''),
        },
```

本地没有 grok-caddy 时，研判卡走失败态，这是预期。不要把 Key 写进仓库。

- [ ] **Step 2: `DEPLOY.md` 表增加一行**

```
| `/llm/*` | 本机 OpenAI 兼容代理（先探 cli-proxy-api，不通再用 grok-caddy:8096） | 浏览器只打同源 `/llm/v1/chat/completions`；Bearer 只写 Caddyfile |
```

- [ ] **Step 3: VPS 探路（实现时执行，不把 Key 写进 git）**

```bash
ssh -i ~/.ssh/zsxq_capture_key root@38.64.56.230 \
  'ss -lntp | rg "8096|cli-proxy|openai"; ls /opt/invest-workbench/'
```

找到 Caddyfile 后追加（端口以探路为准）：

```
handle /llm* {
    reverse_proxy 127.0.0.1:8096
}
```

若代理要 Bearer，只加在这个 handle 的 `header_up Authorization`。然后 `docker restart invest-caddy`。

验证：

```bash
curl -sS -o /dev/null -w '%{http_code}' \
  -H "Host: stock.053727.xyz" \
  http://127.0.0.1/llm/v1/models
```

Expected: 2xx 或 401（401 说明反代通了、鉴权还要补 header）。前端路径保持 `/llm/v1/chat/completions`。

若实际前缀不是 `/v1`，只改 Caddy rewrite，不改浏览器跨域。

- [ ] **Step 4: Commit（不含 Caddyfile，它不在仓库）**

```bash
git add vite.config.ts DEPLOY.md
git commit -m "chore: proxy /llm for morning briefing"
```

---

### Task 5: 手动验收

- [ ] **Step 1: 自检仍绿**

```bash
npm run check:briefing
npx vue-tsc --noEmit
```

- [ ] **Step 2: 页面**

1. 打开 `/research`，宏观定调最上方出现「今日晨会研判」
2. 代理未通：文案「今日研判未生成」，点重试不白屏
3. 代理通：有 headline 和 0–3 条草稿；刷新页面不重复打模型（Network 里 `/llm` 不再出现）
4. 点「写入待办」后，「研判待办」多一条；再点按钮为「已写入」
5. 失败不编假研判、不改仓、不写论点

---

## Self-review vs spec

| Spec | Task |
|---|---|
| 方案 A 卡片、不聊天 | 2、3 |
| 确认才 `addTodo` | 3 `commitBriefingTodo` |
| 每天第一次自动、当天缓存 | 1 `ensureTodayBriefing` + 3 `onMounted` |
| 只用 Pinia 事实 + 可选估值 | 3 `factInput` |
| `/llm` Caddy / vite | 4 |
| JSON 合同与整份作废 | 1 `parseBriefing` |
| 失败冷却 10 分钟、不写成功缓存 | 1 `shouldSkipAutoFetch` |
| 行情等待 8 秒 | 3 `waitQuotes` |
| `check-briefing.ts` | 1 |
| 不进 SQLite | 无 sync 调用 |
| 未知 code 拒绝 | 1 自检 |
| 事实包不含新闻正文 | 1 自检 |

偏差（有意，更短）：卡片挂在 `index.vue` 宏观 pane 顶部，而不是改 `MacroCompass.vue`。视觉仍在天气卡上方。
