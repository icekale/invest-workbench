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

export interface MacroEvent {
  id: string;
  date: string;
  title: string;
  category: '宏观政策' | '货币金融' | '产业峰会' | '海外央行' | string;
  level: '重大' | '关键' | '关注';
  impact: string;
  beneficiaries: string[];
  suggestedAction?: string;
  account?: AccountId | 'all';
}

export interface IndustryFocus {
  id: string;
  name: string;
  cycleStage: string;
  heat: number;
  trend: 'up' | 'stable' | 'down';
  catalyst: string;
  category?: '科技制造' | '医药消费' | '周期资源' | '金融地产' | '综合主题' | string;
  keyTargets: Array<{
    code: string;
    name: string;
    type: 'ETF' | '个股';
    changePercent?: number;
  }>;
  tactic: string;
  account?: AccountId | 'all';
  updatedAt: string;
  source?: string;
  changeRate?: number;
  limitUpCount?: number;
  riseCount?: number;
  fallCount?: number;
  fundFlow?: number;
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

export interface TradeModalOptions {
  account?: AccountId;
  side?: TradeSide;
  code?: string;
  name?: string;
  price?: number;
  quantity?: number;
  todoId?: string;
  note?: string;
}

export interface ExecuteTradeParams {
  account: AccountId;
  side: TradeSide;
  code: string;
  name: string;
  price: number;
  quantity: number;
  date?: string;
  note?: string;
  todoId?: string;
}

export interface ExecuteTradeResult {
  success: boolean;
  message: string;
  amount: number;
  transactionId: string;
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
