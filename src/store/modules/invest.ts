import { defineStore } from 'pinia';

import { indexes, planTargets, prefsSeed } from '@/mock/invest';
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
  NavSnapshot,
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
import { fetchLiveMacroBriefs } from '@/utils/briefs';
import { fetchLiveMacroEvents } from '@/utils/calendar';
import { scheduleCloudPush, setHydrating } from '@/utils/cloud-sync';
import { todayCN } from '@/utils/date';
import { fetchLiveIndustryCatalysts } from '@/utils/industry';
import { calculateLedger, recalculateHoldingsFromTransactions, scanTradeAlerts, tradeFee } from '@/utils/ledger';
import type { Quote } from '@/utils/quote';
import { calcHolding, fetchQuotes, normalizeCode } from '@/utils/quote';

function persist() {
  scheduleCloudPush();
}

function persistMacroNotes() {
  persist();
}

function errText(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}

function emptyWeather(): MacroWeather {
  return { cycle: '', sentiment: '中性', suggestedStockPos: '', suggestedEtfPos: '', updatedAt: '' };
}

function emptyIndicators(): MacroIndicator[] {
  return [];
}

function normalizePrefs(raw: Partial<Prefs>): Prefs {
  return {
    isolate: raw.isolate ?? prefsSeed.isolate,
    closeRemind: raw.closeRemind ?? prefsSeed.closeRemind,
    healthDate: { ...prefsSeed.healthDate, ...raw.healthDate },
    health: { ...prefsSeed.health, ...raw.health },
    healthDelta: { ...prefsSeed.healthDelta, ...raw.healthDelta },
    stopLossPct: raw.stopLossPct ?? prefsSeed.stopLossPct ?? -0.08,
    takeProfitPct: raw.takeProfitPct ?? prefsSeed.takeProfitPct ?? 0.25,
    rebalanceThresholdPct: raw.rebalanceThresholdPct ?? prefsSeed.rebalanceThresholdPct ?? 0.03,
    lastBackupAt: raw.lastBackupAt,
    lastCloudSyncAt: raw.lastCloudSyncAt,
    updatedAt: raw.updatedAt,
    onlyMajorEvents: raw.onlyMajorEvents ?? false,
  };
}

function enrich(holdings: Holding[], quotes: Record<string, Quote>) {
  return holdings.map((h) => {
    const q = quotes[h.code];
    return { ...h, last: q?.price ?? null, changePct: q?.changePct ?? null, ...calcHolding(h, q) };
  });
}

