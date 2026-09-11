/**
 * PE 分位与买卖信号。分档线当前取 20/40/60/80（可在设置里改，见 research-settings.ts），
 * 宽基分位优先用中证官网真实历史分布，无数据源时退回手填参数。
 */
import { fetchOk, withRetry } from './http.ts';
import { marketGet, marketPut } from './market-cache.ts';
import { bands } from './research-settings.ts';
import type { SwL1Row } from './sw-valuation';
import { fetchSwL1Rows } from './sw-valuation';
import type { PctDelta } from './val-history';
import { daysBetween } from './val-history';

export type ValuationSignal = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'REDUCE' | 'SELL';

export type IndexCategory = 'broad' | 'dividend' | 'growth' | 'sector';

export interface IndexValuationConfig {
  code: string; // 腾讯指数代码，如 sh000300
  name: string; // 指数名称
  category: IndexCategory;
  categoryLabel: string;
  etfCode: string; // 对应场内主流 ETF 代码
  etfName: string; // ETF 名称
  description: string;
  // 历史 PE 分布基准（近 10 年统计参数）
  peStats: {
    min: number;
    p20: number; // 20% 机会低估线
    p50: number; // 50% 历史中位数
    p80: number; // 80% 风险警戒线
    max: number;
    avg: number;
  };
  // 历史 PB 分布基准
  pbStats?: {
    min: number;
    p20: number;
    p50: number;
    p80: number;
    max: number;
  };
  defaultDividendYield?: number; // 股息率 (%)
}

export interface IndexValuationItem {
  code: string;
  name: string;
  category: IndexCategory;
  categoryLabel: string;
  etfCode: string;
  etfName: string;
  description: string;
  price: number;
  changePct: number;
  pe: number;
  pePercentile: number; // 0 ~ 100
  pb: number;
  pbPercentile: number; // 0 ~ 100
  dividendYield: number;
  peStats: IndexValuationConfig['peStats'];
  signal: ValuationSignal;
  signalLabel: string;
  statusTag: 'success' | 'primary' | 'warning' | 'danger';
  color: string;
  advice: string;
  allocationTilt: string; // 仓位偏离建议，如 "+10%" 或 "-5%"
  updatedAt: string;
  count?: number; // 申万一级成分家数
  /** peStats 的来源：real = 中证官网近十年真实分布，manual = 手填基准参数（该指数无公开历史序列） */
  peStatsBasis?: 'real' | 'manual';
  /** 近约一月分位变化。宽基来自中证真历史（当天即有）；申万来自自积累快照（要攒两周）。 */
  pctDelta?: PctDelta | null;
}

