<template>
  <div class="rebalance-calculator">
    <!-- 顶部策略预设与资金流模式选择器 -->
    <t-card class="strategy-selector-card">
      <div class="strategy-header-row">
        <div class="strategy-title-group">
          <h3 class="strategy-title">⚖️ 智能资产再平衡计算引擎</h3>
          <p class="strategy-subtitle">将估值分位与资产配置目标动态结合，精确测算调仓份数与现金流，严控无序偏离</p>
        </div>
        <div class="strategy-actions">
          <t-button theme="primary" :disabled="rebalanceResult.rebalanceCount === 0" @click="confirmBatchAddTodos">
            <template #icon><t-icon name="check-circle" /></template>
            一键批量写入调仓待办 ({{ selectedActionItems.length }} 笔)
          </t-button>
        </div>
      </div>

      <t-divider style="margin: 12px 0 16px" />

      <!-- 策略选择胶囊 -->
      <div class="config-grid">
        <div class="config-col">
          <span class="col-label">配置策略模板：</span>
          <t-radio-group v-model="selectedStrategyId" variant="default-filled" size="small" @change="onStrategyChange">
            <t-radio-button v-for="st in REBALANCE_PRESETS" :key="st.id" :value="st.id">
              {{ st.name }}
            </t-radio-button>
            <t-radio-button value="custom">自由定制模式</t-radio-button>
          </t-radio-group>
          <div class="strategy-desc-box">
            <span class="desc-tag">{{ currentStrategyInfo.tag }}</span>
            <span class="desc-text">{{ currentStrategyInfo.desc }}</span>
          </div>
        </div>

        <div class="config-col">
          <span class="col-label">再平衡资金流模式：</span>
          <div class="cash-mode-row">
            <t-radio-group v-model="cashFlowMode" variant="default-filled" size="small">
              <t-radio-button value="in_place">原值再平衡 (买卖对冲)</t-radio-button>
              <t-radio-button value="cash_injection">外部追加资金 (优先买入)</t-radio-button>
              <t-radio-button value="cash_withdraw">提取部分现金</t-radio-button>
            </t-radio-group>
            <div v-if="cashFlowMode !== 'in_place'" class="injection-input-wrap">
              <span class="input-prefix">{{ cashFlowMode === 'cash_injection' ? '追加金额' : '提取金额' }}: ¥</span>
              <t-input-number v-model="injectionAmount" :min="1000" :step="10000" size="small" style="width: 140px" />
            </div>
          </div>
        </div>

        <div class="config-col">
          <div class="col-inline-wrap">
            <span class="col-label">调仓容忍阈值：</span>
            <t-radio-group v-model="driftThreshold" variant="default-filled" size="small">
              <t-radio-button :value="0.01">±1%</t-radio-button>
              <t-radio-button :value="0.02">±2% (推荐)</t-radio-button>
              <t-radio-button :value="0.03">±3%</t-radio-button>
              <t-radio-button :value="0.05">±5%</t-radio-button>
            </t-radio-group>
            <t-button v-if="selectedStrategyId === 'custom'" size="small" variant="outline" @click="normalizeWeights">
              一键归一化至100%
            </t-button>
          </div>
        </div>
      </div>
    </t-card>

    <!-- 再平衡测算 KPI 摘要看板 -->
    <t-row :gutter="[14, 14]" style="margin-top: 14px">
      <t-col :xs="12" :sm="6" :md="3">
        <div class="rebalance-kpi-card">
          <span class="kpi-label">测算资产总值 (含现金)</span>
          <div class="kpi-val-row">
            <strong class="kpi-val num-mono">¥{{ Math.round(rebalanceResult.totalTargetCap).toLocaleString() }}</strong>
          </div>
          <span class="kpi-sub">现有可用现金: ¥{{ Math.round(rebalanceResult.currentCash).toLocaleString() }}</span>
        </div>
      </t-col>

      <t-col :xs="12" :sm="6" :md="3">
        <div class="rebalance-kpi-card">
          <span class="kpi-label">偏离预警与调仓笔数</span>
          <div class="kpi-val-row">
            <strong class="kpi-val num-mono highlight-orange">{{ rebalanceResult.rebalanceCount }} 只标的</strong>
          </div>
          <span class="kpi-sub">最大单项偏离度: {{ rebalanceResult.maxDriftPct.toFixed(1) }}%</span>
        </div>
      </t-col>

      <t-col :xs="12" :sm="6" :md="3">
        <div class="rebalance-kpi-card">
          <span class="kpi-label">预计买入 / 卖出体量</span>
          <div class="kpi-val-row">
            <span class="kpi-buy num-mono">买 ¥{{ Math.round(rebalanceResult.totalBuyAmount).toLocaleString() }}</span>
            <span class="kpi-sep">/</span>
            <span class="kpi-sell num-mono"
              >卖 ¥{{ Math.round(rebalanceResult.totalSellAmount).toLocaleString() }}</span
            >
          </div>
          <span class="kpi-sub"
            >净现金变动: {{ rebalanceResult.netCashDelta >= 0 ? '+' : '' }}¥{{
              Math.round(rebalanceResult.netCashDelta).toLocaleString()
            }}</span
          >
        </div>
      </t-col>

      <t-col :xs="12" :sm="6" :md="3">
        <div class="rebalance-kpi-card">
          <span class="kpi-label">再平衡后预计结存现金</span>
          <div class="kpi-val-row">
            <strong class="kpi-val num-mono highlight-green"
              >¥{{ Math.round(rebalanceResult.postCash).toLocaleString() }}</strong
            >
          </div>
          <span class="kpi-sub">预估交易摩擦佣金: ~¥{{ rebalanceResult.estimatedFee.toFixed(1) }}</span>
        </div>
      </t-col>
    </t-row>

    <!-- 核心测算清单与配比对比表格 -->
    <t-card class="rebalance-table-card" style="margin-top: 14px" title="资产对标偏差与拟执行调仓清单">
      <template #actions>
        <div class="table-legend-pills">
          <span class="pill-item is-buy">买入 (低配加仓)</span>
          <span class="pill-item is-sell">卖出 (超配止盈)</span>
          <span class="pill-item is-hold">保持 (合理区间)</span>
        </div>
      </template>

      <div class="table-wrap">
        <t-table
          :data="rebalanceResult.items"
          :columns="columns"
          row-key="code"
          size="medium"
          hover
          class="guanlan-rebalance-table"
        >
          <!-- 勾选列 -->
          <template #select="{ row }">
            <t-checkbox
              v-if="row.action !== 'hold'"
              :checked="selectedCodes.includes(row.code)"
              @change="(v) => toggleSelect(row.code, Boolean(v))"
            />
            <span v-else class="text-disabled">—</span>
          </template>

          <!-- 标的信息 -->
          <template #assetInfo="{ row }">
            <div class="asset-cell">
              <strong class="asset-name">{{ row.name }}</strong>
              <div class="asset-sub">
                <span class="asset-code code-mono">{{ row.code }}</span>
                <span class="asset-price num-mono">现价 ¥{{ row.price.toFixed(3) }}</span>
              </div>
            </div>
          </template>

          <!-- 当前实际占比 -->
          <template #currentWeight="{ row }">
            <div class="weight-cell">
              <strong class="weight-pct num-mono">{{ (row.currentWeight * 100).toFixed(1) }}%</strong>
              <small class="weight-mv num-mono">¥{{ Math.round(row.currentMV).toLocaleString() }}</small>
            </div>
          </template>

          <!-- 目标设定占比 -->
          <template #targetWeight="{ row }">
            <div class="target-weight-cell">
              <div v-if="selectedStrategyId === 'custom'" class="custom-weight-input">
                <t-input-number
                  :value="Math.round(row.targetWeight * 100)"
                  :min="0"
                  :max="100"
                  :step="1"
                  size="small"
                  style="width: 84px"
                  @change="(v) => onCustomWeightChange(row.code, Number(v))"
                />
                <span class="pct-sign">%</span>
              </div>
              <strong v-else class="weight-pct num-mono highlight-target"
                >{{ (row.targetWeight * 100).toFixed(1) }}%</strong
              >
              <small class="weight-mv num-mono">目标 ¥{{ Math.round(row.targetMV).toLocaleString() }}</small>
            </div>
          </template>

          <!-- 偏离度 -->
          <template #diffWeight="{ row }">
            <div class="diff-cell">
              <span
                class="diff-pill num-mono"
                :class="{
                  'is-under': row.diffWeight > driftThreshold,
                  'is-over': row.diffWeight < -driftThreshold,
                  'is-fit': Math.abs(row.diffWeight) <= driftThreshold,
                }"
              >
                {{ row.diffWeight > 0 ? '+' : '' }}{{ (row.diffWeight * 100).toFixed(1) }}%
              </span>
              <small class="diff-mv num-mono">
                {{ row.diffMV > 0 ? '缺' : '超' }} ¥{{ Math.abs(Math.round(row.diffMV)).toLocaleString() }}
              </small>
            </div>
          </template>

          <!-- 建议操作 -->
          <template #action="{ row }">
            <t-tag
              size="small"
              :theme="row.action === 'buy' ? 'danger' : row.action === 'sell' ? 'success' : 'default'"
              :variant="row.action === 'hold' ? 'outline' : 'light'"
            >
              {{ row.action === 'buy' ? '拟买入' : row.action === 'sell' ? '拟卖出' : '保持' }}
            </t-tag>
          </template>

          <!-- 拟调仓份额 -->
          <template #tradeDetails="{ row }">
            <div v-if="row.action !== 'hold'" class="trade-calc-cell">
              <strong class="trade-qty num-mono" :class="row.action === 'buy' ? 'text-buy' : 'text-sell'">
                {{ row.action === 'buy' ? '+' : '-' }}{{ row.tradeQty.toLocaleString() }} 份
              </strong>
              <small class="trade-amount num-mono"> 约 ¥{{ Math.round(row.tradeAmount).toLocaleString() }} </small>
            </div>
            <span v-else class="text-placeholder">无需变动</span>
          </template>

          <!-- 调仓后模拟占比 -->
          <template #postWeight="{ row }">
            <div class="post-cell">
              <span class="post-pct num-mono">{{ (row.postWeight * 100).toFixed(1) }}%</span>
              <t-progress
                :percentage="Number((row.postWeight * 100).toFixed(0))"
                :label="false"
                size="small"
                color="var(--td-brand-color, #0d706d)"
                style="width: 70px"
              />
            </div>
          </template>
        </t-table>
      </div>
    </t-card>
  </div>
