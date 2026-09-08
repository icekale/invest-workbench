import type {
  AccountId,
  ActionPoint,
  AlertLevel,
  AlertType,
  Holding,
  LedgerSummary,
  PlanTarget,
  Prefs,
  Thesis,
  TradeAlert,
  Transaction,
} from '@/types/invest';
import type { Quote } from '@/utils/quote';

/**
 * 导入文本/CSV解析器：
 * 支持表头或无表头，常见列：日期,账户(股票/ETF),代码,名称,买卖,成交价,成交量,手续费(可选),备注(可选)
 */
export function parseTransactionsCsv(text: string): {
  success: boolean;
  rows: Transaction[];
  errors: string[];
} {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const rows: Transaction[] = [];
  const errors: string[] = [];

  if (!lines.length) {
    return { success: false, rows: [], errors: ['内容为空，请输入或粘贴交易记录'] };
  }

  // 检查第一行是否为表头
  const firstLine = lines[0].toLowerCase();
  const hasHeader =
    firstLine.includes('日期') ||
    firstLine.includes('date') ||
    firstLine.includes('代码') ||
    firstLine.includes('code');

  const dataLines = hasHeader ? lines.slice(1) : lines;

  dataLines.forEach((line, idx) => {
    // 支持逗号、制表符或多空格分隔
    const parts = line.split(/[,\t]+/).map((p) => p.trim());
    if (parts.length < 5) {
      errors.push(`第 ${idx + (hasHeader ? 2 : 1)} 行数据列不足：${line}`);
      return;
    }

    // 容错解析
    const [rawDate, rawAccount, rawCode, rawName, rawSide, rawPrice, rawQty, rawFee, rawNote] = parts;

    // 日期标准化
    let date = rawDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const d = new Date(rawDate);
      if (!Number.isNaN(d.getTime())) {
        date = d.toISOString().slice(0, 10);
      } else {
        date = new Date().toISOString().slice(0, 10);
      }
    }

    // 账户判断
    const account: AccountId =
      rawAccount === 'etf' || rawAccount === 'ETF' || rawAccount.includes('基') ? 'etf' : 'stock';

    // 代码规范化
    let code = rawCode.toLowerCase();
    if (!code.startsWith('sh') && !code.startsWith('sz') && !code.startsWith('bj')) {
      if (code.startsWith('6') || code.startsWith('5')) code = `sh${code}`;
      else if (code.startsWith('0') || code.startsWith('3') || code.startsWith('1')) code = `sz${code}`;
      else if (code.startsWith('8') || code.startsWith('4')) code = `bj${code}`;
    }

    const name = rawName || code;
    const side = rawSide === '卖出' || rawSide === 'sell' || rawSide === 'S' ? 'sell' : 'buy';
    const price = Number.parseFloat(rawPrice);
    const quantity = Number.parseFloat(rawQty);
    const fee = rawFee ? Number.parseFloat(rawFee) : 0;

    if (Number.isNaN(price) || price <= 0 || Number.isNaN(quantity) || quantity <= 0) {
      errors.push(`第 ${idx + (hasHeader ? 2 : 1)} 行价格或数量无效：${line}`);
      return;
    }

    const amount = Number((price * quantity).toFixed(2));

    rows.push({
      id: `tx_${Date.now()}_${idx}`,
      date,
      account,
      code,
      name,
      side,
      price,
      quantity,
      amount,
      fee: Number.isNaN(fee) ? 0 : fee,
      note: rawNote || '',
    });
  });

  return {
    success: rows.length > 0,
    rows,
    errors,
  };
}

/**
 * 从交易流水重放计算持仓状况（加权平均成本）
 */
