import { defineStore } from 'pinia';

import {
  holdings as seedHoldings,
  indexes,
  journal as seedJournal,
  theses as seedTheses,
  tradeTodos as seedTodos,
} from '@/mock/invest';
import type { JournalEntry, Thesis, ThesisStatus, TodoStatus, TradeTodo } from '@/types/invest';
import type { Quote } from '@/utils/quote';
import { calcHolding, fetchQuotes } from '@/utils/quote';

const LS_TODO = 'invest-todos';
const LS_WATCH = 'invest-watch';
const LS_JOURNAL = 'invest-journal';
const LS_THESIS = 'invest-theses';

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function enrich(quotes: Record<string, Quote>) {
  return seedHoldings.map((h) => {
    const q = quotes[h.code];
    return { ...h, last: q?.price ?? null, changePct: q?.changePct ?? null, ...calcHolding(h, q) };
  });
}

export const useInvestStore = defineStore('invest', {
  state: () => ({
    quotes: {} as Record<string, Quote>,
    quoteError: '' as string,
    quoteLoading: false,
    todos: readLS<TradeTodo[]>(LS_TODO, seedTodos),
    watchlist: readLS<string[]>(LS_WATCH, []),
    journal: readLS<JournalEntry[]>(LS_JOURNAL, seedJournal),
    theses: readLS<Thesis[]>(LS_THESIS, seedTheses),
  }),
  getters: {
    enriched: (state) => enrich(state.quotes),
    stockRows: (state) => enrich(state.quotes).filter((h) => h.account === 'stock'),
    etfRows: (state) => enrich(state.quotes).filter((h) => h.account === 'etf'),
  },
  actions: {
    async refreshQuotes() {
      this.quoteLoading = true;
      this.quoteError = '';
      const codes = [...new Set([...seedHoldings.map((h) => h.code), ...indexes])];
      try {
        const map = await fetchQuotes(codes);
        const next: Record<string, Quote> = {};
        map.forEach((q, k) => {
          next[k] = q;
        });
        this.quotes = next;
        if (!map.size) this.quoteError = '行情暂不可用';
      } catch (e) {
        this.quoteError = e instanceof Error ? e.message : '行情暂不可用';
      } finally {
        this.quoteLoading = false;
      }
    },
    setTodoStatus(id: string, status: TodoStatus) {
      this.todos = this.todos.map((t) => (t.id === id ? { ...t, status } : t));
      localStorage.setItem(LS_TODO, JSON.stringify(this.todos));
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
    addJournal(body: string) {
      const entry: JournalEntry = {
        id: `j${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        body,
      };
      this.journal = [entry, ...this.journal];
      localStorage.setItem(LS_JOURNAL, JSON.stringify(this.journal));
    },
  },
});