</template>
<script setup lang="ts">
import type { PrimaryTableCol } from 'tdesign-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';
import { computed, reactive, ref, watch } from 'vue';

import { useInvestStore } from '@/store';
import type { CashFlowMode, RebalanceStrategyId } from '@/utils/rebalance';
import { calculateRebalance, generateRebalanceTodos, REBALANCE_PRESETS } from '@/utils/rebalance';

defineOptions({ name: 'RebalanceCalculator' });

const invest = useInvestStore();

const selectedStrategyId = ref<RebalanceStrategyId | 'custom'>('valuation_tilt');
const cashFlowMode = ref<CashFlowMode>('in_place');
const injectionAmount = ref(50000);
const driftThreshold = ref(0.02);

// 目标权重映射 (code -> 0~1)
const targetWeights = reactive<Record<string, number>>({
  sh511090: 0.25,
  sh560510: 0.25,
  sh510300: 0.15,
  sh588000: 0.15,
  sh512890: 0.1,
  sz159937: 0.1,
});

const selectedCodes = ref<string[]>([]);

const currentStrategyInfo = computed(() => {
  const found = REBALANCE_PRESETS.find((p) => p.id === selectedStrategyId.value);
  if (found) return found;
  return {
    id: 'custom',
    name: '自由定制模式',
    tag: '自定义微调',
    desc: '自由调整各资产目标百分比，可点击【一键归一化至100%】自动平抑权重。',
    weights: targetWeights,
  };
});