export const INDEX_VALUATION_CONFIGS: IndexValuationConfig[] = [
  // 1. 核心大盘宽基
  {
    code: 'sh000300',
    name: '沪深300',
    category: 'broad',
    categoryLabel: '大盘宽基',
    etfCode: '510300',
    etfName: '沪深300ETF',
    description: 'A股核心资产压舱石，覆盖两市市值大、流动性好的300只龙头',
    peStats: { min: 10.3, p20: 11.5, p50: 12.8, p80: 14.8, max: 18.9, avg: 13.1 },
    pbStats: { min: 1.15, p20: 1.25, p50: 1.4, p80: 1.62, max: 2.1 },
    defaultDividendYield: 2.85,
  },
  {
    code: 'sh000510',
    name: '中证A500',
    category: 'broad',
    categoryLabel: '大盘宽基',
    etfCode: '560510',
    etfName: '中证A500ETF',
    description: '新一代核心宽基标杆，细分行业龙头均衡覆盖，ESG与互联互通双优',
    peStats: { min: 11.2, p20: 12.8, p50: 14.5, p80: 16.8, max: 20.5, avg: 14.8 },
    pbStats: { min: 1.22, p20: 1.35, p50: 1.52, p80: 1.75, max: 2.25 },
    defaultDividendYield: 2.72,
  },
  {
    code: 'sh000016',
    name: '上证50',
    category: 'broad',
    categoryLabel: '大盘宽基',
    etfCode: '510050',
    etfName: '上证50ETF',
    description: '超大盘蓝筹风向标，金融、消费与重工业国央企中枢',
    peStats: { min: 8.2, p20: 9.3, p50: 10.2, p80: 11.8, max: 15.2, avg: 10.5 },
    pbStats: { min: 0.95, p20: 1.08, p50: 1.22, p80: 1.38, max: 1.75 },
    defaultDividendYield: 3.65,
  },
  {
    code: 'sh000905',
    name: '中证500',
    category: 'broad',
    categoryLabel: '大盘宽基',
    etfCode: '510500',
    etfName: '中证500ETF',
    description: '中盘成长核心代表，涵盖细分制造、新材料与硬科技中坚企业',
    peStats: { min: 16.5, p20: 21.0, p50: 26.5, p80: 34.0, max: 46.0, avg: 27.2 },
    pbStats: { min: 1.45, p20: 1.72, p50: 2.05, p80: 2.45, max: 3.2 },
    defaultDividendYield: 1.85,
  },
  {
    code: 'sh000852',
    name: '中证1000',
    category: 'broad',
    categoryLabel: '大盘宽基',
    etfCode: '512100',
    etfName: '中证1000ETF',
    description: '小盘高弹性风格，专精特新与中小创新企业集聚地',
    peStats: { min: 22.0, p20: 28.5, p50: 36.0, p80: 48.0, max: 65.0, avg: 37.8 },
    pbStats: { min: 1.85, p20: 2.15, p50: 2.58, p80: 3.12, max: 4.1 },
    defaultDividendYield: 1.45,
  },
  {
    code: 'sz399006',
    name: '创业板指',
    category: 'growth',
    categoryLabel: '成长科技',
    etfCode: '159915',
    etfName: '创业板ETF',
    description: '高成长创新龙头聚集，新能源、光伏、医药与新一代信息技术',
    peStats: { min: 26.0, p20: 34.0, p50: 48.0, p80: 64.0, max: 82.0, avg: 49.5 },
    pbStats: { min: 3.1, p20: 3.9, p50: 5.2, p80: 6.8, max: 9.5 },
    defaultDividendYield: 0.95,
  },
  {
    code: 'sh000688',
    name: '科创50',
    category: 'growth',
    categoryLabel: '成长科技',
    etfCode: '588000',
    etfName: '科创50ETF',
    description: '硬科技自立自强排头兵，半导体、AI芯片、先进制程与高端软件',
    peStats: { min: 32.0, p20: 42.0, p50: 65.0, p80: 85.0, max: 140.0, avg: 68.0 },
    pbStats: { min: 3.2, p20: 4.1, p50: 5.6, p80: 7.5, max: 11.2 },
    defaultDividendYield: 0.65,
  },

  // 2. 红利价值与防守底仓
  {
    // 中证红利低波动指数。场内 512890 跟踪的正是它（500 家中证官网名称「红利低波」）。
    // 注：代码含字母，/qt/ 报不到行情，价格/PE 由中证官网 index-perf 提供。
    code: 'H30269',
    name: '红利低波',
    category: 'dividend',
    categoryLabel: '红利防守',
    etfCode: '512890',
    etfName: '红利低波ETF',
    description: '高股息 + 低波动双因子筛选，防守配置压舱石与股息复利神器',
    peStats: { min: 4.6, p20: 5.8, p50: 7.0, p80: 8.3, max: 14.6, avg: 7.2 },
    pbStats: { min: 0.62, p20: 0.72, p50: 0.82, p80: 0.94, max: 1.15 },
    defaultDividendYield: 5.45,
  },
  {
    code: 'sh000922',
    name: '中证红利',
    category: 'dividend',
    categoryLabel: '红利防守',
    etfCode: '515080',
    etfName: '中证红利ETF',
    description: '两市连续现金分红能力强且股息率高的核心高股息资产组合',
    peStats: { min: 5.5, p20: 6.2, p50: 7.2, p80: 8.2, max: 10.1, avg: 7.3 },
    pbStats: { min: 0.68, p20: 0.78, p50: 0.88, p80: 1.02, max: 1.25 },
    defaultDividendYield: 5.12,
  },
];

/**
 * 分段经验累积分布函数计算分位数（0% ~ 100%）
 */
