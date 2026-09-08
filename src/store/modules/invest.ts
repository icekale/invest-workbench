import { defineStore } from 'pinia';

import {
  cashSeed,
  holdings as seedHoldings,
  indexes,
  industryFocusSeed,
  journal as seedJournal,
  macroBriefs as seedMacroBriefs,
  macroEventsSeed,
  macroIndicatorsSeed,
  macroWeatherSeed,
  opportunities as seedOpps,
  planTargets,
  prefsSeed,
  theses as seedTheses,
  tradeTodos as seedTodos,
  transactionsSeed,
} from '@/mock/invest';
import type {
  AccountId,
  CustomPortfolio,
  ExecuteTradeParams,
  ExecuteTradeResult,
  Holding,
  IndustryFocus,
  JournalEntry,
  MacroBrief,
  MacroEvent,
  MacroIndicator,
  MacroWeather,
  Opportunity,
  Prefs,
  Thesis,
  ThesisStatus,
  TodoStatus,
  TradeAlert,
  TradeModalOptions,
  TradeSide,
  TradeTodo,
  Transaction,
} from '@/types/invest';
import { fetchSinaQuotes } from '@/utils/backup';
import { calculateLedger, recalculateHoldingsFromTransactions, scanTradeAlerts } from '@/utils/ledger';
import type { Quote } from '@/utils/quote';
import { calcHolding, fetchQuotes, normalizeCode } from '@/utils/quote';

const LS_HOLD = 'invest-v2-holdings';
const LS_TODO = 'invest-v2-todos';
const LS_WATCH = 'invest-watch';
const LS_JOURNAL = 'invest-v2-journal';
const LS_THESIS = 'invest-v2-theses';
const LS_CASH = 'invest-v2-cash';
const LS_OPPS = 'invest-v2-opportunities';
const LS_PREFS = 'invest-prefs';
const LS_PORT = 'invest-v2-portfolios';
const LS_TX = 'invest-v2-transactions';
const LS_MACRO_WEATHER = 'invest-v2-macro-weather';
const LS_MACRO_INDICATORS = 'invest-v2-macro-indicators';
const LS_MACRO_BRIEFS = 'invest-v2-macro-briefs';
const LS_MACRO_EVENTS = 'invest-v2-macro-events';
const LS_INDUSTRY_FOCUS = 'invest-v2-industry-focus';

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function enrich(holdings: Holding[], quotes: Record<string, Quote>) {
  return holdings.map((h) => {
    const q = quotes[h.code];
    return { ...h, last: q?.price ?? null, changePct: q?.changePct ?? null, ...calcHolding(h, q) };
  });
}