function onStrategyChange(val: any) {
  const preset = REBALANCE_PRESETS.find((p) => p.id === val);
  if (preset) {
    for (const key of Object.keys(targetWeights)) {
      delete targetWeights[key];
    }
    for (const [code, w] of Object.entries(preset.weights)) {
      targetWeights[code] = w;
    }
  }
}

function onCustomWeightChange(code: string, pctVal: number) {
  targetWeights[code] = Math.max(0, Math.min(100, pctVal)) / 100;
}

function normalizeWeights() {
  const sum = Object.values(targetWeights).reduce((a, b) => a + b, 0);
  if (sum <= 0) return;
  for (const code of Object.keys(targetWeights)) {
    targetWeights[code] = targetWeights[code] / sum;
  }
  MessagePlugin.success('已自动归一化各资产目标权重至 100%');
}

// 核心计算结果
const rebalanceResult = computed(() => {
  return calculateRebalance({
    holdings: invest.holdings.filter((h) => h.account === 'etf'),
    quotes: invest.quotes,
    currentCash: invest.cash.etf,
    targetWeights,
    cashFlowMode: cashFlowMode.value,
    cashInjectionAmount: injectionAmount.value,
    thresholdPct: driftThreshold.value,
    lotSize: 100,
  });
});

// 默认全选非 hold 的项
watch(
  () => rebalanceResult.value.items,
  (newItems) => {
    selectedCodes.value = newItems.filter((it) => it.action !== 'hold').map((it) => it.code);
  },
  { immediate: true },
);