export function recalculateHoldingsFromTransactions(
  transactions: Transaction[],
  existingTheses: Thesis[] = [],
): Holding[] {
  // 按时间升序排序
  const sorted = [...transactions].sort((a, b) => (a.date > b.date ? 1 : -1));

  // 记录每个 (account, code) 的仓位
  const map: Record<
    string,
    {
      account: AccountId;
      code: string;
      name: string;
      quantity: number;
      totalCostAmount: number;
    }
  > = {};

  for (const tx of sorted) {
    const key = `${tx.account}_${tx.code}`;
    if (!map[key]) {
      map[key] = {
        account: tx.account,
        code: tx.code,
        name: tx.name,
        quantity: 0,
        totalCostAmount: 0,
      };
    }
    const item = map[key];
    item.name = tx.name || item.name;

    if (tx.side === 'buy') {
      const buyCost = tx.amount + (tx.fee || 0);
      item.totalCostAmount += buyCost;
      item.quantity += tx.quantity;
    } else {
      // 卖出：按当前加权平均成本扣除
      if (item.quantity > 0) {
        const avgCost = item.totalCostAmount / item.quantity;
        item.quantity = Math.max(0, item.quantity - tx.quantity);
        item.totalCostAmount = item.quantity * avgCost;
      }
    }
  }

  // 转换为 Holding 数组（过滤掉已清仓或持仓量 <= 0 的）
  const results: Holding[] = [];
  Object.values(map).forEach((item) => {
    if (item.quantity > 0) {
      const avgCost = Number((item.totalCostAmount / item.quantity).toFixed(3));
      const th = existingTheses.find((t) => t.code === item.code);
      results.push({
        account: item.account,
        code: item.code,
        name: item.name,
        quantity: item.quantity,
        cost: avgCost,
        health: 'healthy',
        action: 'hold',
        thesisId: th?.id || '',
      });
    }
  });

  return results;
}

/**
 * 汇总台账数据：买入总额、卖出总额、已实现盈亏、换手率
 */
export function calculateLedger(transactions: Transaction[], currentPortfolioValue = 0): LedgerSummary {
  let totalBuyAmount = 0;
  let totalSellAmount = 0;
  let totalFee = 0;
  let realizedPnL = 0;

  // 模拟计算每笔卖出的盈亏
  const positionTracker: Record<string, { qty: number; totalCost: number }> = {};

  const sorted = [...transactions].sort((a, b) => (a.date > b.date ? 1 : -1));

  for (const tx of sorted) {
    const key = `${tx.account}_${tx.code}`;
    if (!positionTracker[key]) {
      positionTracker[key] = { qty: 0, totalCost: 0 };
    }
    const pos = positionTracker[key];
    const fee = tx.fee || 0;
    totalFee += fee;

    if (tx.side === 'buy') {
      totalBuyAmount += tx.amount;
      pos.qty += tx.quantity;
      pos.totalCost += tx.amount + fee;
    } else {
      totalSellAmount += tx.amount;
      if (pos.qty > 0) {
        const avgCost = pos.totalCost / pos.qty;
        const sellQty = Math.min(pos.qty, tx.quantity);
        const costBasis = avgCost * sellQty;
        // 已实现盈亏 = 卖出净金额 - 成本
        realizedPnL += tx.amount - fee - costBasis;
        pos.qty = Math.max(0, pos.qty - sellQty);
        pos.totalCost = pos.qty * avgCost;
      }
    }
  }

  // 换手率 = (买入总额 + 卖出总额) / (2 * 平均组合市值)
  let turnoverRate = 0;
  if (currentPortfolioValue > 0) {
    turnoverRate = Number(((totalBuyAmount + totalSellAmount) / (2 * currentPortfolioValue)).toFixed(4));
  }

  return {
    totalBuyAmount: Number(totalBuyAmount.toFixed(2)),
    totalSellAmount: Number(totalSellAmount.toFixed(2)),
    realizedPnL: Number(realizedPnL.toFixed(2)),
    totalFee: Number(totalFee.toFixed(2)),
    turnoverRate,
    tradeCount: transactions.length,
  };
}

/**
 * 扫描生成买卖点提醒动作信号
 */
