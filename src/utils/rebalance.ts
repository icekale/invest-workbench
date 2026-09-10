import type { AccountId, Holding, TradeTodo } from '@/types/invest';
import type { Quote } from '@/utils/quote';

export type RebalanceStrategyId = 'valuation_tilt' | 'all_weather' | 'growth_core' | 'plan_base' | 'custom';
export type CashFlowMode = 'in_place' | 'cash_injection' | 'cash_withdraw';

export interface StrategyPreset {
  id: RebalanceStrategyId;
  name: string;
  tag: string;
  desc: string;
  weights: Record<string, number>; // code -> target weight (0~1)
}

export const REBALANCE_PRESETS: StrategyPreset[] = [
  {
    id: 'valuation_tilt',
    name: '估值动态倾斜',
    tag: '量化信号驱动',
    desc: '根据 A 股核心指数 10 年估值分位：极低估资产给予 +5%~+10% 重点超配，合理中枢维持基准，高估资产减配避险。',
    weights: {
      sh511090: 0.25, // 30年国债底仓保底
      sh560510: 0.25, // A500核心宽基
      sh510300: 0.15, // 沪深300
      sh588000: 0.15, // 科创50 (低估弹性)
      sh512890: 0.1, // 红利低波
      sz159937: 0.1, // 黄金防守
    },
  },
  {
    id: 'all_weather',
    name: '全天候稳健全景',
    tag: '防御平衡',
    desc: '达利欧全天候改良版：35% 长久期国债 + 40% 核心宽基 + 15% 稳健红利 + 10% 黄金避险，最大程度平抑市场波动。',
    weights: {
      sh511090: 0.35,
      sh560510: 0.25,
      sh510300: 0.15,
      sh512890: 0.15,
      sz159937: 0.1,
    },
  },
  {
    id: 'growth_core',
    name: '进取攻守兼备',
    tag: '景气进攻',
    desc: '以新质生产力为核心进攻矛头：A500 (30%) + 科创50 (25%) + 国债压舱石 (20%) + 红利 (15%) + 黄金 (10%)。',
    weights: {
      sh560510: 0.3,
      sh588000: 0.25,
      sh511090: 0.2,
      sh512890: 0.15,
      sz159937: 0.1,
    },
  },
  {
    id: 'plan_base',
    name: '现有账户目标基准',
    tag: '实盘既定纪律',
    desc: '直接继承当前系统既定的调仓目标配比（300宽基 35% / 国债 25% / 红利 18% / 成长 15%）。',
    weights: {
      sh510300: 0.35,
      sh511090: 0.25,
      sh512890: 0.18,
      sh588000: 0.15,
    },
  },
];

export interface RebalanceItem {
  code: string;
  name: string;
  price: number;
  currentQty: number;
  currentMV: number;
  currentWeight: number; // 0 ~ 1
  targetWeight: number; // 0 ~ 1
  targetMV: number;
  diffWeight: number; // targetWeight - currentWeight
  diffMV: number; // targetMV - currentMV
  action: 'buy' | 'sell' | 'hold';
  tradeQty: number; // integer multiple of 100
  tradeAmount: number; // tradeQty * price
  postMV: number;
  postWeight: number; // 0 ~ 1
}

export interface RebalanceResult {
  items: RebalanceItem[];
  totalCurrentCap: number; // 现有总资产（持仓+现金）
  totalTargetCap: number; // 再平衡后目标总资产
  totalCurrentMV: number;
  totalPostMV: number;
  currentCash: number;
  postCash: number;
  totalBuyAmount: number;
  totalSellAmount: number;
  netCashDelta: number; // 卖出总额 - 买入总额
  estimatedFee: number;
  maxDriftPct: number; // 最大偏离绝对值 %
  rebalanceCount: number; // 需要调仓的标的数
}

/**
 * 资产配置再平衡量化测算
 */
