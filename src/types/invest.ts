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
  health: Health;
  action: ActionPoint;
  thesisId: string;
}

export interface MacroNote {
  id: string;
  title: string;
  body: string;
  date: string;
}

export interface Fund {
  code: string;
  name: string;
  manager: string;
  type: string;
  yield: number;
  vix: number;
  loss: number;
  score: number;
  star: number;
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
  body: string;
}