export const useInvestStore = defineStore('invest', {
  state: () => ({
    holdings: readLS<Holding[]>(LS_HOLD, seedHoldings),
    quotes: {} as Record<string, Quote>,
    quoteError: '' as string,
    quoteLoading: false,
    quoteAt: null as number | null,
    todos: readLS<TradeTodo[]>(LS_TODO, seedTodos),
    watchlist: readLS<string[]>(LS_WATCH, []),
    journal: readLS<JournalEntry[]>(LS_JOURNAL, seedJournal).map((j) => ({
      ...j,
      topic: j.topic || j.body,
      conclusion: j.conclusion || '',
    })),
    theses: readLS<Thesis[]>(LS_THESIS, seedTheses),
    cash: readLS<{ stock: number; etf: number }>(LS_CASH, cashSeed),
    opportunities: readLS<Opportunity[]>(LS_OPPS, seedOpps),
    transactions: readLS<Transaction[]>(LS_TX, transactionsSeed),
    prefs: ((): Prefs => {
      const raw = readLS<Partial<Prefs>>(LS_PREFS, {});
      return {
        isolate: raw.isolate ?? prefsSeed.isolate,
        closeRemind: raw.closeRemind ?? prefsSeed.closeRemind,
        healthDate: { ...prefsSeed.healthDate, ...raw.healthDate },
        health: { ...prefsSeed.health, ...raw.health },
        healthDelta: { ...prefsSeed.healthDelta, ...raw.healthDelta },
        stopLossPct: raw.stopLossPct ?? prefsSeed.stopLossPct ?? -0.08,
        takeProfitPct: raw.takeProfitPct ?? prefsSeed.takeProfitPct ?? 0.25,
        rebalanceThresholdPct: raw.rebalanceThresholdPct ?? prefsSeed.rebalanceThresholdPct ?? 0.03,
      };
    })(),
    customPortfolios: readLS<CustomPortfolio[]>(LS_PORT, []),
    macroWeather: readLS<MacroWeather>(LS_MACRO_WEATHER, macroWeatherSeed),
    macroIndicators: readLS<MacroIndicator[]>(LS_MACRO_INDICATORS, macroIndicatorsSeed),
    macroBriefs: readLS<MacroBrief[]>(LS_MACRO_BRIEFS, seedMacroBriefs),
    macroEvents: readLS<MacroEvent[]>(LS_MACRO_EVENTS, macroEventsSeed),
    industryFocus: readLS<IndustryFocus[]>(LS_INDUSTRY_FOCUS, industryFocusSeed),
    tradeModal: {
      visible: false,
      options: {
        account: 'stock' as AccountId,
        side: 'buy' as TradeSide,
        code: '',
        name: '',
        price: 0,
        quantity: 100,
        todoId: '',
        note: '',
      } as TradeModalOptions,
    },
  }),
  getters: {
    enriched: (state) => enrich(state.holdings, state.quotes),
    stockRows: (state) => enrich(state.holdings, state.quotes).filter((h) => h.account === 'stock'),
    etfRows: (state) => enrich(state.holdings, state.quotes).filter((h) => h.account === 'etf'),
    totalHoldingMv: (state) =>
      enrich(state.holdings, state.quotes).reduce((sum, h) => sum + (h.marketValue ?? h.cost * h.quantity), 0),
    totalPortfolioValue: (state) => {
      const holdingMv = enrich(state.holdings, state.quotes).reduce(
        (sum, h) => sum + (h.marketValue ?? h.cost * h.quantity),
        0,
      );
      return holdingMv + state.cash.stock + state.cash.etf;
    },
    ledgerSummary: (state): ReturnType<typeof calculateLedger> => {
      const holdingMv = enrich(state.holdings, state.quotes).reduce(
        (sum, h) => sum + (h.marketValue ?? h.cost * h.quantity),
        0,
      );
      return calculateLedger(state.transactions, holdingMv);
    },
    activeAlerts: (state): TradeAlert[] =>
      scanTradeAlerts(state.holdings, state.quotes, state.theses, planTargets, state.prefs),
  },
  actions: {
    persistHoldings() {
      localStorage.setItem(LS_HOLD, JSON.stringify(this.holdings));
    },
    openTradeModal(opts?: Partial<TradeModalOptions>) {
      this.tradeModal.options = {
        account: opts?.account || 'stock',
        side: opts?.side || 'buy',
        code: opts?.code || '',
        name: opts?.name || '',
        price: opts?.price || 0,
        quantity: opts?.quantity || 100,
        todoId: opts?.todoId || '',
        note: opts?.note || '',
      };
      this.tradeModal.visible = true;
    },
    closeTradeModal() {
      this.tradeModal.visible = false;
    },
    setCash(account: AccountId, value: number) {
      this.cash = { ...this.cash, [account]: Math.max(0, value) };
      localStorage.setItem(LS_CASH, JSON.stringify(this.cash));
    },
    async refreshQuotes() {
      this.quoteLoading = true;
      this.quoteError = '';
      const codes = [...new Set([...this.holdings.map((h) => h.code), ...indexes])];
      try {
        let map = await fetchQuotes(codes).catch(() => new Map<string, Quote>());
        if (!map.size) map = await fetchSinaQuotes(codes);
        const next: Record<string, Quote> = {};
        map.forEach((q, k) => {
          next[k] = q;
        });
        this.quotes = next;
        if (map.size) this.quoteAt = Date.now();
        else this.quoteError = '行情暂不可用';
      } catch (e) {
        this.quoteError = e instanceof Error ? e.message : '行情暂不可用';
      } finally {
        this.quoteLoading = false;
      }
    },
    upsertHolding(row: Holding) {
      const i = this.holdings.findIndex((h) => h.account === row.account && h.code === row.code);
      const next = this.holdings.slice();
      if (i >= 0) next[i] = { ...next[i], ...row };
      else next.push(row);
      this.holdings = next;
      this.persistHoldings();
    },
    removeHolding(account: Holding['account'], code: string) {
      this.holdings = this.holdings.filter((h) => !(h.account === account && h.code === code));
      this.persistHoldings();
    },
    setTodoStatus(id: string, status: TodoStatus) {
      this.todos = this.todos.map((t) => (t.id === id ? { ...t, status } : t));
      localStorage.setItem(LS_TODO, JSON.stringify(this.todos));
    },
    addTodo(todo: Omit<TradeTodo, 'id' | 'status'>) {
      const row: TradeTodo = {
        ...todo,
        id: `td_${Date.now()}`,
        status: 'open',
      };
      this.todos = [row, ...this.todos];
      localStorage.setItem(LS_TODO, JSON.stringify(this.todos));
    },
    removeTodo(id: string) {
      this.todos = this.todos.filter((t) => t.id !== id);
      localStorage.setItem(LS_TODO, JSON.stringify(this.todos));
    },
    persistTransactions() {
      localStorage.setItem(LS_TX, JSON.stringify(this.transactions));
    },
    addTransaction(row: Omit<Transaction, 'id' | 'amount'>) {
      const amount = Number((row.price * row.quantity).toFixed(2));
      const tx: Transaction = {
        ...row,
        id: `tx_${Date.now()}`,
        amount,
      };
      this.transactions = [tx, ...this.transactions];
      this.persistTransactions();
    },
    executeTrade(params: ExecuteTradeParams): ExecuteTradeResult {
      const { account, side, name, price, quantity, todoId } = params;
      const code = normalizeCode(params.code);
      const date = params.date || new Date().toISOString().slice(0, 10);
      const note = params.note?.trim() || '';

      if (!price || price <= 0 || !quantity || quantity <= 0) {
        throw new Error('成交单价与成交数量必须大于 0');
      }

      const amount = Number((price * quantity).toFixed(2));
      const currentCash = this.cash[account] || 0;

      if (side === 'buy') {
        if (amount > currentCash) {
          throw new Error(
            `可用现金不足：需 ¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}，当前可用仅剩 ¥${currentCash.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`,
          );
        }

        // 1. 扣减现金
        const nextCash = Number((currentCash - amount).toFixed(2));
        this.setCash(account, nextCash);

        // 2. 更新或新建持仓 (加权移动平均成本)
        const idx = this.holdings.findIndex(
          (h) => h.account === account && (h.code === code || normalizeCode(h.code) === code),
        );
        const holdingsCopy = this.holdings.slice();

        if (idx >= 0) {
          const old = holdingsCopy[idx];
          const newQty = old.quantity + quantity;
          const newCost = Number(((old.cost * old.quantity + amount) / newQty).toFixed(4));
          holdingsCopy[idx] = {
            ...old,
            name: name || old.name,
            quantity: newQty,
            cost: newCost,
          };
        } else {
          const matchedThesis = this.theses.find((t) => t.code === code || t.title.includes(name));
          holdingsCopy.push({
            account,
            code,
            name: name || code,
            quantity,
            cost: Number(price.toFixed(4)),
            health: 'healthy',
            action: 'hold',
            thesisId: matchedThesis?.id || '',
          });
        }
        this.holdings = holdingsCopy;
        this.persistHoldings();
      } else {
        // sell
        const idx = this.holdings.findIndex(
          (h) => h.account === account && (h.code === code || normalizeCode(h.code) === code),
        );
        if (idx < 0) {
          throw new Error(`无法卖出：当前${account === 'stock' ? '股票' : 'ETF'}账户未持有【${name || code}】`);
        }
        const holding = this.holdings[idx];
        if (quantity > holding.quantity) {
          throw new Error(`卖出数量超出持仓：尝试卖出 ${quantity} 股/份，当前仅持有 ${holding.quantity} 股/份`);
        }

        // 1. 增加现金
        const nextCash = Number((currentCash + amount).toFixed(2));
        this.setCash(account, nextCash);

        // 2. 扣减持仓 (数量减少，成本价在加权会计中保持不变)
        const holdingsCopy = this.holdings.slice();
        const remainQty = holding.quantity - quantity;
        if (remainQty === 0) {
          holdingsCopy.splice(idx, 1);
        } else {
          holdingsCopy[idx] = {
            ...holding,
            quantity: remainQty,
          };
        }
        this.holdings = holdingsCopy;
        this.persistHoldings();
      }

      // 3. 记录成交流水
      const txId = `tx_${Date.now()}`;
      const tx: Transaction = {
        id: txId,
        date,
        account,
        code,
        name: name || code,
        side,
        price,
        quantity,
        amount,
        fee: 0,
        note: note || (todoId ? '决策待办一键执行' : ''),
      };
      this.transactions = [tx, ...this.transactions];
      this.persistTransactions();

      // 4. 联动完成待办 (如果有关联 todoId)
      if (todoId) {
        this.removeTodo(todoId);
      }

      // 5. 刷新行情保证市值与各看板数据最新
      this.refreshQuotes();

      return {
        success: true,
        message: `${side === 'buy' ? '买入' : '卖出'} ${name || code} ${quantity} 股/份 成功成交！`,
        amount,
        transactionId: txId,
      };
    },
    importTransactions(rows: Transaction[], syncHoldings = false) {
      this.transactions = [...rows, ...this.transactions];
      this.persistTransactions();
      if (syncHoldings) {
        this.applyTransactionsToHoldings();
      }
    },
    removeTransaction(id: string) {
      this.transactions = this.transactions.filter((t) => t.id !== id);
      this.persistTransactions();
    },
    clearTransactions() {
      this.transactions = [];
      this.persistTransactions();
    },
    applyTransactionsToHoldings() {
      const recomputed = recalculateHoldingsFromTransactions(this.transactions, this.theses);
      this.holdings = recomputed;
      this.persistHoldings();
    },
    toggleWatch(code: string) {
      this.watchlist = this.watchlist.includes(code)
        ? this.watchlist.filter((c) => c !== code)
        : [...this.watchlist, code];
      localStorage.setItem(LS_WATCH, JSON.stringify(this.watchlist));
    },
    setThesisStatus(id: string, status: ThesisStatus) {
      this.theses = this.theses.map((t) => (t.id === id ? { ...t, status } : t));
      localStorage.setItem(LS_THESIS, JSON.stringify(this.theses));
    },
    removeThesis(id: string) {
      this.theses = this.theses.filter((t) => t.id !== id);
      localStorage.setItem(LS_THESIS, JSON.stringify(this.theses));
    },
    addJournal(topic: string, conclusion = '', body = '') {
      const entry: JournalEntry = {
        id: `j${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        topic,
        conclusion,
        body: body || topic,
      };
      this.journal = [entry, ...this.journal];
      localStorage.setItem(LS_JOURNAL, JSON.stringify(this.journal));
    },
    removeJournal(id: string) {
      this.journal = this.journal.filter((j) => j.id !== id);
      localStorage.setItem(LS_JOURNAL, JSON.stringify(this.journal));
    },
    addThesis(title: string, code: string, body: string) {
      const row: Thesis = { id: `th${Date.now()}`, title, code, status: 'watch', body };
      this.theses = [row, ...this.theses];
      localStorage.setItem(LS_THESIS, JSON.stringify(this.theses));
    },
    addOpportunity(row: Omit<Opportunity, 'id'>) {
      this.opportunities = [{ ...row, id: `o${Date.now()}` }, ...this.opportunities];
      localStorage.setItem(LS_OPPS, JSON.stringify(this.opportunities));
    },
    removeOpportunity(id: string) {
      this.opportunities = this.opportunities.filter((o) => o.id !== id);
      localStorage.setItem(LS_OPPS, JSON.stringify(this.opportunities));
    },
    saveCustomPortfolio(row: CustomPortfolio) {
      const i = this.customPortfolios.findIndex((p) => p.id === row.id);
      const next = this.customPortfolios.slice();
      if (i >= 0) next[i] = row;
      else next.unshift(row);
      this.customPortfolios = next;
      localStorage.setItem(LS_PORT, JSON.stringify(next));
    },
    removeCustomPortfolio(id: string) {
      this.customPortfolios = this.customPortfolios.filter((p) => p.id !== id);
      localStorage.setItem(LS_PORT, JSON.stringify(this.customPortfolios));
    },
    updateMacroWeather(partial: Partial<MacroWeather>) {
      this.macroWeather = { ...this.macroWeather, ...partial };
      localStorage.setItem(LS_MACRO_WEATHER, JSON.stringify(this.macroWeather));
    },
    updateMacroIndicator(id: string, partial: Partial<MacroIndicator>) {
      this.macroIndicators = this.macroIndicators.map((item) => (item.id === id ? { ...item, ...partial } : item));
      localStorage.setItem(LS_MACRO_INDICATORS, JSON.stringify(this.macroIndicators));
    },
    addMacroBrief(brief: Omit<MacroBrief, 'id' | 'time'> & { time?: string }) {
      const now = new Date();
      const timeStr =
        brief.time || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const row: MacroBrief = {
        ...brief,
        id: `m_${Date.now()}`,
        time: timeStr,
      };
      this.macroBriefs = [row, ...this.macroBriefs];
      localStorage.setItem(LS_MACRO_BRIEFS, JSON.stringify(this.macroBriefs));
      return row;
    },
    removeMacroBrief(id: string) {
      this.macroBriefs = this.macroBriefs.filter((m) => m.id !== id);
      localStorage.setItem(LS_MACRO_BRIEFS, JSON.stringify(this.macroBriefs));
    },
    addMacroEvent(event: Omit<MacroEvent, 'id'>) {
      const row: MacroEvent = {
        ...event,
        id: `ev_${Date.now()}`,
      };
      this.macroEvents = [row, ...this.macroEvents];
      localStorage.setItem(LS_MACRO_EVENTS, JSON.stringify(this.macroEvents));
      return row;
    },
    removeMacroEvent(id: string) {
      this.macroEvents = this.macroEvents.filter((e) => e.id !== id);
      localStorage.setItem(LS_MACRO_EVENTS, JSON.stringify(this.macroEvents));
    },
    addIndustryFocus(ind: Omit<IndustryFocus, 'id' | 'updatedAt'>) {
      const row: IndustryFocus = {
        ...ind,
        id: `ind_${Date.now()}`,
        updatedAt: '刚刚新增',
      };
      this.industryFocus = [row, ...this.industryFocus];
      localStorage.setItem(LS_INDUSTRY_FOCUS, JSON.stringify(this.industryFocus));
      return row;
    },
    removeIndustryFocus(id: string) {
      this.industryFocus = this.industryFocus.filter((i) => i.id !== id);
      localStorage.setItem(LS_INDUSTRY_FOCUS, JSON.stringify(this.industryFocus));
    },
    convertEventToTodo(event: MacroEvent): boolean {
      const primaryTarget = event.beneficiaries?.[0] || event.title;
      this.addTodo({
        account: event.account === 'stock' ? 'stock' : 'etf',
        code: '',
        name: primaryTarget.slice(0, 14),
        side: 'buy',
        quantity: 0,
        reason: `重点会议催化【${event.title}】：${event.suggestedAction || event.impact}`,
      });
      return true;
    },
    convertIndustryToOpportunity(ind: IndustryFocus, targetCode?: string): boolean {
      const target = ind.keyTargets.find((t) => t.code === targetCode) || ind.keyTargets[0];
      const name = target ? target.name : ind.name;
      const account: AccountId = ind.account === 'stock' ? 'stock' : 'etf';
      this.addOpportunity({
        account,
        name,
        thesis: `产业景气驱动【${ind.name} · ${ind.cycleStage}】：${ind.catalyst}；投资策略：${ind.tactic}`,
        score: Math.min(100, Math.max(50, ind.heat)),
        note: `重点催化：${ind.catalyst.slice(0, 30)}...`,
      });
      return true;
    },
    convertMacroToTodo(brief: MacroBrief): boolean {
      if (brief.suggestedTodo) {
        this.addTodo({
          account: brief.suggestedTodo.account,
          code: brief.suggestedTodo.code || '',
          name: brief.suggestedTodo.name,
          side: brief.suggestedTodo.side,
          quantity: brief.suggestedTodo.quantity || 0,
          reason: brief.suggestedTodo.reason,
        });
        return true;
      }
      this.addTodo({
        account: brief.account === 'stock' ? 'stock' : 'etf',
        code: '',
        name: brief.title.slice(0, 14),
        side: brief.tone === '偏空' ? 'sell' : 'buy',
        quantity: 0,
        reason: brief.actionAdvice || brief.body.slice(0, 50),
      });
      return true;
    },
    setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
      this.prefs = { ...this.prefs, [key]: value };
      localStorage.setItem(LS_PREFS, JSON.stringify(this.prefs));
    },
    touchHealth(account: AccountId, total: number) {
      const today = new Date().toISOString().slice(0, 10);
      if (this.prefs.healthDate[account] !== today) {
        const prev = this.prefs.health[account];
        this.prefs.healthDelta[account] = prev ? total - prev : 0;
        this.prefs.health[account] = total;
        this.prefs.healthDate = { ...this.prefs.healthDate, [account]: today };
        localStorage.setItem(LS_PREFS, JSON.stringify(this.prefs));
      }
      return this.prefs.healthDelta[account];
    },
    snapshot() {
      return {
        at: new Date().toISOString(),
        version: 2,
        holdings: this.holdings,
        cash: this.cash,
        quotes: this.quotes,
        todos: this.todos,
        theses: this.theses,
        journal: this.journal,
        opportunities: this.opportunities,
        prefs: this.prefs,
        transactions: this.transactions,
        watchlist: this.watchlist,
        customPortfolios: this.customPortfolios,
        macroWeather: this.macroWeather,
        macroIndicators: this.macroIndicators,
        macroBriefs: this.macroBriefs,
        macroEvents: this.macroEvents,
        industryFocus: this.industryFocus,
      };
    },
    restoreSnapshot(data: any): { success: boolean; message: string; counts?: Record<string, number> } {
      if (!data || typeof data !== 'object') {
        return { success: false, message: '无效的快照文件格式' };
      }
      if (!Array.isArray(data.holdings) || !data.cash) {
        return { success: false, message: '快照数据缺少核心持仓或资金字段' };
      }

      // 1. 持仓
      this.holdings = data.holdings;
      localStorage.setItem(LS_HOLD, JSON.stringify(this.holdings));

      // 2. 现金
      if (typeof data.cash.stock === 'number' && typeof data.cash.etf === 'number') {
        this.cash = { stock: data.cash.stock, etf: data.cash.etf };
        localStorage.setItem(LS_CASH, JSON.stringify(this.cash));
      }

      // 3. 交易流水台账
      if (Array.isArray(data.transactions)) {
        this.transactions = data.transactions;
        localStorage.setItem(LS_TX, JSON.stringify(this.transactions));
      }

      // 4. 待办清单
      if (Array.isArray(data.todos)) {
        this.todos = data.todos;
        localStorage.setItem(LS_TODO, JSON.stringify(this.todos));
      }

      // 5. 投资论点
      if (Array.isArray(data.theses)) {
        this.theses = data.theses;
        localStorage.setItem(LS_THESIS, JSON.stringify(this.theses));
      }

      // 6. 复盘日记
      if (Array.isArray(data.journal)) {
        this.journal = data.journal;
        localStorage.setItem(LS_JOURNAL, JSON.stringify(this.journal));
      }

      // 7. 机会池
      if (Array.isArray(data.opportunities)) {
        this.opportunities = data.opportunities;
        localStorage.setItem(LS_OPPS, JSON.stringify(this.opportunities));
      }

      // 8. 偏好设定
      if (data.prefs && typeof data.prefs === 'object') {
        this.prefs = { ...this.prefs, ...data.prefs };
        localStorage.setItem(LS_PREFS, JSON.stringify(this.prefs));
      }

      // 9. 自选池
      if (Array.isArray(data.watchlist)) {
        this.watchlist = data.watchlist;
        localStorage.setItem(LS_WATCH, JSON.stringify(this.watchlist));
      }

      // 10. 自定义策略组合
      if (Array.isArray(data.customPortfolios)) {
        this.customPortfolios = data.customPortfolios;
        localStorage.setItem(LS_PORT, JSON.stringify(this.customPortfolios));
      }

      // 11. 宏观天气与指标
      if (data.macroWeather && typeof data.macroWeather === 'object') {
        this.macroWeather = { ...this.macroWeather, ...data.macroWeather };
        localStorage.setItem(LS_MACRO_WEATHER, JSON.stringify(this.macroWeather));
      }
      if (Array.isArray(data.macroIndicators)) {
        this.macroIndicators = data.macroIndicators;
        localStorage.setItem(LS_MACRO_INDICATORS, JSON.stringify(this.macroIndicators));
      }
      if (Array.isArray(data.macroBriefs)) {
        this.macroBriefs = data.macroBriefs;
        localStorage.setItem(LS_MACRO_BRIEFS, JSON.stringify(this.macroBriefs));
      }
      if (Array.isArray(data.macroEvents)) {
        this.macroEvents = data.macroEvents;
        localStorage.setItem(LS_MACRO_EVENTS, JSON.stringify(this.macroEvents));
      }
      if (Array.isArray(data.industryFocus)) {
        this.industryFocus = data.industryFocus;
        localStorage.setItem(LS_INDUSTRY_FOCUS, JSON.stringify(this.industryFocus));
      }

      // 触发最新行情更新
      this.refreshQuotes();

      return {
        success: true,
        message: '数据恢复成功',
        counts: {
          holdings: this.holdings.length,
          transactions: this.transactions.length,
          todos: this.todos.length,
          theses: this.theses.length,
          journal: this.journal.length,
        },
      };
    },
  },
});
