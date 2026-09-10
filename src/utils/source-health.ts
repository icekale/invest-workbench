/**
 * 数据源自检。
 *
 * 目的只有一个：把「界面上看着不对」拆成「上游不通」还是「缓存脏了」。
 * 之前每次都得手工 curl 才分得清，而这个区分决定了要不要重取、还是等一等。
 *
 * 两个刻意的设计：
 *
 * 1. **不另建探针 URL，直接调真实 loader。** 探针和真实请求一旦分叉，自检就会
 *    开始说谎 —— 探针通了不代表页面通了。顺带的好处是带 force 的 loader 走 force，
 *    所以「自检」本身就是「重取数据」，一次动作既验证通路又刷新缓存。
 *
 * 2. **顺序跑，不并行。** 并行正是之前 WSCN 超时的诱因（317KB 抢带宽被 6s abort），
 *    而且顺序执行能一行一行看到卡在哪 —— 这正是自检要的信息，不是副作用。
 */
import { fetchAfre } from './afre';
import { fetchLiveMacroBriefs } from './briefs';
import { fetchLiveMacroEvents } from './calendar';
import { authHeader, hasSyncCreds, pullCloudSnapshot } from './cloud-sync';
import { fetchFundRank } from './fund';
import { fetchLiveIndustryCatalysts } from './industry';
import { fetchMacroBundle } from './macro-cn';
import { marketClearMemory } from './market-cache';
import { fetchQuotes } from './quote';
import { fetchSwClass } from './sw-industry';
import { fetchSwL1Rows } from './sw-valuation';
import { fetchIndexValuations } from './valuation';

export type HealthStatus = 'idle' | 'running' | 'ok' | 'fail';

export interface SourceSpec {
  id: string;
  /** 界面上显示的名字 */
  name: string;
  /** 反代前缀，用来对账 Caddyfile */
  path: string;
  /** 缓存键前缀（有缓存的源才填），用来对账「缓存里存的是什么」 */
  cacheKey?: string;
  ttl: string;
  /** 真打一次上游，返回一行摘要；抛错即判失败 */
  probe: (force: boolean) => Promise<string>;
}

export interface HealthRow extends Omit<SourceSpec, 'probe'> {
  status: HealthStatus;
  detail: string;
  /** 耗时毫秒 */
  ms: number;
}