export function calcPercentile(val: number, stats: IndexValuationConfig['peStats']): number {
  if (!Number.isFinite(val) || val <= 0) return 50;
  if (val <= stats.min) return 1;
  if (val >= stats.max) return 99;

  if (val < stats.p20) {
    // [min, p20] -> [1, 20]
    return Math.round(1 + ((val - stats.min) / (stats.p20 - stats.min)) * 19);
  }
  if (val < stats.p50) {
    // [p20, p50] -> [20, 50]
    return Math.round(20 + ((val - stats.p20) / (stats.p50 - stats.p20)) * 30);
  }
  if (val < stats.p80) {
    // [p50, p80] -> [50, 80]
    return Math.round(50 + ((val - stats.p50) / (stats.p80 - stats.p50)) * 30);
  }
  // [p80, max] -> [80, 99]
  return Math.round(80 + ((val - stats.p80) / (stats.max - stats.p80)) * 19);
}

/** 中证官网近 N 年每日 PE 分布（index-perf 的 peg 字段即当日市盈率）。 */
export interface PeDistribution {
  /** quantiles[i] = 第 i 百分位对应的 PE(TTM)，数组长度 101 */
  quantiles: number[];
  currentPe: number;
  lastClose: number;
  lastChangePct: number;
  lastDate: string;
  years: number;
  /**
   * 近约一月分位变化：同一份十年序列里再取一个月前那条算出来的，无需自积累。
   * 源序列只有 PE、没有历史分位，但分位本就是相对十年分布算的，
   * 所以用同一套 quantiles 分别算两个时点的分位就得到方向。序列太短时为 null。
   */
  pctDelta?: PctDelta | null;
}

export const PE_DIST_YEARS = 10;
const PE_DIST_TTL_MS = 6 * 3600 * 1000;

/** 由升序分位数组线性插值求某 PE 所处的百分位（0~100）。 */
export function percentileFromQuantiles(pe: number, quantiles: number[]): number {
  const q = quantiles;
  if (!(pe > 0) || q.length < 2) return 50;
  if (pe <= q[0]) return 0;
  if (pe >= q[q.length - 1]) return 100;
  for (let i = 1; i < q.length; i++) {
    if (pe <= q[i]) {
      const lo = q[i - 1];
      const hi = q[i];
      const frac = hi === lo ? 0 : (pe - lo) / (hi - lo);
      return Math.round(((i - 1 + frac) * 100) / (q.length - 1));
    }
  }
  return 100;
}

/** 从升序分位数组抽出 min/p20/p50/p80/max，用于图示的历史区间基准线。 */
export function statsFromQuantiles(q: number[]): IndexValuationConfig['peStats'] {
  const at = (p: number) => q[Math.round((p * (q.length - 1)) / 100)] ?? 0;
  const avg = q.reduce((s, v) => s + v, 0) / q.length;
  return { min: at(0), p20: at(20), p50: at(50), p80: at(80), max: at(100), avg: Number(avg.toFixed(2)) };
}

function quantilesOf(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const n = 100;
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    out.push(Number(sorted[Math.round((i / n) * (sorted.length - 1))].toFixed(2)));
  }
  return out;
}

/**
 * 取中证官网近 N 年逐日 PE，压成 101 个经验分位点。
 * 结果只有约 700 字节，缓存 6h；源数据 115KB（已 gzip），所以缓存分发而非原始序列。
 * 不在中证指数序列内的标的（如创业板指 399006）返回 null。
 */
