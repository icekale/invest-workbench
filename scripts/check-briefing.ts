import assert from 'node:assert/strict';

import type { FactPackInput } from '../src/utils/briefing.ts';
import {
  allowedCodes,
  alreadyOpen,
  buildFactPack,
  cacheKey,
  ensureTodayBriefing,
  parseBriefing,
  parseModelContent,
  pruneBriefingCache,
  readCachedBriefing,
  shouldSkipAutoFetch,
  weatherFromBriefing,
  weatherMatchesBriefing,
  writeCachedBriefing,
  writeFailAt,
} from '../src/utils/briefing.ts';
import { seriesToIndicator } from '../src/utils/macro-cn.ts';

const today = '2026-09-09';

/*
 * 事件正文（抓来的 URL）已经不在 `MacroEvent` 里了，这里还是照旧塞一个进去：
 * 要守的行为是「事实包不能把正文带进提示词」，不是「这个字段还在类型里」。
 * 用具名常量而不用字面量，是因为展开写法绕过多余属性检查 —— 这正是想要的：
 * 故意给一个类型上不该有的字段，看下游会不会原样传给模型。
 */
const LEAKY_BODY = { body: 'http://news.example/secret-body-should-not-leak' };

const input: FactPackInput = {
  date: today,
  weather: {
    cycle: '复苏前期',
    sentiment: '中性',
    suggestedStockPos: '60% ~ 70%',
    suggestedEtfPos: '75% ~ 85%',
    updatedAt: today,
  },
  indicators: [{ name: 'PMI', value: '49.4', status: '弱势筑底' }],
  events: [
    {
      id: 'e-far',
      date: '2026-09-17',
      title: '太远',
      category: '宏观政策',
      level: '重大',
      impact: '影响',
      beneficiaries: [],
      ...LEAKY_BODY,
    },
    {
      id: 'e-soft',
      date: today,
      title: '小会',
      category: '宏观政策',
      level: '关注',
      impact: '影响',
      beneficiaries: [],
      ...LEAKY_BODY,
    },
    {
      id: 'e-big',
      date: '2026-09-12',
      title: '大会',
      category: '宏观政策',
      level: '重大',
      impact: '影响',
      beneficiaries: [],
      ...LEAKY_BODY,
    },
    ...Array.from({ length: 10 }, (_, i) => ({
      id: `e${i}`,
      date: i === 0 ? today : '2026-09-10',
      title: `会议${i}`,
      category: '宏观政策',
      level: '关注' as const,
      impact: '影响',
      beneficiaries: [] as string[],
      ...LEAKY_BODY,
    })),
  ],
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
      last: 4.5,
      industry: '宽基',
      baseTarget: 5.2,
      baseUpside: 0.1556,
    },
  ],
  cash: { stock: 10000, etf: 20000 },
  yesterdayStance: '谨慎',
  industries: [
    {
      name: '新能源',
      heat: 90,
      trend: 'up',
      catalyst: '电池排产上修',
      keyTargets: [{ code: 'sz159915', name: '创业板ETF' }],
    },
  ],
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
assert.equal(pack.events[0].title, '大会');
assert.equal(
  pack.events.some((e) => e.title === '太远'),
  false,
);
assert.equal(pack.yesterdayStance, '谨慎');
assert.equal(pack.industries[0].name, '新能源');
assert.ok(allowedCodes(pack).has('sz159915'));
assert.equal(pack.valuation[0].code, 'sh000852'); // |15-50| > |62-50|，极端项在前
assert.equal(JSON.stringify(pack).includes('http://news.example'), false);
assert.equal(JSON.stringify(pack).includes('secret-body'), false);
const etfAcct = pack.accounts.find((a) => a.id === 'etf');
assert.ok(etfAcct);
assert.ok(etfAcct.holdings[0].weight > 0);
assert.equal(etfAcct.holdings[0].last, 4.5);
assert.equal(etfAcct.holdings[0].industry, '宽基');
assert.equal(etfAcct.holdings[0].baseTarget, 5.2);
assert.equal(etfAcct.holdings[0].baseUpside, 0.1556);

const sellDraft = {
  account: 'etf' as const,
  code: 'sh510300',
  name: '沪深300ETF',
  side: 'sell' as const,
  quantity: 0,
  reason: '分位偏高',
};
const ok = parseBriefing(
  {
    date: today,
    headline: '中性持有，关注大会落地',
    stance: '中性',
    stockNote: '数据不足',
    etfNote: '沪深300分位62%，可减',
    risks: ['外部冲击'],
    todos: [sellDraft],
  },
  pack,
  today,
);
assert.equal(ok.todos.length, 0); // openTodos 已有同 code+side，生成阶段丢掉
assert.ok(ok.cites?.some((c) => c.kind === 'event' && c.label.includes('大会')));
assert.ok(ok.cites?.some((c) => c.kind === 'valuation' && c.label.includes('沪深300')));
assert.equal(ok.conflicts?.length ?? 0, 0);

const buyOk = parseBriefing({ ...ok, todos: [{ ...sellDraft, side: 'buy' }] }, pack, today);
assert.equal(buyOk.todos.length, 1);

/* ---------- 多账户：新桶要进事实包，模型点名它不能被校验拦掉 ---------- */
const multiPack = buildFactPack({
  ...input,
  accounts: [
    { id: 'stock', name: '股票账户', kind: 'stock' },
    { id: 'etf', name: 'ETF 账户', kind: 'etf' },
    { id: 'acct_3', name: '打新账户', kind: 'stock' },
    { id: 'acct_4', name: '港股账户', kind: 'stock', archived: true },
  ],
  // 故意少一个键：老备份里新桶没有 cash 记录
  cash: { stock: 100, etf: 200 },
});
assert.ok(
  multiPack.accounts.some((a) => a.id === 'acct_3'),
  '刚建的空桶也要让模型看见，否则新建后晨会里没它',
);
assert.equal(multiPack.accounts.find((a) => a.id === 'acct_3')!.cash, 0, '缺 cash 键要给 0，不能是 undefined');
assert.ok(!multiPack.accounts.some((a) => a.id === 'acct_4'), '归档的不进事实包');

