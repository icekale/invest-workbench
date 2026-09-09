import type { ScenarioLeg, ScenarioMetric } from '@/types/invest';

export interface ScenarioPoolRow {
  metric: ScenarioMetric;
  bear: ScenarioLeg;
  base: ScenarioLeg;
  bull: ScenarioLeg;
  note: string;
}

/** 股票池「三情景目标价」假设；参考值用现价/PE或PB现场反推。 */
export const SCENARIO_POOL: Record<string, ScenarioPoolRow> = {
  sh600519: {
    metric: 'eps',
    bear: { growth: -0.05, multiple: 12 },
    base: { growth: 0.03, multiple: 15 },
    bull: { growth: 0.08, multiple: 18 },
    note: '白酒总量、批价和库存决定盈利中枢；不能直接沿用历史高估值',
  },
  hk00700: {
    metric: 'eps',
    bear: { growth: 0.05, multiple: 14 },
    base: { growth: 0.12, multiple: 18 },
    bull: { growth: 0.18, multiple: 22 },
    note: '游戏、广告和回购支撑价值；AI投入与监管影响利润和估值',
  },
  sh600900: {
    metric: 'eps',
    bear: { growth: 0, multiple: 20 },
    base: { growth: 0.04, multiple: 23 },
    bull: { growth: 0.07, multiple: 26 },
    note: '利率、来水、电价和分红覆盖决定合理估值；增长空间有限',
  },
  sz300750: {
    metric: 'eps',
    bear: { growth: 0.05, multiple: 17 },
    base: { growth: 0.15, multiple: 22 },
    bull: { growth: 0.25, multiple: 27 },
    note: '份额、单位Wh盈利、价格战和海外政策是核心敏感变量',
  },
  sh600938: {
    metric: 'eps',
    bear: { growth: -0.2, multiple: 7 },
    base: { growth: -0.05, multiple: 9 },
    bull: { growth: 0.1, multiple: 11 },
    note: '应使用中周期油价与桶油成本，不能以峰值利润简单外推',
  },
  sz000333: {
    metric: 'eps',
    bear: { growth: 0, multiple: 10 },
    base: { growth: 0.08, multiple: 13 },
    bull: { growth: 0.15, multiple: 16 },
    note: '国内需求、海外利润率和并购回报决定增长与估值中枢',
  },
  sh600660: {
    metric: 'eps',
    bear: { growth: -0.1, multiple: 15 },
    base: { growth: 0.05, multiple: 19 },
    bull: { growth: 0.15, multiple: 23 },
    note: '验证全球份额、单车价值量和海外产能回报；当前PE口径需复核',
  },
  sh688981: {
    metric: 'bvps',
    bear: { growth: 0.03, multiple: 4.5 },
    base: { growth: 0.08, multiple: 6.5 },
    bull: { growth: 0.12, multiple: 8.5 },
    note: '资本回报、产能利用率、折旧和外部技术限制决定PB中枢',
  },
  hk02328: {
    metric: 'bvps',
    bear: { growth: 0.03, multiple: 0.75 },
    base: { growth: 0.07, multiple: 1 },
    bull: { growth: 0.1, multiple: 1.25 },
    note: '综合成本率、准备金质量、ROE和股息决定合理PB',
  },
  hk00388: {
    metric: 'eps',
    bear: { growth: -0.05, multiple: 20 },
    base: { growth: 0.08, multiple: 27 },
    bull: { growth: 0.18, multiple: 34 },
    note: '成交额、IPO与互联互通决定盈利弹性；高估值要求高活跃度',
  },
  hk01810: {
    metric: 'eps',
    bear: { growth: -0.1, multiple: 14 },
    base: { growth: 0.15, multiple: 20 },
    bull: { growth: 0.35, multiple: 28 },
    note: '汽车销量与单车盈利假设敏感，应以SOTP交叉验证',
  },
  sh600036: {
    metric: 'bvps',
    bear: { growth: -0.03, multiple: 0.65 },
    base: { growth: 0.04, multiple: 0.85 },
    bull: { growth: 0.08, multiple: 1.05 },
    note: '净息差、资产质量和地产风险是估值核心变量',
  },
  sh600030: {
    metric: 'bvps',
    bear: { growth: -0.05, multiple: 0.75 },
    base: { growth: 0.08, multiple: 1 },
    bull: { growth: 0.18, multiple: 1.25 },
    note: '市场成交额、投行周期、资本监管和自营波动',
  },
  sz000776: {
    metric: 'bvps',
    bear: { growth: -0.05, multiple: 0.7 },
    base: { growth: 0.07, multiple: 0.9 },
    bull: { growth: 0.16, multiple: 1.15 },
    note: '成交额、信用风险和投行业务恢复速度',
  },
  hk02423: {
    metric: 'eps',
    bear: { growth: -0.1, multiple: 14 },
    base: { growth: 0.08, multiple: 20 },
    bull: { growth: 0.2, multiple: 27 },
    note: '房地产成交、政策、佣金率和新房业务风险',
  },
  sz002371: {
    metric: 'eps',
    bear: { growth: -0.08, multiple: 30 },
    base: { growth: 0.12, multiple: 40 },
    bull: { growth: 0.24, multiple: 50 },
    note: '晶圆厂资本开支、供应链、技术迭代和估值',
  },
  hk03888: {
    metric: 'eps',
    bear: { growth: -0.1, multiple: 25 },
    base: { growth: 0.1, multiple: 35 },
    bull: { growth: 0.22, multiple: 45 },
    note: '订阅转化、游戏周期、AI投入和竞争',
  },
  hk00941: {
    metric: 'eps',
    bear: { growth: 0, multiple: 8 },
    base: { growth: 0.04, multiple: 10 },
    bull: { growth: 0.08, multiple: 12 },
    note: 'ARPU、云业务回报、资本开支和行业竞争',
  },
  sh601899: {
    metric: 'eps',
    bear: { growth: -0.15, multiple: 10 },
    base: { growth: 0.05, multiple: 14 },
    bull: { growth: 0.15, multiple: 18 },
    note: '金铜价格、海外项目、成本和地缘政策',
  },
  sh600019: {
    metric: 'eps',
    bear: { growth: -0.1, multiple: 7 },
    base: { growth: 0.03, multiple: 9 },
    bull: { growth: 0.1, multiple: 11 },
    note: '钢价、铁矿石成本、产能政策和碳成本',
  },
  sh600309: {
    metric: 'eps',
    bear: { growth: -0.15, multiple: 11 },
    base: { growth: 0.06, multiple: 15 },
    bull: { growth: 0.16, multiple: 19 },
    note: '产品价差、原料、海外产能和化工周期',
  },
  sh601766: {
    metric: 'eps',
    bear: { growth: -0.05, multiple: 9 },
    base: { growth: 0.05, multiple: 12 },
    bull: { growth: 0.12, multiple: 15 },
    note: '订单周期、应收账款、海外项目和资本回报',
  },
  sh600150: {
    metric: 'eps',
    bear: { growth: -0.12, multiple: 18 },
    base: { growth: 0.1, multiple: 25 },
    bull: { growth: 0.24, multiple: 32 },
    note: '船价周期、交付、钢材成本和军工订单',
  },
  sh600886: {
    metric: 'eps',
    bear: { growth: 0, multiple: 14 },
    base: { growth: 0.04, multiple: 17 },
    bull: { growth: 0.08, multiple: 20 },
    note: '来水、电价、利率、资本开支与分红',
  },
  sh601816: {
    metric: 'eps',
    bear: { growth: 0, multiple: 20 },
    base: { growth: 0.03, multiple: 25 },
    bull: { growth: 0.07, multiple: 30 },
    note: '客流、票价、折旧、利率和债务成本',
  },
};
