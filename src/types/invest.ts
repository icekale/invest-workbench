export type AccountId = 'stock' | 'etf';
export type Health = 'healthy' | 'watch' | 'alert';
export type ActionPoint = 'hold' | 'add' | 'reduce' | 'exit';
export type ThesisStatus = 'valid' | 'watch' | 'invalid';
export type TradeSide = 'buy' | 'sell';
export type TodoStatus = 'open' | 'done';

export interface Holding {
  account: AccountId;
  code: string;
  name: string;
  quantity: number;
  cost: number;
  tag?: string;
  health: Health;
  action: ActionPoint;
  thesisId: string;
}

export interface MacroWeather {
  cycle: string;
  sentiment: '偏多' | '中性' | '谨慎' | '防守' | string;
  suggestedStockPos: string;
  suggestedEtfPos: string;
  updatedAt: string;
}

export interface MacroIndicator {
  id: string;
  name: string;
  value: string;
  status: string;
  theme: 'success' | 'warning' | 'danger' | 'default';
  hint: string;
}

export interface MacroBrief {
  id: string;
  time: string;
  title: string;
  body: string;
  topic: string;
  tone: string;
  account: AccountId | 'all';
  actionAdvice?: string;
  suggestedTodo?: {
    account: AccountId;
    code?: string;
    name: string;
    side: TradeSide;
    quantity?: number;
    reason: string;
  };
}

export interface SmartPortfolioFund {
  code: string;
  weight: number;
  name: string;
  type?: string;
  nav?: number | null;
  year?: number | null;
}

export interface SmartPortfolio {
  id: string;
  name: string;
  risk: string;
  blurb: string;
  funds: SmartPortfolioFund[];
}

export interface CustomPortfolio {
  id: string;
  name: string;
  desc: string;
  maxLoss: number;
  codes: string[];
}

export interface PlanTarget {
  code: string;
  account: AccountId;
  targetWeight: number;
}
export interface TradeTodo {
  id: string;
  account: AccountId;
  code: string;
  name: string;
  side: TradeSide;
  quantity: number;
  reason: string;
  status: TodoStatus;
}
export interface DisciplineRule {
  id: string;
  title: string;
  limit: number;
}

export interface Thesis {
  id: string;
  code: string;
  title: string;
  body: string;
  status: ThesisStatus;
}
export interface JournalEntry {
  id: string;
  date: string;
  topic: string;
  conclusion: string;
  body: string;
}

export interface Opportunity {
  id: string;
  name: string;
  account: AccountId;
  thesis: string;
  score: number;
  note: string;
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  account: AccountId;
  code: string;
  name: string;
  side: TradeSide;
  price: number;
  quantity: number;
  amount: number;
  fee?: number;
  note?: string;
}

export interface LedgerSummary {
  totalBuyAmount: number;
  totalSellAmount: number;
  realizedPnL: number;
  totalFee: number;
  turnoverRate: number; // 换手率，小数，如 0.25 表示 25%
  tradeCount: number;
}

export type AlertType = 'take_profit' | 'stop_loss' | 'thesis_risk' | 'rebalance' | 'valuation';
export type AlertLevel = 'info' | 'warning' | 'danger';

export interface TradeAlert {
  id: string;
  code: string;
  name: string;
  account: AccountId;
  type: AlertType;
  level: AlertLevel;
  title: string;
  detail: string;
  suggestedAction: ActionPoint;
  suggestedQty?: number;
  triggerTime: string;
  isRead?: boolean;
}

export interface Prefs {
  isolate: boolean;
  closeRemind: boolean;
  healthDate: Record<AccountId, string>;
  health: Record<AccountId, number>;
  healthDelta: Record<AccountId, number>;
  stopLossPct?: number; // 默认 -8%
  takeProfitPct?: number; // 默认 25%
  rebalanceThresholdPct?: number; // 默认 3%
}