export async function fetchIndexPeDistribution(
  prefixedCode: string,
  years = PE_DIST_YEARS,
  force = false,
): Promise<PeDistribution | null> {
  const key = `csidx-pe-dist-v2-${prefixedCode}-${years}`;
  if (!force) {
    const hit = await marketGet<PeDistribution>(key, PE_DIST_TTL_MS);
    if (hit?.quantiles?.length) return hit;
  }
  const code6 = prefixedCode.replace(/^(sh|sz|bj)/i, '');
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const end = new Date();
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - years);

  const res = await fetchOk(
    `/csindex/csindex-home/perf/index-perf?indexCode=${code6}&startDate=${fmt(start)}&endDate=${fmt(end)}`,
    {
      headers: { Referer: 'https://www.csindex.com.cn/' },
      signal: AbortSignal.timeout(30000),
    },
  );
  const json = (await res.json()) as { data?: Array<Record<string, unknown>> };
  const rows = Array.isArray(json.data) ? json.data : [];
  const pes: number[] = [];
  const samples: Array<{ d: string; pe: number }> = [];
  let last: Record<string, unknown> | null = null;
  for (const row of rows) {
    const pe = Number(row.peg);
    if (!Number.isFinite(pe) || pe <= 0) continue;
    pes.push(pe);
    const d = isoDate(String(row.tradeDate ?? ''));
    if (d) samples.push({ d, pe });
    last = row;
  }
  // 样本过少说明该指数不在中证序列，宁可不给分布也不用垃圾数据算分位
  if (pes.length < 120 || !last) return null;
  const quantiles = quantilesOf(pes);
  const dist: PeDistribution = {
    quantiles,
    currentPe: Number(Number(last.peg).toFixed(2)),
    lastClose: Number(last.close) || 0,
    lastChangePct: Number(last.changePct) || 0,
    lastDate: isoDate(String(last.tradeDate ?? '')),
    years,
    pctDelta: realPctDelta(samples, quantiles),
  };
  marketPut(key, dist, PE_DIST_TTL_MS);
  return dist;
}

/** 中证官网 tradeDate 是 YYYYMMDD，统一成 YYYY-MM-DD；异常返回空串。 */
export function isoDate(raw: string): string {
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
}

/** 回看窗口：与 val-history 的「近1月」对齐，留一点容错。 */
const REAL_LOOKBACK_DAYS = 35;
const REAL_MIN_SPAN_DAYS = 10;

/**
 * 从已下载的序列里取窗口内最早一条当基准，算分位变化。
 * 跟 val-history.pctDeltaOf 同语义（取最早而非最近，跨越不足不给），
 * 但基准来自真实历史而非自积累快照，所以宽基当天就能看到方向。
 */
export function realPctDelta(samples: Array<{ d: string; pe: number }>, quantiles: number[]): PctDelta | null {
  if (samples.length < 2) return null;
  const now = samples[samples.length - 1];
  const base = samples.find((s) => daysBetween(s.d, now.d) <= REAL_LOOKBACK_DAYS);
  if (!base || base.d === now.d) return null;
  const span = daysBetween(base.d, now.d);
  if (span < REAL_MIN_SPAN_DAYS) return null;
  const from = percentileFromQuantiles(base.pe, quantiles);
  const to = percentileFromQuantiles(now.pe, quantiles);
  return { span, delta: to - from, from, to };
}

/**
 * 根据分位数推导买卖信号与操作指引
 */
/**
 * 每档的视觉表达按**档位序号**固定，不跟着用户改的文案走 ——
 * 改了「偏低」的叫法不该让颜色和 tag 也跟着变，否则调一次阈值就把整套视觉调乱了。
 */
const BAND_STYLES = [
  { signal: 'STRONG_BUY', statusTag: 'success', color: '#16815f' },
  { signal: 'BUY', statusTag: 'primary', color: '#2a9d8f' },
  { signal: 'HOLD', statusTag: 'warning', color: '#b8782d' },
  { signal: 'REDUCE', statusTag: 'warning', color: '#e76f51' },
  { signal: 'SELL', statusTag: 'danger', color: '#b8433e' },
] as const;

/** 分位落在第几档（0 起）。传 list 便于测试；默认用当前生效的设置。 */
export function bandIndexOf(pct: number, list: Array<{ max: number }> = bands.value): number {
  for (let i = 0; i < list.length; i++) {
    if (pct < list[i]!.max) return i;
  }
  return Math.max(0, list.length - 1);
}

export function deriveValuationSignal(pct: number): {
  signal: ValuationSignal;
  label: string;
  statusTag: 'success' | 'primary' | 'warning' | 'danger';
  color: string;
  tilt: string;
  advice: string;
} {
  const list = bands.value;
  const i = bandIndexOf(pct, list);
  const band = list[i]!;
  const style = BAND_STYLES[i]!;
  return {
    signal: style.signal,
    label: band.label,
    statusTag: style.statusTag,
    color: style.color,
    tilt: band.tilt,
    advice: `分位${band.label}`,
  };
}

/**
 * 批量拉取指数最新估值快照
 */