// side 用 buy：sh510300+sell 已在 openTodos 里，会被去重滤掉看不出结果
const customDraft = { ...sellDraft, side: 'buy' as const, account: 'acct_3' };
const customOk = parseBriefing({ ...ok, todos: [customDraft] }, multiPack, today);
assert.equal(customOk.todos.length, 1, '自建账户的待办必须能过校验');
assert.equal(customOk.todos[0].account, 'acct_3');
assert.throws(
  () => parseBriefing({ ...ok, todos: [{ ...customDraft, account: '不存在户' }] }, multiPack, today),
  /bad account/,
  '清单外的账户名要拦下',
);
assert.throws(
  () => parseBriefing({ ...ok, todos: [{ ...customDraft, account: '' }] }, multiPack, today),
  /bad account/,
  '空账户名要拦下',
);
assert.ok(buyOk.cites?.some((c) => c.kind === 'holding' && c.label.includes('沪深300ETF')));
const dups = parseBriefing(
  {
    ...ok,
    todos: [
      { ...sellDraft, side: 'buy' },
      { ...sellDraft, side: 'buy' },
    ],
  },
  pack,
  today,
);
assert.equal(dups.todos.length, 1);

const defenseBuy = parseBriefing(
  {
    ...ok,
    headline: '防守为主',
    stance: '防守',
    todos: [{ ...sellDraft, side: 'buy' }],
  },
  pack,
  today,
);
assert.equal(defenseBuy.todos.length, 1);
assert.ok(defenseBuy.conflicts?.some((c) => c.includes('防守')));

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

assert.equal(cacheKey(today), 'invest-briefing-v2-2026-09-09');

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

/* ---------- 存储卫生：只留当日与昨日，更早的晨会缓存是垃圾 ---------- */
const lsMap = new Map<string, string>();
const enumerable = {
  getItem: (k: string) => lsMap.get(k) ?? null,
  setItem: (k: string, v: string) => {
    lsMap.set(k, v);
  },
  removeItem: (k: string) => {
    lsMap.delete(k);
  },
  // 真 localStorage 靠 length/key 遍历，清理函数就需要这两个
  get length() {
    return lsMap.size;
  },
  key: (i: number) => [...lsMap.keys()][i] ?? null,
};

// 前天、昨天各一条，再混一个不相干的键，然后写今天的
lsMap.set(cacheKey('2026-09-07'), '{}');
lsMap.set(cacheKey('2026-09-08'), '{}');
lsMap.set('research-settings-v1', '{"keep":1}');
writeCachedBriefing(enumerable, today, ok);

assert.ok(lsMap.has(cacheKey(today)), '当日那条要留');
assert.ok(lsMap.has(cacheKey('2026-09-08')), '昨日要给 yesterdayStance 用，不能清');
assert.ok(!lsMap.has(cacheKey('2026-09-07')), '前天那条是垃圾，该清');
assert.ok(lsMap.has('research-settings-v1'), '别的键一根汗毛都不能动');

// 没有 length/key 的替身（也代表隐私模式下残缺的实现）：安静返回 0，不抛
assert.equal(pruneBriefingCache(storage, today), 0);
assert.equal(lsMap.has(cacheKey(today)), true, '不能顺手把有用的也清了');
const cached = await ensureTodayBriefing({
  pack,
  storage,
  today,
  fetchImpl: (async () => {
    throw new Error('should not fetch');
  }) as typeof fetch,
});
assert.equal(cached.status, 'ready');
assert.equal(cached.briefing?.headline, ok.headline);

assert.equal(shouldSkipAutoFetch(storage, 1_000_000), false);
writeFailAt(storage, 1_000_000);
assert.equal(shouldSkipAutoFetch(storage, 1_000_000 + 60_000), true);
assert.equal(shouldSkipAutoFetch(storage, 1_000_000 + 11 * 60_000), false);

assert.equal(alreadyOpen(input.todos, sellDraft), true);
assert.equal(alreadyOpen([], sellDraft), false);

const withPos = parseBriefing({ ...ok, suggestedStockPos: '50% ~ 55%', suggestedEtfPos: 'bogus' }, pack, today);
assert.equal(withPos.suggestedStockPos, '50% ~ 55%');
assert.equal(withPos.suggestedEtfPos, undefined);
const applied = weatherFromBriefing(withPos, input.weather, new Date('2026-09-09T08:30:00+08:00'));
assert.equal(applied.cycle, ok.headline);
assert.equal(applied.sentiment, '中性');
assert.equal(applied.suggestedStockPos, '50% ~ 55%');
assert.equal(applied.suggestedEtfPos, '75% ~ 85%');
assert.equal(applied.updatedAt.includes('晨会写入'), true);
assert.equal(weatherMatchesBriefing(applied, withPos), true);
assert.equal(weatherMatchesBriefing(input.weather, withPos), false);

assert.deepEqual(
  seriesToIndicator({
    code: 'EM_PMI',
    name: '官方制造业PMI',
    unit: '%',
    source: '国家统计局',
    freq: '月',
    updateDate: '2026-08',
    dates: [],
    values: [],
    latestValue: 49.4,
    previousValue: 49.7,
    change: -0.3,
  }),
  { name: '官方制造业PMI', value: '49.4%', status: '-0.3% · 2026-08' },
);

console.log('check-briefing ok');
