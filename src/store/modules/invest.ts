import { defineStore } from 'pinia';

import {
  cashSeed,
  holdings as seedHoldings,
  indexes,
  journal as seedJournal,
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
  Holding,
  JournalEntry,
  Opportunity,
  Prefs,
  Thesis,
  ThesisStatus,
  TodoStatus,
  TradeAlert,
  TradeTodo,
  Transaction,
} from '@/types/invest';
import { fetchSinaQuotes } from '@/utils/backup';
import { calculateLedger, recalculateHoldingsFromTransactions, scanTradeAlerts } from '@/utils/ledger';
import type { Quote } from '@/utils/quote';
import { calcHolding, fetchQuotes } from '@/utils/quote';

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
        holdings: this.holdings,
        cash: this.cash,
        quotes: this.quotes,
        todos: this.todos,
        theses: this.theses,
        journal: this.journal,
        opportunities: this.opportunities,
        prefs: this.prefs,
      };
    },
  },
});