function dummyPeStats(pe: number): IndexValuationConfig['peStats'] {
  const p = pe > 0 ? pe : 1;
  return { min: p * 0.4, p20: p * 0.7, p50: p, p80: p * 1.4, max: p * 2, avg: p };
}

function swToItem(row: SwL1Row, nowStr: string): IndexValuationItem {
  const pct = Math.round(Math.max(0, Math.min(100, row.pePercentile)));
  const sig = deriveValuationSignal(pct);
  return {
    code: row.code,
    name: row.name,
    category: 'sector',
    categoryLabel: '申万一级',
    etfCode: '',
    etfName: '',
    description: `申万一级 · ${row.count} 家`,
    price: 0,
    changePct: 0,
    pe: Number(row.pe.toFixed(2)),
    pePercentile: pct,
    pb: Number(row.pb.toFixed(2)),
    pbPercentile: Math.round(row.pbPercentile),
    dividendYield: Number(row.dividendYield.toFixed(2)),
    peStats: dummyPeStats(row.pe),
    signal: sig.signal,
    signalLabel: sig.label,
    statusTag: sig.statusTag,
    color: sig.color,
    advice: sig.advice,
    allocationTilt: sig.tilt,
    updatedAt: nowStr,
    count: row.count,
  };
}

/**
 * 单独组装一条估值。
 * 价格/涨跌优先用 /qt/ 实时行情，缺失则退回中证官网收盘值（EOD）；两者都无则置 0
 * （UI 显示 —），**不编造点位**。分位优先用真实历史分布，无数据源时退回手填参数并标 manual。
 */
function buildItem(
  cfg: IndexValuationConfig,
  q: { price: number; changePct: number; pe: number; pb: number } | undefined,
  dist: PeDistribution | null,
  nowStr: string,
): IndexValuationItem {
  const peStats = dist ? statsFromQuantiles(dist.quantiles) : cfg.peStats;
  const rawPe = q?.pe && q.pe > 0 ? q.pe : dist?.currentPe || cfg.peStats.p50;
  const livePrice = !!(q?.price && q.price > 0);
  const price = livePrice ? q!.price : dist?.lastClose || 0;
  const changePct = livePrice ? q!.changePct : (dist?.lastChangePct ?? 0);
  const pb = q?.pb && q.pb > 0 ? q.pb : (cfg.pbStats?.p50 ?? 1.5);
  const pePercentile = dist ? percentileFromQuantiles(rawPe, dist.quantiles) : calcPercentile(rawPe, cfg.peStats);
  const pbPercentile = cfg.pbStats ? calcPercentile(pb, { ...cfg.peStats, ...cfg.pbStats, avg: cfg.pbStats.p50 }) : 50;
  const sig = deriveValuationSignal(pePercentile);
  return {
    code: cfg.code,
    name: cfg.name,
    category: cfg.category,
    categoryLabel: cfg.categoryLabel,
    etfCode: cfg.etfCode,
    etfName: cfg.etfName,
    description: cfg.description,
    price: Number(price.toFixed(2)),
    changePct: Number(changePct.toFixed(2)),
    pe: Number(rawPe.toFixed(2)),
    pePercentile,
    pb: Number(pb.toFixed(2)),
    pbPercentile,
    dividendYield: cfg.defaultDividendYield ?? 2.5,
    peStats,
    peStatsBasis: dist ? 'real' : 'manual',
    pctDelta: dist?.pctDelta ?? null,
    signal: sig.signal,
    signalLabel: sig.label,
    statusTag: sig.statusTag,
    color: sig.color,
    advice: sig.advice,
    allocationTilt: sig.tilt,
    updatedAt: nowStr,
  };
}

async function fetchDistributions(force: boolean): Promise<Map<string, PeDistribution | null>> {
  const out = new Map<string, PeDistribution | null>();
  await Promise.all(
    INDEX_VALUATION_CONFIGS.map(async (cfg) => {
      out.set(cfg.code, await fetchIndexPeDistribution(cfg.code, PE_DIST_YEARS, force).catch(() => null));
    }),
  );
  return out;
}

