/** PE 分位：<40 偏低，40–60 中性，>60 偏高。桶仍用 20/50/80 插值。 */
import { fetchOk, withRetry } from './http.ts';

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
    code: 'sh000015',
    name: '红利低波',
    category: 'dividend',
    categoryLabel: '红利防守',
    etfCode: '512890',
    etfName: '红利低波ETF',
    description: '高股息 + 低波动双因子筛选，防守配置压舱石与股息复利神器',
    peStats: { min: 5.2, p20: 5.8, p50: 6.6, p80: 7.8, max: 9.2, avg: 6.7 },
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

  // 3. 行业与主题赛道
  {
    code: 'sh000932',
    name: '中证主要消费',
    category: 'sector',
    categoryLabel: '消费赛道',
    etfCode: '159928',
    etfName: '消费ETF',
    description: '必需消费与白酒龙头，抗通胀韧性与深厚品牌护城河',
    peStats: { min: 18.0, p20: 23.0, p50: 30.0, p80: 38.0, max: 48.0, avg: 31.0 },
    pbStats: { min: 3.5, p20: 4.8, p50: 6.5, p80: 8.8, max: 12.0 },
    defaultDividendYield: 2.65,
  },
  {
    code: 'sh000933',
    name: '中证医药卫生',
    category: 'sector',
    categoryLabel: '医药赛道',
    etfCode: '512010',
    etfName: '医药ETF',
    description: '涵盖创新药、医疗器械与CXO，长期人口老龄化刚需底仓',
    peStats: { min: 24.0, p20: 29.0, p50: 36.0, p80: 44.0, max: 58.0, avg: 37.0 },
    pbStats: { min: 2.8, p20: 3.5, p50: 4.5, p80: 5.8, max: 7.8 },
    defaultDividendYield: 1.62,
  },
  {
    code: 'sz399975',
    name: '证券公司',
    category: 'sector',
    categoryLabel: '大金融',
    etfCode: '512880',
    etfName: '证券ETF',
    description: '牛市先锋与行情放大器，强Beta属性，牛市启动期进攻利器',
    peStats: { min: 12.0, p20: 16.0, p50: 21.0, p80: 27.0, max: 38.0, avg: 22.0 },
    pbStats: { min: 1.15, p20: 1.32, p50: 1.55, p80: 1.88, max: 2.6 },
    defaultDividendYield: 2.15,
  },
  {
    code: 'sh000977',
    name: '内地低碳',
    category: 'sector',
    categoryLabel: '周期制造',
    etfCode: '516160',
    etfName: '新能源ETF',
    description: '电力电网、新能源整车、储能与光伏制造全产业链',
    peStats: { min: 16.0, p20: 22.0, p50: 32.0, p80: 45.0, max: 62.0, avg: 34.0 },
    pbStats: { min: 1.8, p20: 2.4, p50: 3.5, p80: 4.8, max: 7.2 },
    defaultDividendYield: 1.35,
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

/**
 * 根据分位数推导买卖信号与操作指引
 */
export function deriveValuationSignal(pct: number): {
  signal: ValuationSignal;
  label: string;
  statusTag: 'success' | 'primary' | 'warning' | 'danger';
  color: string;
  tilt: string;
  advice: string;
} {
  if (pct < 20) {
    return {
      signal: 'STRONG_BUY',
      label: '偏低',
      statusTag: 'success',
      color: '#16815f',
      tilt: '+10% ~ +15%',
      advice: '分位偏低',
    };
  }
  if (pct < 40) {
    return {
      signal: 'BUY',
      label: '偏低',
      statusTag: 'primary',
      color: '#2a9d8f',
      tilt: '+5% ~ +10%',
      advice: '分位偏低',
    };
  }
  if (pct < 60) {
    return {
      signal: 'HOLD',
      label: '中性',
      statusTag: 'warning',
      color: '#b8782d',
      tilt: '标配 (0%)',
      advice: '分位中性',
    };
  }
  if (pct < 80) {
    return {
      signal: 'REDUCE',
      label: '偏高',
      statusTag: 'warning',
      color: '#e76f51',
      tilt: '-5% ~ -10%',
      advice: '分位偏高',
    };
  }
  return {
    signal: 'SELL',
    label: '偏高',
    statusTag: 'danger',
    color: '#b8433e',
    tilt: '-10% ~ -20%',
    advice: '分位偏高',
  };
}

/**
 * 批量拉取指数最新估值快照
 */
export async function fetchIndexValuations(): Promise<IndexValuationItem[]> {
  const codes = INDEX_VALUATION_CONFIGS.map((c) => c.code);
  const nowStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  try {
    const res = await fetch(`/qt/q=${codes.join(',')}`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const text = new TextDecoder('gbk').decode(await res.arrayBuffer());

    // 解析腾讯指数数据
    const quoteMap = new Map<string, { price: number; changePct: number; pe: number; pb: number }>();
    for (const chunk of text.split(';')) {
      const m = chunk.match(/v_([a-z]{2}\d+)=["']([^"']*)["']/i);
      if (!m) continue;
      const key = m[1].toLowerCase();
      const vals = m[2].split('~');
      const price = Number(vals[3]) || 0;
      // vals[32] 为涨跌幅百分比（如 -0.36），vals[30] 为时间戳（如 20260908161415）不可作为涨跌幅
      const changePct = Number(vals[32]) || 0;
      // vals[39] 为动态市盈率 PE(TTM)，vals[37] 为成交额（万元，如 49208662）不可作为市盈率
      const pe = Number(vals[39]) > 0 ? Number(vals[39]) : 0;
      const pb = Number(vals[46]) > 0 ? Number(vals[46]) : 0;
      quoteMap.set(key, { price, changePct, pe, pb });
    }

    return INDEX_VALUATION_CONFIGS.map((cfg) => {
      const q = quoteMap.get(cfg.code.toLowerCase());
      const rawPe = q?.pe && q.pe > 0 ? q.pe : cfg.peStats.p50;
      const price = q?.price && q.price > 0 ? Number(q.price.toFixed(2)) : Number((cfg.peStats.p50 * 100).toFixed(2));
      const changePct = q ? Number(q.changePct.toFixed(2)) : 0;
      const pb = q?.pb && q.pb > 0 ? Number(q.pb.toFixed(2)) : (cfg.pbStats?.p50 ?? 1.5);

      const pePercentile = calcPercentile(rawPe, cfg.peStats);
      const pbPercentile = cfg.pbStats
        ? calcPercentile(pb, { ...cfg.peStats, ...cfg.pbStats, avg: cfg.pbStats.p50 })
        : 50;

      const sig = deriveValuationSignal(pePercentile);

      return {
        code: cfg.code,
        name: cfg.name,
        category: cfg.category,
        categoryLabel: cfg.categoryLabel,
        etfCode: cfg.etfCode,
        etfName: cfg.etfName,
        description: cfg.description,
        price,
        changePct,
        pe: Number(rawPe.toFixed(2)),
        pePercentile,
        pb: Number(pb.toFixed(2)),
        pbPercentile,
        dividendYield: cfg.defaultDividendYield ?? 2.5,
        peStats: cfg.peStats,
        signal: sig.signal,
        signalLabel: sig.label,
        statusTag: sig.statusTag,
        color: sig.color,
        advice: sig.advice,
        allocationTilt: sig.tilt,
        updatedAt: nowStr,
      };
    });
  } catch (err) {
    console.warn('获取实时指数行情降级为基准参数:', err);
    // 降级：价格置 0（UI 显示 —），估值用历史中枢，不编造点位
    return INDEX_VALUATION_CONFIGS.map((cfg) => {
      const pe = cfg.peStats.p50;
      const pePercentile = 50;
      const sig = deriveValuationSignal(pePercentile);
      return {
        code: cfg.code,
        name: cfg.name,
        category: cfg.category,
        categoryLabel: cfg.categoryLabel,
        etfCode: cfg.etfCode,
        etfName: cfg.etfName,
        description: cfg.description,
        price: 0,
        changePct: 0,
        pe,
        pePercentile,
        pb: cfg.pbStats?.p50 ?? 1.5,
        pbPercentile: 50,
        dividendYield: cfg.defaultDividendYield ?? 2.5,
        peStats: cfg.peStats,
        signal: sig.signal,
        signalLabel: sig.label,
        statusTag: sig.statusTag,
        color: sig.color,
        advice: sig.advice,
        allocationTilt: sig.tilt,
        updatedAt: nowStr,
      };
    });
  }
}

/**
 * 生成指数估值走势序列（用于 ECharts 下钻走势弹窗）。
 * ⚠️ 当前没有可用的指数 PE 历史数据源，序列是基于当前 PE 与历史分位参数的
 * 确定性示意模拟（同一指数每次生成结果一致，不含随机数），
 * 仅用于展示「当前值落在历史区间的位置」，不能当作真实历史行情。
 * 图表标题与注释必须带「示意」字样。
 * 优先使用 fetchIndexPeHistory() 的中证官网真实历史。
 */
export function generateValuationHistorySeries(item: IndexValuationItem, years = 3) {
  const dates: string[] = [];
  const peValues: number[] = [];
  const now = new Date();
  const totalMonths = years * 12;

  const base = item.peStats.p50;
  const amp = (item.peStats.max - item.peStats.min) * 0.38;
  // 以指数代码派生稳定相位，保证同一指数多次生成结果一致
  const phase = (item.code.charCodeAt(3) % 5) + (item.code.charCodeAt(4) % 3) * 0.4;

  for (let i = totalMonths; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    dates.push(dateStr);

    if (i === 0) {
      peValues.push(item.pe);
    } else {
      // 周期波动形态 + 均值回归（确定性，无随机数）
      const cycle = Math.sin((i / 12) * Math.PI * 1.5 + phase);
      const noise = Math.sin(i * 2.3 + phase) * 0.06 * base;
      const simulated = Math.max(
        item.peStats.min * 1.02,
        Math.min(item.peStats.max * 0.98, base + cycle * amp + noise),
      );
      peValues.push(Number(simulated.toFixed(2)));
    }
  }

  return {
    dates,
    peValues,
    currentPe: item.pe,
    p20: item.peStats.p20,
    p50: item.peStats.p50,
    p80: item.peStats.p80,
    min: item.peStats.min,
    max: item.peStats.max,
    isSimulated: true,
  };
}

export interface IndexPeHistory {
  dates: string[]; // YYYY-MM-DD
  peValues: number[];
  isSimulated: boolean;
}

/**
 * 从中证官网（经 /csindex/ 反代）拉取指数真实 PE 历史。
 * 数据源字段 peg 即每日收盘对应的市盈率。失败或样本过少返回 null（调用方回退示意序列）。
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
      const day = String(row.tradeDate ?? '');
      if (!Number.isFinite(peg) || peg <= 0 || day.length !== 8) continue;
      dates.push(`${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`);
      peValues.push(Number(peg.toFixed(2)));
    }
    if (dates.length < 10) return null;
    return { dates, peValues, isSimulated: false };
  } catch {
    return null;
  }
}