export function calculateRebalance(params: {
  holdings: Holding[];
  quotes: Record<string, Quote>;
  currentCash: number;
  targetWeights: Record<string, number>; // code -> weight 0~1
  cashFlowMode: CashFlowMode;
  cashInjectionAmount?: number; // 追加资金 (cash_injection) 或 提取资金 (cash_withdraw)
  thresholdPct?: number; // 调仓阈值，默认 0.02 (2%)
  lotSize?: number; // 交易手数单位，默认 100
}): RebalanceResult {
  const {
    holdings,
    quotes,
    currentCash,
    targetWeights,
    cashFlowMode,
    cashInjectionAmount = 0,
    thresholdPct = 0.02,
    lotSize = 100,
  } = params;

  // 1. 整理持仓标的与价格
  const assetMap = new Map<string, { code: string; name: string; price: number; qty: number; mv: number }>();

  // 填入既有持仓
  for (const h of holdings) {
    const q = quotes[h.code];
    const price = q?.price || h.cost || 1.0;
    const qty = h.quantity || 0;
    const mv = qty * price;
    assetMap.set(h.code, {
      code: h.code,
      name: h.name,
      price,
      qty,
      mv,
    });
  }

  // 补充在目标配置中有，但当前未持有的标的
  for (const code of Object.keys(targetWeights)) {
    if (!assetMap.has(code)) {
      const q = quotes[code];
      const price = q?.price || 1.0;
      assetMap.set(code, {
        code,
        name: q?.name || getStandardName(code),
        price,
        qty: 0,
        mv: 0,
      });
    }
  }

  // 2. 计算当前总市值与总资本
  let totalCurrentMV = 0;
  for (const a of assetMap.values()) {
    totalCurrentMV += a.mv;
  }
  const totalCurrentCap = totalCurrentMV + currentCash;

  // 根据资金流转模式计算目标资金体量
  let totalTargetCap = totalCurrentCap;
  if (cashFlowMode === 'cash_injection') {
    totalTargetCap = totalCurrentCap + Math.max(0, cashInjectionAmount);
  } else if (cashFlowMode === 'cash_withdraw') {
    totalTargetCap = Math.max(0, totalCurrentCap - Math.max(0, cashInjectionAmount));
  }

  // 3. 计算各个标的的实际目标市值与交易份额
  let totalBuyAmount = 0;
  let totalSellAmount = 0;
  const items: RebalanceItem[] = [];

  for (const a of assetMap.values()) {
    const targetW = targetWeights[a.code] || 0;
    const currentW = totalCurrentCap > 0 ? a.mv / totalCurrentCap : 0;
    const diffW = targetW - currentW;

    const targetMV = totalTargetCap * targetW;
    const diffMV = targetMV - a.mv;

    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let tradeQty = 0;
    let tradeAmount = 0;

    // 偏离度超过阈值才触发调仓
    if (Math.abs(diffW) >= thresholdPct) {
      if (diffMV > 0) {
        action = 'buy';
        // 买入份额向下取整到 lotSize (避免透支)
        tradeQty = Math.floor(diffMV / a.price / lotSize) * lotSize;
        tradeAmount = tradeQty * a.price;
        totalBuyAmount += tradeAmount;
      } else if (diffMV < 0) {
        action = 'sell';
        // 卖出份额取整，且不能超过已有持仓
        const rawQty = Math.floor(Math.abs(diffMV) / a.price / lotSize) * lotSize;
        tradeQty = Math.min(a.qty, rawQty);
        tradeAmount = tradeQty * a.price;
        totalSellAmount += tradeAmount;
      }
    }

    const postMV = action === 'buy' ? a.mv + tradeAmount : action === 'sell' ? a.mv - tradeAmount : a.mv;

    items.push({
      code: a.code,
      name: a.name,
      price: a.price,
      currentQty: a.qty,
      currentMV: a.mv,
      currentWeight: currentW,
      targetWeight: targetW,
      targetMV,
      diffWeight: diffW,
      diffMV,
      action,
      tradeQty,
      tradeAmount,
      postMV,
      postWeight: 0, // 稍后归一化
    });
  }

  // 4. 计算调仓后整体状态
  let totalPostMV = 0;
  for (const it of items) {
    totalPostMV += it.postMV;
  }

  const netCashDelta = totalSellAmount - totalBuyAmount;
  let postCash = currentCash + netCashDelta;
  if (cashFlowMode === 'cash_injection') {
    postCash += Math.max(0, cashInjectionAmount);
  } else if (cashFlowMode === 'cash_withdraw') {
    postCash -= Math.max(0, cashInjectionAmount);
  }

  const finalTotalCap = totalPostMV + Math.max(0, postCash);
  for (const it of items) {
    it.postWeight = finalTotalCap > 0 ? it.postMV / finalTotalCap : 0;
  }

  // 预估双边摩擦佣金：按万分之一乘总成交额的粗算。
  // 这里**不含**最低佣金（每笔 5 元，见 `src/utils/accounts.ts` 的 MIN_COMMISSION）：
  // 最低佣金是按笔收的，而这个数把全部调仓委托合成一个金额，摊不到单笔上。
  // 所以总成交额小的时候这个估值会偏低，它只是个量级参考，不是可入账的手续费。
  const estimatedFee = (totalBuyAmount + totalSellAmount) * 0.0001;

  // 计算最大偏离度与调仓项数
  let maxDriftPct = 0;
  let rebalanceCount = 0;
  for (const it of items) {
    const drift = Math.abs(it.diffWeight);
    if (drift > maxDriftPct) maxDriftPct = drift;
    if (it.action !== 'hold') rebalanceCount++;
  }

  // 排序：需要调仓的排前面，买入排前，卖出次之，保持排后
  items.sort((a, b) => {
    const actionScore = (act: string) => (act === 'buy' ? 3 : act === 'sell' ? 2 : 1);
    const sA = actionScore(a.action);
    const sB = actionScore(b.action);
    if (sA !== sB) return sB - sA;
    return Math.abs(b.diffWeight) - Math.abs(a.diffWeight);
  });

  return {
    items,
    totalCurrentCap,
    totalTargetCap,
    totalCurrentMV,
    totalPostMV,
    currentCash,
    postCash,
    totalBuyAmount,
    totalSellAmount,
    netCashDelta,
    estimatedFee,
    maxDriftPct: maxDriftPct * 100,
    rebalanceCount,
  };
}

