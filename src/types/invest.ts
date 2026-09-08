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

export interface MacroBrief {
  id: string;
  time: string;
  title: string;
  body: string;
  topic: string;
  tone: string;
  account: AccountId | 'all';
}

export interface SmartPortfolio {
  id: string;
  name: string;
  risk: string;
  blurb: string;
  funds: { code: string; weight: number }[];
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

export interface Prefs {
  isolate: boolean;
  closeRemind: boolean;
  healthDate: Record<AccountId, string>;
  health: Record<AccountId, number>;
  healthDelta: Record<AccountId, number>;
}