function toggleSelect(code: string, checked: boolean) {
  if (checked) {
    if (!selectedCodes.value.includes(code)) selectedCodes.value.push(code);
  } else {
    selectedCodes.value = selectedCodes.value.filter((c) => c !== code);
  }
}

const selectedActionItems = computed(() => {
  return rebalanceResult.value.items.filter((it) => it.action !== 'hold' && selectedCodes.value.includes(it.code));
});

function confirmBatchAddTodos() {
  if (selectedActionItems.value.length === 0) {
    MessagePlugin.warning('未勾选任何需要调仓的标的');
    return;
  }

  const newTodos = generateRebalanceTodos(selectedActionItems.value, 'etf');
  let addedCount = 0;
  for (const t of newTodos) {
    invest.addTodo(t);
    addedCount++;
  }

  MessagePlugin.success(`已成功批量创建 ${addedCount} 笔调仓交易待办，可前往【待办清单】查看与标记执行！`);
}

const columns: PrimaryTableCol[] = [
  { colKey: 'select', title: '选', width: 48, align: 'center' },
  { colKey: 'assetInfo', title: '标的资产 / 现价', width: 170 },
  { colKey: 'currentWeight', title: '当前实际占比', width: 130 },
  { colKey: 'targetWeight', title: '目标设定配比', width: 140 },
  { colKey: 'diffWeight', title: '偏离度 (Δ%)', width: 120 },
  { colKey: 'action', title: '操作方向', width: 90, align: 'center' },
  { colKey: 'tradeDetails', title: '拟调仓份数 / 金额', width: 150 },
  { colKey: 'postWeight', title: '模拟后占比', width: 130 },
];
</script>
<style lang="less" scoped>
.rebalance-calculator {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.strategy-selector-card {
  .strategy-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;

    .strategy-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--td-text-color-primary);
      margin: 0;
    }

    .strategy-subtitle {
      font-size: 12px;
      color: var(--td-text-color-secondary);
      margin: 4px 0 0;
    }
  }

  .config-grid {
    display: flex;
    flex-direction: column;
    gap: 14px;

    .config-col {
      display: flex;
      flex-direction: column;
      gap: 8px;

      .col-label {
        font-size: 13px;
        font-weight: 600;
        color: var(--td-text-color-primary);
      }

      .strategy-desc-box {
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--td-bg-color-page);
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;

        .desc-tag {
          font-weight: 600;
          color: var(--td-brand-color, #0d706d);
        }

        .desc-text {
          color: var(--td-text-color-secondary);
        }
      }

      .cash-mode-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;

        .injection-input-wrap {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--td-text-color-secondary);
        }
      }

      .col-inline-wrap {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
    }
  }
}