/**
 * 腾讯指数行情解析（`/qt/q=sh000300,sz399006`）。
 *
 * 字段位置是这个接口最容易踩的地方，所以单独拎出来可测：
 * `vals[30]` 是时间戳（如 `20260908161415`），`vals[32]` 才是涨跌幅；
 * `vals[37]` 是成交额（万元，如 `49208662`），`vals[39]` 才是 PE(TTM)。
 * 拿错一格不会报错 —— 时间戳当涨跌幅是 2e13%，成交额当 PE 是几千万倍，
 * 整张估值表的点位与分位会静默错掉。断言在 `scripts/check-valuation.ts`。
 */
export function parseIndexQuotes(
  text: string,
): Map<string, { price: number; changePct: number; pe: number; pb: number }> {
  const out = new Map<string, { price: number; changePct: number; pe: number; pb: number }>();
  for (const chunk of text.split(';')) {
    const m = chunk.match(/v_([a-z]{2}\d+)=["']([^"']*)["']/i);
    if (!m) continue;
    const vals = m[2].split('~');
    const pe = Number(vals[39]);
    const pb = Number(vals[46]);
    out.set(m[1].toLowerCase(), {
      price: Number(vals[3]) || 0,
      changePct: Number(vals[32]) || 0,
      pe: pe > 0 ? pe : 0,
      pb: pb > 0 ? pb : 0,
    });
  }
  return out;
}

export async function fetchIndexValuations(force = false): Promise<IndexValuationItem[]> {
  const codes = INDEX_VALUATION_CONFIGS.map((c) => c.code);
  const nowStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  // 真实分位分布与 /qt/ 行情相互独立：行情接口挂了也能照常算分位
  const dists = await fetchDistributions(force);

  try {
    const res = await fetch(`/qt/q=${codes.join(',')}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const text = new TextDecoder('gbk').decode(await res.arrayBuffer());

    // 解析腾讯指数数据
    const quoteMap = parseIndexQuotes(text);

    const core = INDEX_VALUATION_CONFIGS.map((cfg) =>
      buildItem(cfg, quoteMap.get(cfg.code.toLowerCase()), dists.get(cfg.code) ?? null, nowStr),
    );
    return appendSw(core, nowStr, force);
  } catch (err) {
    console.warn('获取实时指数行情降级为中证官网收盘值:', err);
    // 降级：价格退回中证官网收盘值（无则置 0，UI 显示 —），不编造点位
    const core = INDEX_VALUATION_CONFIGS.map((cfg) => buildItem(cfg, undefined, dists.get(cfg.code) ?? null, nowStr));
    return appendSw(core, nowStr, force);
  }
}

async function appendSw(core: IndexValuationItem[], nowStr: string, force: boolean) {
  const sw = await fetchSwL1Rows(force).catch((e) => {
    console.warn('申万一级估值失败', e);
    return [];
  });
  return [...core, ...sw.map((r) => swToItem(r, nowStr))];
}

export interface IndexPeHistory {
  dates: string[]; // YYYY-MM-DD
  peValues: number[];
  isSimulated: boolean;
}

/**
 * 从中证官网（经 /csindex/ 反代）拉取指数真实 PE 历史。
 * 数据源字段 peg 即每日收盘对应的市盈率。失败或样本过少返回 null（调用方显示无数据提示，不再回退假序列）。
 */
export async function fetchIndexPeHistory(prefixedCode: string, years = 3): Promise<IndexPeHistory | null> {
  const code6 = prefixedCode.replace(/^(sh|sz|bj)/i, '');
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const end = new Date();
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - years);

  try {
    const res = await withRetry(() =>
      fetchOk(`/csindex/csindex-home/perf/index-perf?indexCode=${code6}&startDate=${fmt(start)}&endDate=${fmt(end)}`, {
        headers: { Referer: 'https://www.csindex.com.cn/' },
      }),
    );
    const json = (await res.json()) as { data?: Array<Record<string, unknown>> };
    const rows = Array.isArray(json.data) ? json.data : [];
    const dates: string[] = [];
    const peValues: number[] = [];
    for (const row of rows) {
      const peg = Number(row.peg);
      const d = isoDate(String(row.tradeDate ?? ''));
      if (!Number.isFinite(peg) || peg <= 0 || !d) continue;
      dates.push(d);
      peValues.push(Number(peg.toFixed(2)));
    }
    if (dates.length < 10) return null;
    return { dates, peValues, isSimulated: false };
  } catch {
    return null;
  }
}