/** 单个源最多等这么久，免得一个卡死拖住整张表 */
const PROBE_TIMEOUT_MS = 25_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`超时 ${ms / 1000}s`)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** 晨会用的模型清单。顺带验证 /llm 反代通不通 —— 模型选择器也用它，不留第二份。 */
export async function fetchLlmModels(): Promise<string[]> {
  // 必须带认证：Caddyfile 的 /llm 和 /sync 走同一套 Basic，晨会也是这么调的。
  // 漏了这个头，模型列表会静默 401，看起来像「后端没模型」。
  const res = await fetch('/llm/v1/models', { headers: { Authorization: authHeader() } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { data?: Array<{ id?: string }> };
  return (json.data ?? []).map((m) => m.id).filter((id): id is string => !!id);
}

export const SOURCES: SourceSpec[] = [
  {
    id: 'qt',
    name: '行情快照',
    path: '/qt',
    ttl: '不缓存',
    probe: async () => {
      const m = await fetchQuotes(['sh000300', 'sh000905', 'sz399006']);
      if (!m.size) throw new Error('返回 0 条');
      return `${m.size} 条行情`;
    },
  },
  {
    id: 'em',
    name: '基金排行',
    path: '/em',
    ttl: '不缓存',
    probe: async () => {
      const rows = await fetchFundRank(10);
      if (!rows.length) throw new Error('返回 0 条');
      return `${rows.length} 只基金`;
    },
  },
  {
    id: 'csindex',
    name: '指数估值分位',
    path: '/csindex',
    cacheKey: 'csidx-pe-dist-v2-',
    ttl: '6h',
    probe: async (force) => {
      const list = await fetchIndexValuations(force);
      if (!list.length) throw new Error('返回 0 个标的');
      return `${list.length} 个标的`;
    },
  },
  {
    id: 'legulegu',
    name: '申万一级估值',
    path: '/legulegu',
    cacheKey: 'sw-l1-valuation-v1',
    ttl: '6h',
    probe: async (force) => {
      const rows = await fetchSwL1Rows(force);
      if (rows.length < 20) throw new Error(`只有 ${rows.length} 个行业（应 31 个）`);
      return `${rows.length} 个行业`;
    },
  },
  {
    id: 'push2',
    name: '持仓行业分类',
    path: '/push2',
    ttl: '模块内 memo',
    probe: async (force) => {
      const m = await fetchSwClass(['600519', '000001', '300750'], force);
      const n = Object.keys(m).length;
      if (!n) throw new Error('三个样本都没分到申万一级');
      return `${n}/3 个样本已分类`;
    },
  },
  {
    id: 'wscn-events',
    name: '重点会议日历',
    path: '/wscn',
    cacheKey: 'invest-wscn:events:v3:30',
    ttl: '15min',
    probe: async (force) => {
      const rows = await fetchLiveMacroEvents(30, force);
      if (!rows.length) throw new Error('返回 0 条会议');
      return `${rows.length} 条会议`;
    },
  },
  {
    id: 'wscn-lives',
    name: '盘中快讯',
    path: '/wscn',
    cacheKey: 'invest-wscn:lives',
    ttl: '15min',
    probe: async (force) => {
      const rows = await fetchLiveMacroBriefs(force);
      if (!rows.length) throw new Error('返回 0 条快讯');
      return `${rows.length} 条快讯`;
    },
  },
  {
    id: 'xgb',
    name: '题材催化',
    path: '/xgb',
    cacheKey: 'invest-xgb:plates',
    ttl: '15min',
    probe: async (force) => {
      const rows = await fetchLiveIndustryCatalysts(force);
      if (!rows.length) throw new Error('返回 0 个题材');
      return `${rows.length} 个题材`;
    },
  },
  {
    id: 'em-dc',
    name: '宏观现数 PMI/CPI/GDP',
    path: '/em-dc',
    cacheKey: 'em-dc:',
    ttl: '6h',
    probe: async (force) => {
      const b = await fetchMacroBundle(force);
      const n = [b.pmi, b.cpi, b.gdp].filter(Boolean).length;
      if (!n) throw new Error('PMI/CPI/GDP 全空');
      return `${n}/3 个指标有值`;
    },
  },
  {
    id: 'afre',
    name: '社融（人行）',
    path: '/sync/afre',
    cacheKey: 'pbc:afre',
    ttl: '6h',
    probe: async (force) => {
      const rows = await fetchAfre('flow', force);
      if (!rows.length) throw new Error('返回 0 期');
      return `${rows.length} 期`;
    },
  },
  {
    id: 'sync',
    name: '云同步',
    path: '/sync',
    ttl: '—',
    probe: async () => {
      if (!hasSyncCreds()) throw new Error('未登录（本地没有同步凭据）');
      const snap = await pullCloudSnapshot();
      return snap ? '快照可读' : '快照为空（可能还没推过）';
    },
  },
  {
    id: 'llm',
    name: '晨会模型',
    path: '/llm',
    ttl: '不缓存',
    probe: async () => {
      const models = await fetchLlmModels();
      if (!models.length) throw new Error('模型列表为空');
      return `${models.length} 个模型可用`;
    },
  },
];

export function initialRows(): HealthRow[] {
  return SOURCES.map(({ probe: _p, ...rest }) => ({ ...rest, status: 'idle', detail: '', ms: 0 }));
}

/**
 * 逐个跑。每跑完一个就回调一次，界面能一行一行地亮起来 ——
 * 卡住时你要看的正是「卡在哪一行」。
 */
export async function runHealthCheck(
  force: boolean,
  onRow: (row: HealthRow) => void,
  sources: SourceSpec[] = SOURCES,
): Promise<HealthRow[]> {
  if (force) marketClearMemory();
  const done: HealthRow[] = [];
  for (const s of sources) {
    const { probe, ...meta } = s;
    const t0 = Date.now();
    onRow({ ...meta, status: 'running', detail: '请求中…', ms: 0 });
    let row: HealthRow;
    try {
      const detail = await withTimeout(probe(force), PROBE_TIMEOUT_MS);
      row = { ...meta, status: 'ok', detail, ms: Date.now() - t0 };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      row = { ...meta, status: 'fail', detail: msg, ms: Date.now() - t0 };
    }
    done.push(row);
    onRow(row);
  }
  return done;
}