export function scanTradeAlerts(
  holdings: Holding[],
  quotes: Record<string, Quote>,
  theses: Thesis[],
  targets: PlanTarget[] = [],
  prefs?: Prefs,
): TradeAlert[] {
  const alerts: TradeAlert[] = [];
  const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');

  const stopLossPct = prefs?.stopLossPct ?? -0.08; // 默认 -8%
  const takeProfitPct = prefs?.takeProfitPct ?? 0.25; // 默认 +25%
  const rebalanceThreshold = prefs?.rebalanceThresholdPct ?? 0.03; // 默认 3%

  // 计算组合总市值
  const totalMv = holdings.reduce((sum, h) => {
    const q = quotes[h.code];
    const price = q?.price ?? h.cost;
    return sum + price * h.quantity;
  }, 0);

  // 1. 扫描各持仓的盈亏比例与论文状态
  for (const h of holdings) {
    const q = quotes[h.code];
    const currentPrice = q?.price ?? h.cost;
    const pnlPct = h.cost > 0 ? (currentPrice - h.cost) / h.cost : 0;
    const thesis = theses.find((t) => t.id === h.thesisId || t.code === h.code);

    // 止损预警
    if (pnlPct <= stopLossPct) {
      alerts.push({
        id: `alert_sl_${h.account}_${h.code}`,
        code: h.code,
        name: h.name,
        account: h.account,
        type: 'stop_loss',
        level: 'danger',
        title: `${h.name} 触及止损线`,
        detail: `现价 ¥${currentPrice.toFixed(2)}，较成本价 ¥${h.cost.toFixed(2)} 下跌 ${(pnlPct * 100).toFixed(1)}%（阈值 ${(stopLossPct * 100).toFixed(0)}%）。建议严格执行风控减仓或止损。`,
        suggestedAction: 'reduce',
        suggestedQty: Math.ceil(h.quantity * 0.5),
        triggerTime: nowStr,
      });
    }

    // 止盈提示
    if (pnlPct >= takeProfitPct) {
      alerts.push({
        id: `alert_tp_${h.account}_${h.code}`,
        code: h.code,
        name: h.name,
        account: h.account,
        type: 'take_profit',
        level: 'warning',
        title: `${h.name} 达到目标止盈收益`,
        detail: `现价 ¥${currentPrice.toFixed(2)}，累计浮盈 +${(pnlPct * 100).toFixed(1)}%（阈值 +${(takeProfitPct * 100).toFixed(0)}%）。可考虑锁定部分利润或上移止损点。`,
        suggestedAction: 'reduce',
        suggestedQty: Math.ceil(h.quantity * 0.3),
        triggerTime: nowStr,
      });
    }

    // 论文风险预警
    if (!thesis) {
      alerts.push({
        id: `alert_nth_${h.account}_${h.code}`,
        code: h.code,
        name: h.name,
        account: h.account,
        type: 'thesis_risk',
        level: 'info',
        title: `${h.name} 缺失投资论文`,
        detail: '持仓标的尚未关联投资论点，缺乏明确的买入逻辑与退出边界，建议尽快补全论文。',
        suggestedAction: 'hold',
        triggerTime: nowStr,
      });
    } else if (thesis.status === 'invalid') {
      alerts.push({
        id: `alert_inv_${h.account}_${h.code}`,
        code: h.code,
        name: h.name,
        account: h.account,
        type: 'thesis_risk',
        level: 'danger',
        title: `${h.name} 核心投资逻辑已作废`,
        detail: `关联论文「${thesis.title}」状态已变为【已作废】。依据投资纪律，核心前提破损应果断清仓离场。`,
        suggestedAction: 'exit',
        suggestedQty: h.quantity,
        triggerTime: nowStr,
      });
    } else if (thesis.status === 'watch') {
      alerts.push({
        id: `alert_wch_${h.account}_${h.code}`,
        code: h.code,
        name: h.name,
        account: h.account,
        type: 'thesis_risk',
        level: 'warning',
        title: `${h.name} 投资逻辑待更新`,
        detail: `关联论文「${thesis.title}」标记为【待更新】，可能面临基本面或行业变动，暂勿盲目加仓。`,
        suggestedAction: 'hold',
        triggerTime: nowStr,
      });
    }

    // 仓位再平衡扫描
    if (totalMv > 0 && targets.length > 0) {
      const target = targets.find((t) => t.code === h.code && t.account === h.account);
      if (target) {
        const currentMv = currentPrice * h.quantity;
        const currentWeight = currentMv / totalMv;
        const diff = currentWeight - target.targetWeight;
        if (Math.abs(diff) >= rebalanceThreshold) {
          const isOver = diff > 0;
          const type: AlertType = 'rebalance';
          const level: AlertLevel = isOver ? 'warning' : 'info';
          const action: ActionPoint = isOver ? 'reduce' : 'add';
          const adjAmount = Math.abs(diff) * totalMv;
          const adjQty = Math.round(adjAmount / currentPrice);

          alerts.push({
            id: `alert_reb_${h.account}_${h.code}`,
            code: h.code,
            name: h.name,
            account: h.account,
            type,
            level,
            title: `${h.name} 仓位偏离目标 ${(Math.abs(diff) * 100).toFixed(1)}%`,
            detail: `当前仓位占比 ${(currentWeight * 100).toFixed(1)}%，目标配比 ${(target.targetWeight * 100).toFixed(1)}%。建议${isOver ? '调降' : '加仓'}约 ¥${Math.round(adjAmount).toLocaleString('zh-CN')} (${adjQty}股/份) 进行再平衡。`,
            suggestedAction: action,
            suggestedQty: adjQty,
            triggerTime: nowStr,
          });
        }
      }
    }
  }

  return alerts;
}