export const useInvestStore = defineStore('invest', {
  state: () => ({
    holdings: [] as Holding[],
    quotes: {} as Record<string, Quote>,
    quoteError: '' as string,
    quoteLoading: false,
    quoteAt: null as number | null,
    todos: [] as TradeTodo[],
    watchlist: [] as string[],
    journal: [] as JournalEntry[],
    theses: [] as Thesis[],
    cash: { stock: 0, etf: 0 },
    opportunities: [] as Opportunity[],
    transactions: [] as Transaction[],
    prefs: normalizePrefs({}),
    customPortfolios: [] as CustomPortfolio[],
    macroWeather: emptyWeather(),
    macroIndicators: emptyIndicators(),
    macroBriefs: [] as MacroBrief[],
    macroBriefsLoading: false,
    macroBriefsLastUpdated: null as string | null,
    macroBriefsError: '',
    macroEvents: [] as MacroEvent[],
    macroEventsLoading: false,
    macroEventsLastUpdated: null as string | null,
    macroEventsError: '',
    industryFocus: [] as IndustryFocus[],
    industryFocusLoading: false,
    industryFocusLastUpdated: null as string | null,
    industryFocusError: '',
    navSnapshots: [] as NavSnapshot[],
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
      persist();
    },
    /** 每次行情刷新后落一条当日快照（同日覆盖），用于绘制真实净值曲线 */
    recordDailySnapshot() {
      const rows = this.enriched;
      const sumAccount = (acc: AccountId) =>
        rows.filter((r) => r.account === acc).reduce((s, r) => s + (r.marketValue ?? r.cost * r.quantity), 0);
      const entry: NavSnapshot = {
        date: todayCN(),
        stockTotal: Number((sumAccount('stock') + this.cash.stock).toFixed(2)),
        etfTotal: Number((sumAccount('etf') + this.cash.etf).toFixed(2)),
      };
      const list = this.navSnapshots.filter((s) => s.date !== entry.date);
      list.push(entry);
      // 只保留最近 400 个自然日
      this.navSnapshots = list.slice(-400);
      persist();
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
      persist();
    },
    async refreshQuotes() {
      if (this.quoteAt && Date.now() - this.quoteAt < 15_000 && Object.keys(this.quotes).length) return;
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
        if (map.size) {
          this.quoteAt = Date.now();
          this.recordDailySnapshot();
        } else {
          this.quoteError = '行情暂不可用';
        }
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
      persist();
    },
    addTodo(todo: Omit<TradeTodo, 'id' | 'status'>) {
      const row: TradeTodo = {
        ...todo,
        id: `td_${Date.now()}`,
        status: 'open',
      };
      this.todos = [row, ...this.todos];
      persist();
    },
    removeTodo(id: string) {
      this.todos = this.todos.filter((t) => t.id !== id);
      persist();
    },
    persistTransactions() {
      persist();
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
      const date = params.date || todayCN();
      const note = params.note?.trim() || '';

      if (!price || price <= 0 || !quantity || quantity <= 0) {
        throw new Error('成交单价与成交数量必须大于 0');
      }

      const amount = Number((price * quantity).toFixed(2));
      const fee = Math.max(0, Number((params.fee ?? tradeFee(account, amount)).toFixed(2)));
      const currentCash = this.cash[account] || 0;

      if (side === 'buy') {
        if (amount + fee > currentCash) {
          throw new Error(
            `可用现金不足：需 ¥${(amount + fee).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}（含手续费），当前可用仅剩 ¥${currentCash.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`,
          );
        }

        // 1. 扣减现金（含手续费）
        const nextCash = Number((currentCash - amount - fee).toFixed(2));
        this.setCash(account, nextCash);

        // 2. 更新或新建持仓 (加权移动平均成本，手续费计入成本)
        const idx = this.holdings.findIndex(
          (h) => h.account === account && (h.code === code || normalizeCode(h.code) === code),
        );
        const holdingsCopy = this.holdings.slice();

        if (idx >= 0) {
          const old = holdingsCopy[idx];
          const newQty = old.quantity + quantity;
          const newCost = Number(((old.cost * old.quantity + amount + fee) / newQty).toFixed(4));
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
            cost: Number(((amount + fee) / quantity).toFixed(4)),
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

        // 1. 增加现金（扣除手续费）
        const nextCash = Number((currentCash + amount - fee).toFixed(2));
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
        fee,
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
      persist();
    },
    setThesisStatus(id: string, status: ThesisStatus) {
      this.theses = this.theses.map((t) => (t.id === id ? { ...t, status } : t));
      persist();
    },
    removeThesis(id: string) {
      this.theses = this.theses.filter((t) => t.id !== id);
      persist();
    },
    addJournal(topic: string, conclusion = '', body = '') {
      const entry: JournalEntry = {
        id: `j${Date.now()}`,
        date: todayCN(),
        topic,
        conclusion,
        body: body || topic,
      };
      this.journal = [entry, ...this.journal];
      persist();
    },
    removeJournal(id: string) {
      this.journal = this.journal.filter((j) => j.id !== id);
      persist();
    },
    addThesis(title: string, code: string, body: string) {
      const row: Thesis = { id: `th${Date.now()}`, title, code, status: 'watch', body };
      this.theses = [row, ...this.theses];
      persist();
    },
    addOpportunity(row: Omit<Opportunity, 'id'>) {
      this.opportunities = [{ ...row, id: `o${Date.now()}` }, ...this.opportunities];
      persist();
    },
    removeOpportunity(id: string) {
      this.opportunities = this.opportunities.filter((o) => o.id !== id);
      persist();
    },
    saveCustomPortfolio(row: CustomPortfolio) {
      const i = this.customPortfolios.findIndex((p) => p.id === row.id);
      const next = this.customPortfolios.slice();
      if (i >= 0) next[i] = row;
      else next.unshift(row);
      this.customPortfolios = next;
      persist();
    },
    removeCustomPortfolio(id: string) {
      this.customPortfolios = this.customPortfolios.filter((p) => p.id !== id);
      persist();
    },
    updateMacroWeather(partial: Partial<MacroWeather>) {
      this.macroWeather = { ...this.macroWeather, ...partial };
      persist();
    },
    updateMacroIndicator(id: string, partial: Partial<MacroIndicator>) {
      this.macroIndicators = this.macroIndicators.map((item) => (item.id === id ? { ...item, ...partial } : item));
      persist();
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
      persistMacroNotes();
      return row;
    },
    removeMacroBrief(id: string) {
      this.macroBriefs = this.macroBriefs.filter((m) => m.id !== id);
      persistMacroNotes();
    },
    addMacroEvent(event: Omit<MacroEvent, 'id'>) {
      const row: MacroEvent = {
        ...event,
        id: `ev_${Date.now()}`,
      };
      this.macroEvents = [row, ...this.macroEvents];
      persistMacroNotes();
      return row;
    },
    async refreshMacroBriefs() {
      this.macroBriefsLoading = true;
      this.macroBriefsError = '';
      try {
        const liveItems = await fetchLiveMacroBriefs();
        const custom = this.macroBriefs.filter((b) => b.id.startsWith('m_'));
        const seen = new Set(custom.map((b) => b.title));
        const merged = [...custom];
        for (const row of liveItems) {
          if (seen.has(row.title)) continue;
          seen.add(row.title);
          merged.push(row);
        }
        this.macroBriefs = merged;
        this.macroBriefsLastUpdated = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      } catch (err) {
        this.macroBriefsError = errText(err, '华尔街见闻快讯拉取失败');
      } finally {
        this.macroBriefsLoading = false;
      }
    },
    async refreshMacroEvents() {
      this.macroEventsLoading = true;
      this.macroEventsError = '';
      try {
        const liveItems = await fetchLiveMacroEvents(30);
        const custom = this.macroEvents.filter((e) => e.id.startsWith('ev_'));
        const seen = new Set(custom.map((e) => e.title));
        const merged = [...custom];
        for (const ev of liveItems) {
          if (seen.has(ev.title)) continue;
          seen.add(ev.title);
          merged.push(ev);
        }
        this.macroEvents = merged;
        this.macroEventsLastUpdated = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      } catch (err) {
        this.macroEventsError = errText(err, '华尔街见闻宏观日历拉取失败');
      } finally {
        this.macroEventsLoading = false;
      }
    },
    removeMacroEvent(id: string) {
      this.macroEvents = this.macroEvents.filter((e) => e.id !== id);
      persistMacroNotes();
    },
    addIndustryFocus(ind: Omit<IndustryFocus, 'id' | 'updatedAt'>) {
      const row: IndustryFocus = {
        ...ind,
        id: `ind_${Date.now()}`,
        updatedAt: '刚刚新增',
      };
      this.industryFocus = [row, ...this.industryFocus];
      persistMacroNotes();
      return row;
    },
    async refreshIndustryFocus() {
      this.industryFocusLoading = true;
      this.industryFocusError = '';
      try {
        const liveItems = await fetchLiveIndustryCatalysts();
        const custom = this.industryFocus.filter((i) => i.id.startsWith('ind_'));
        const seen = new Set(custom.map((i) => i.name));
        const merged = [...custom];
        for (const item of liveItems) {
          if (seen.has(item.name)) continue;
          seen.add(item.name);
          merged.push(item);
        }
        this.industryFocus = merged;
        this.industryFocusLastUpdated = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      } catch (err) {
        this.industryFocusError = errText(err, '选股宝板块异动拉取失败');
      } finally {
        this.industryFocusLoading = false;
      }
    },
    removeIndustryFocus(id: string) {
      this.industryFocus = this.industryFocus.filter((i) => i.id !== id);
      persistMacroNotes();
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
        thesis: `产业景气驱动【${ind.name}】：${ind.catalyst}`,
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
      if (key === 'lastCloudSyncAt' || key === 'updatedAt') return;
      persist();
    },
    touchHealth(account: AccountId, total: number) {
      const today = todayCN();
      if (this.prefs.healthDate[account] !== today) {
        const prev = this.prefs.health[account];
        this.prefs.healthDelta[account] = prev ? total - prev : 0;
        this.prefs.health[account] = total;
        this.prefs.healthDate = { ...this.prefs.healthDate, [account]: today };
        persist();
      }
      return this.prefs.healthDelta[account];
    },
    adoptUser(_username?: string) {
      setHydrating(true);
      try {
        this.holdings = [];
        this.todos = [];
        this.watchlist = [];
        this.journal = [];
        this.theses = [];
        this.cash = { stock: 0, etf: 0 };
        this.opportunities = [];
        this.transactions = [];
        this.prefs = normalizePrefs({});
        this.customPortfolios = [];
        this.macroWeather = emptyWeather();
        this.macroIndicators = emptyIndicators();
        this.macroBriefs = this.macroBriefs.filter((b) => b.id.startsWith('live_'));
        this.macroEvents = this.macroEvents.filter((e) => e.id.startsWith('wscn_'));
        this.industryFocus = this.industryFocus.filter((i) => i.id.startsWith('plate_'));
        this.macroBriefsError = '';
        this.macroEventsError = '';
        this.industryFocusError = '';
        this.navSnapshots = [];
      } finally {
        setHydrating(false);
      }
    },
    snapshot() {
      return {
        at: new Date().toISOString(),
        version: 2,
        updatedAt: this.prefs.updatedAt || Date.now(),
        holdings: this.holdings,
        cash: this.cash,
        quotes: this.quotes,
        navSnapshots: this.navSnapshots,
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
        macroBriefs: this.macroBriefs.filter((b) => b.id.startsWith('m_')),
        macroEvents: this.macroEvents.filter((e) => e.id.startsWith('ev_')),
        industryFocus: this.industryFocus.filter((i) => i.id.startsWith('ind_')),
      };
    },
    restoreSnapshot(data: any): { success: boolean; message: string; counts?: Record<string, number> } {
      if (!data || typeof data !== 'object') {
        return { success: false, message: '无效的快照文件格式' };
      }
      if (!Array.isArray(data.holdings) || !data.cash) {
        return { success: false, message: '快照数据缺少核心持仓或资金字段' };
      }

      this.holdings = data.holdings;
      if (typeof data.cash.stock === 'number' && typeof data.cash.etf === 'number') {
        this.cash = { stock: data.cash.stock, etf: data.cash.etf };
      }
      if (Array.isArray(data.transactions)) this.transactions = data.transactions;
      if (Array.isArray(data.todos)) this.todos = data.todos;
      if (Array.isArray(data.theses)) this.theses = data.theses;
      if (Array.isArray(data.journal)) this.journal = data.journal;
      if (Array.isArray(data.opportunities)) this.opportunities = data.opportunities;
      if (data.prefs && typeof data.prefs === 'object') this.prefs = { ...this.prefs, ...data.prefs };
      if (Array.isArray(data.watchlist)) this.watchlist = data.watchlist;
      if (Array.isArray(data.customPortfolios)) this.customPortfolios = data.customPortfolios;
      if (data.macroWeather && typeof data.macroWeather === 'object') {
        this.macroWeather = { ...this.macroWeather, ...data.macroWeather };
      }
      if (Array.isArray(data.macroIndicators)) this.macroIndicators = data.macroIndicators;
      if (Array.isArray(data.macroBriefs)) {
        const live = this.macroBriefs.filter((b) => b.id.startsWith('live_'));
        const custom = data.macroBriefs.filter((b: MacroBrief) => b.id.startsWith('m_'));
        this.macroBriefs = [...custom, ...live];
      }
      if (Array.isArray(data.macroEvents)) {
        const live = this.macroEvents.filter((e) => e.id.startsWith('wscn_'));
        const custom = data.macroEvents.filter((e: MacroEvent) => e.id.startsWith('ev_'));
        this.macroEvents = [...custom, ...live];
      }
      if (Array.isArray(data.industryFocus)) {
        const live = this.industryFocus.filter((i) => i.id.startsWith('plate_'));
        const custom = data.industryFocus.filter((i: IndustryFocus) => i.id.startsWith('ind_'));
        this.industryFocus = [...custom, ...live];
      }
      if (Array.isArray(data.navSnapshots)) this.navSnapshots = data.navSnapshots;

      persist();
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