/**
 * 将再平衡计算结果批量转换为可执行的交易待办事项 (TradeTodo)
 */
export function generateRebalanceTodos(
  items: RebalanceItem[],
  account: AccountId = 'etf',
): Omit<TradeTodo, 'id' | 'createdAt'>[] {
  const result: Omit<TradeTodo, 'id' | 'createdAt'>[] = [];

  for (const it of items) {
    if (it.action === 'hold' || it.tradeQty <= 0) continue;

    const actionText = it.action === 'buy' ? '补足配置' : '止盈降配';
    const driftText =
      it.diffWeight > 0
        ? `低于目标 ${(it.diffWeight * 100).toFixed(1)}%`
        : `超配 ${(Math.abs(it.diffWeight) * 100).toFixed(1)}%`;
    const reason = `【智能再平衡】${driftText}，拟以市价约 ¥${it.price.toFixed(3)} ${actionText} ${it.tradeQty.toLocaleString()} 份 (${(it.targetWeight * 100).toFixed(0)}% 目标权重)`;

    result.push({
      account,
      code: it.code,
      name: it.name,
      side: it.action === 'buy' ? 'buy' : 'sell',
      quantity: it.tradeQty,
      reason,
      status: 'open',
    });
  }

  return result;
}

function getStandardName(code: string): string {
  const map: Record<string, string> = {
    sh510300: '沪深300ETF',
    sh560510: 'A500ETF',
    sh511090: '30年国债ETF',
    sh512890: '红利低波ETF',
    sh588000: '科创50ETF',
    sz159937: '黄金ETF',
    sh510500: '500ETF',
    sz159915: '创业板ETF',
  };
  return map[code] || code;
}