.rebalance-kpi-card {
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;

  .kpi-label {
    font-size: 11px;
    color: var(--td-text-color-secondary);
  }

  .kpi-val-row {
    display: flex;
    align-items: baseline;
    gap: 6px;

    .kpi-val {
      font-size: 18px;
      font-weight: 700;
      color: var(--td-text-color-primary);

      &.highlight-orange {
        color: var(--guanlan-warning, #b8782d);
      }

      &.highlight-green {
        color: var(--guanlan-gain, #16815f);
      }
    }

    .kpi-buy {
      font-size: 14px;
      font-weight: 600;
      color: var(--guanlan-gain, #16815f);
    }

    .kpi-sell {
      font-size: 14px;
      font-weight: 600;
      color: var(--guanlan-loss, #b8433e);
    }

    .kpi-sep {
      color: var(--td-text-color-placeholder);
    }
  }

  .kpi-sub {
    font-size: 11px;
    color: var(--td-text-color-placeholder);
  }
}

.rebalance-table-card {
  .table-legend-pills {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;

    .pill-item {
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid transparent;

      &.is-buy {
        background: rgb(22 129 95 / 10%);
        color: var(--guanlan-gain, #16815f);
        border-color: rgb(22 129 95 / 25%);
      }

      &.is-sell {
        background: rgb(184 67 62 / 10%);
        color: var(--guanlan-loss, #b8433e);
        border-color: rgb(184 67 62 / 25%);
      }

      &.is-hold {
        background: var(--td-bg-color-page);
        color: var(--td-text-color-secondary);
        border-color: var(--td-border-level-1-color);
      }
    }
  }

  .asset-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;

    .asset-name {
      font-size: 13px;
      color: var(--td-text-color-primary);
    }

    .asset-sub {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: var(--td-text-color-secondary);
    }
  }

  .weight-cell,
  .target-weight-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;

    .weight-pct {
      font-size: 13px;
      color: var(--td-text-color-primary);

      &.highlight-target {
        color: var(--td-brand-color, #0d706d);
      }
    }

    .weight-mv {
      font-size: 11px;
      color: var(--td-text-color-placeholder);
    }

    .custom-weight-input {
      display: flex;
      align-items: center;
      gap: 4px;
    }
  }

  .diff-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;

    .diff-pill {
      font-size: 12px;
      font-weight: 600;
      width: fit-content;
      padding: 1px 6px;
      border-radius: 4px;

      &.is-under {
        color: var(--guanlan-gain, #16815f);
        background: rgb(22 129 95 / 10%);
      }

      &.is-over {
        color: var(--guanlan-loss, #b8433e);
        background: rgb(184 67 62 / 10%);
      }

      &.is-fit {
        color: var(--td-text-color-secondary);
        background: var(--td-bg-color-page);
      }
    }

    .diff-mv {
      font-size: 11px;
      color: var(--td-text-color-placeholder);
    }
  }

  .trade-calc-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;

    .trade-qty {
      font-size: 13px;

      &.text-buy {
        color: var(--guanlan-gain, #16815f);
      }

      &.text-sell {
        color: var(--guanlan-loss, #b8433e);
      }
    }

    .trade-amount {
      font-size: 11px;
      color: var(--td-text-color-placeholder);
    }
  }

  .post-cell {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .post-pct {
      font-size: 12px;
      font-weight: 600;
      color: var(--td-text-color-primary);
    }
  }
}
</style>
