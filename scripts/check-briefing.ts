import assert from 'node:assert/strict';

import type { FactPackInput } from '../src/utils/briefing.ts';
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
  todos: [
    {
      id: 'td1',
      account: 'etf',
      code: 'sh510300',
      name: '沪深300ETF',
      side: 'sell',
      quantity: 0,
      reason: '旧',
      status: 'open',
    },
  ],
  alerts: [
    {
      id: 'a1',
      code: 'sh510300',
      name: '沪深300ETF',
      account: 'etf',
      type: 'take_profit',
      level: 'info',
      title: '止盈',
      detail: '',
      suggestedAction: 'reduce',
      triggerTime: today,
    },
  ],
};

const pack = buildFactPack(input);
assert.equal(pack.date, today);
assert.ok(pack.events.length <= 8);
assert.equal(pack.valuation[0].code, 'sh000852'); // |15-50| > |62-50|，极端项在前
assert.equal(JSON.stringify(pack).includes('http://news.example'), false);
assert.equal(JSON.stringify(pack).includes('secret-body'), false);
const etfAcct = pack.accounts.find((a) => a.id === 'etf');
assert.ok(etfAcct);
assert.ok(etfAcct.holdings[0].weight > 0);

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

const fenced = parseModelContent(`\`\`\`json\n${JSON.stringify(ok)}\n\`\`\``, pack, today);
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
