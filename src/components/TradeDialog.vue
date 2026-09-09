<template>
  <t-dialog
    v-model:visible="invest.tradeModal.visible"
    :header="false"
    :footer="false"
    width="min(540px, 94vw)"
    class="trade-dialog"
    destroy-on-close
    @close="invest.closeTradeModal"
  >
    <div class="trade-modal-container">
      <!-- 头部：买卖大方向切换 -->
      <div class="trade-header">
        <div class="header-title">
          <span class="main-title">模拟交易</span>
          <span class="sub-title">实时行情 · 原子联动持仓与现金</span>
        </div>
        <div class="side-switch">
          <button
            type="button"
            class="switch-btn buy-btn"
            :class="{ active: form.side === 'buy' }"
            @click="switchSide('buy')"
          >
            买入
          </button>
          <button
            type="button"
            class="switch-btn sell-btn"
            :class="{ active: form.side === 'sell' }"
            @click="switchSide('sell')"
          >
            卖出
          </button>
        </div>
      </div>

      <t-form label-align="top" class="trade-form">
        <!-- 账户与可用资金 -->
        <t-row :gutter="12">
          <t-col :span="6">
            <t-form-item label="归属账户">
              <t-radio-group v-model="form.account" variant="default-filled" @change="onAccountChange">
                <t-radio-button value="stock">股票账户</t-radio-button>
                <t-radio-button value="etf">ETF 账户</t-radio-button>
              </t-radio-group>
            </t-form-item>
          </t-col>
          <t-col :span="6">
            <t-form-item label="当前可用现金">
              <div class="cash-display num-hero">
                ¥{{ availableCash.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
              </div>
            </t-form-item>
          </t-col>
        </t-row>

        <!-- 标的代码与行情联想 -->
        <t-form-item label="标的代码 / 名称">
          <div class="symbol-input-row">
            <t-input
              v-model="form.code"
              placeholder="输入代码如 510300 / 600519 / 腾讯"
              clearable
              style="flex: 1"
              @blur="fetchQuoteForCode"
            />
            <!-- 从现有持仓快速选择 -->
            <t-select
              placeholder="从持仓选取"
              style="width: 140px"
              :options="currentAccountHoldingOptions"
              clearable
              @change="onSelectHolding"
            />
          </div>

          <!-- 行情与持仓提示卡片 -->
          <div v-if="quoteLoading" class="quote-info-bar loading">
            <t-loading size="small" text="正在查询腾讯最新实时行情..." />
          </div>
          <div v-else-if="quoteData.name" class="quote-info-bar">
            <div class="quote-left">
              <span class="q-name">{{ quoteData.name }}</span>
              <span class="q-code">{{ form.code }}</span>
              <span class="q-price" :style="{ color: pnlColor(quoteData.changePct) }">
                ¥{{ quoteData.price.toFixed(quoteData.price < 10 ? 3 : 2) }}
              </span>
              <span class="q-chg" :style="{ color: pnlColor(quoteData.changePct) }">
                {{ quoteData.changePct >= 0 ? '+' : '' }}{{ quoteData.changePct.toFixed(2) }}%
              </span>
            </div>
            <div class="quote-right">
              <t-link theme="primary" hover="color" @click="fillLivePrice">填入现价</t-link>
            </div>
          </div>

          <!-- 当前标的持仓底线提示 -->
          <div v-if="existingHolding" class="holding-tip-bar">
            <span>当前已持有：</span>
            <strong>{{ existingHolding.quantity.toLocaleString('zh-CN') }} 股/份</strong>
            <span class="tip-sub">（成本 ¥{{ existingHolding.cost.toFixed(3) }}）</span>
          </div>
          <div v-else-if="form.side === 'sell' && form.code" class="holding-tip-bar warning">
            ⚠️ 当前账户未持有该标的，无法执行卖出
          </div>
        </t-form-item>

        <!-- 委托价格 -->
        <t-row :gutter="12">
          <t-col :span="6">
            <t-form-item label="委托单价 (元)">
              <t-input-number v-model="form.price" :min="0.001" :step="0.01" :decimal-places="3" style="width: 100%" />
            </t-form-item>
          </t-col>
          <t-col :span="6">
            <t-form-item label="委托数量 (股/份)">
              <t-input-number v-model="form.quantity" :min="1" :step="100" :decimal-places="0" style="width: 100%" />
            </t-form-item>
          </t-col>
        </t-row>

        <!-- 快捷仓位换算按钮组 -->
        <div class="pos-ratio-bar">
          <div class="ratio-label">
            <span v-if="form.side === 'buy'">
              快捷买入：最多可买 <strong>{{ maxBuyQuantity.toLocaleString('zh-CN') }}</strong> 股/份
            </span>
            <span v-else>
              快捷卖出：可卖数量 <strong>{{ maxSellQuantity.toLocaleString('zh-CN') }}</strong> 股/份
            </span>
          </div>
          <div class="ratio-buttons">
            <t-button
              v-for="btn in ratioButtons"
              :key="btn.label"
              size="small"
              variant="outline"
              theme="default"
              @click="applyRatio(btn.ratio)"
            >
              {{ btn.label }}
            </t-button>
          </div>
        </div>

        <!-- 交易试算预览面板 -->
        <div class="trade-preview-panel">
          <div class="preview-row">
            <span class="preview-label">预计成交金额</span>
            <span class="preview-val amount num-hero">
              ¥{{ tradeAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
            </span>
          </div>
          <div class="preview-grid">
            <div class="grid-item">
              <span class="g-lbl">成交后剩余现金</span>
              <span class="g-val" :class="{ danger: estimatedRemainingCash < 0 }">
                ¥{{
                  estimatedRemainingCash.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                }}
              </span>
            </div>
            <div class="grid-item">
              <span class="g-lbl">成交后持仓变动</span>
              <span class="g-val">
                {{ estimatedPostHoldingQty.toLocaleString('zh-CN') }} 股/份
                <small v-if="form.side === 'buy' && form.quantity > 0 && estimatedNewCost">
                  (均价 ¥{{ estimatedNewCost.toFixed(3) }})
                </small>
              </span>
            </div>
          </div>
        </div>

        <!-- 交易备注与待办关联 -->
        <div v-if="form.todoId" class="todo-bound-tip">💡 本次交易关联决策待办，成交后将自动标记为已执行并归档</div>
      </t-form>

      <!-- 底部执行按钮 -->
      <div class="trade-dialog-footer">
        <t-button variant="text" theme="default" @click="invest.closeTradeModal">取消</t-button>
        <t-button
          :theme="form.side === 'buy' ? 'danger' : 'success'"
          size="large"
          :loading="submitting"
          :disabled="!isTradeValid"
          class="submit-trade-btn"
          @click="submitTrade"
        >
          {{ form.side === 'buy' ? '确认买入' : '确认卖出' }}
          (¥{{ tradeAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }})
        </t-button>
      </div>
    </div>
  </t-dialog>
</template>
<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next';
import { computed, reactive, ref, watch } from 'vue';

import { useInvestStore } from '@/store';
import type { AccountId, TradeSide } from '@/types/invest';
import { tradeFee } from '@/utils/ledger';
import { fetchQuotes, normalizeCode } from '@/utils/quote';

defineOptions({ name: 'TradeDialog' });

const invest = useInvestStore();

const submitting = ref(false);
const quoteLoading = ref(false);

const form = reactive({
  account: 'stock' as AccountId,
  side: 'buy' as TradeSide,
  code: '',
  name: '',
  price: 0,
  quantity: 100,
  todoId: '',
  note: '',
});

const quoteData = reactive({
  name: '',
  price: 0,
  changePct: 0,
});

// 监听弹窗打开时，注入初始参数
watch(
  () => invest.tradeModal.visible,
  (visible) => {
    if (visible) {
      const opts = invest.tradeModal.options;
      form.account = opts.account || 'stock';
      form.side = opts.side || 'buy';
      form.code = opts.code || '';
      form.name = opts.name || '';
      form.price = opts.price || 0;
      form.quantity = opts.quantity || 100;
      form.todoId = opts.todoId || '';
      form.note = opts.note || '';

      if (form.code) {
        fetchQuoteForCode();
      } else {
        quoteData.name = '';
        quoteData.price = 0;
        quoteData.changePct = 0;
      }
    }
  },
);

function switchSide(side: TradeSide) {
  form.side = side;
  // 若切换为卖出且当前持有该标的，自动调整数量为可卖范围
  if (side === 'sell' && existingHolding.value) {
    if (form.quantity > existingHolding.value.quantity) {
      form.quantity = existingHolding.value.quantity;
    }
  }
}

function onAccountChange() {
  // 账户切换后重新检查现有持仓
  if (form.side === 'sell' && existingHolding.value) {
    form.quantity = Math.min(form.quantity, existingHolding.value.quantity);
  }
}

const availableCash = computed(() => invest.cash[form.account] || 0);

// 当前账户持仓选项
const currentAccountHoldingOptions = computed(() =>
  invest.holdings
    .filter((h) => h.account === form.account)
    .map((h) => ({
      label: `${h.name} (${h.code.replace(/^(sh|sz|bj)/, '')}) · 持 ${h.quantity} 股`,
      value: h.code,
    })),
);

// 查找当前账户中是否持有选中的标的
const existingHolding = computed(() => {
  if (!form.code) return null;
  const target = normalizeCode(form.code);
  return (
    invest.holdings.find(
      (h) => h.account === form.account && (h.code === target || normalizeCode(h.code) === target),
    ) || null
  );
});

function onSelectHolding(val: unknown) {
  if (!val || typeof val !== 'string') return;
  form.code = val;
  const h = existingHolding.value;
  if (h) {
    form.name = h.name;
    if (form.side === 'sell') {
      form.quantity = h.quantity;
    }
  }
  fetchQuoteForCode();
}

let searchTimer: number | null = null;
watch(
  () => form.code,
  (val) => {
    if (searchTimer) clearTimeout(searchTimer);
    const raw = (val || '').trim();
    if (raw.length >= 5) {
      searchTimer = window.setTimeout(fetchQuoteForCode, 350);
    }
  },
);

async function fetchQuoteForCode() {
  const norm = normalizeCode(form.code);
  if (!norm || norm.length < 6) return;
  quoteLoading.value = true;
  try {
    const qMap = await fetchQuotes([norm]);
    const q = qMap.get(norm.toLowerCase());
    if (q) {
      quoteData.name = q.name;
      quoteData.price = q.price;
      quoteData.changePct = q.changePct;
      if (!form.name || form.name === form.code) {
        form.name = q.name;
      }
      if (!form.price || form.price <= 0) {
        form.price = q.price;
      }
    }
  } catch (err) {
    console.warn('获取实时行情异常:', err);
  } finally {
    quoteLoading.value = false;
  }
}

function fillLivePrice() {
  if (quoteData.price > 0) {
    form.price = quoteData.price;
    MessagePlugin.info(`已填入最新现价 ¥${quoteData.price.toFixed(quoteData.price < 10 ? 3 : 2)}`);
  }
}

// 交易金额
const tradeAmount = computed(() => Number((form.price * form.quantity).toFixed(2)));
const estimatedFee = computed(() => tradeFee(form.account, tradeAmount.value));
const feeRate = computed(() => (form.account === 'etf' ? 0.00005 : 0.00008));

// 最大可买股数 (按整百股向下取整，预留佣金)
const maxBuyQuantity = computed(() => {
  if (form.price <= 0 || availableCash.value <= 0) return 0;
  const raw = Math.floor(availableCash.value / (form.price * (1 + feeRate.value)));
  return Math.floor(raw / 100) * 100;
});

// 最大可卖股数
const maxSellQuantity = computed(() => existingHolding.value?.quantity || 0);

// 快捷比例按钮
const ratioButtons = computed(() => {
  if (form.side === 'buy') {
    return [
      { label: '1/4 仓', ratio: 0.25 },
      { label: '1/3 仓', ratio: 0.3333 },
      { label: '半仓', ratio: 0.5 },
      { label: '满仓', ratio: 1.0 },
    ];
  }
  return [
    { label: '1/4', ratio: 0.25 },
    { label: '1/3', ratio: 0.3333 },
    { label: '半仓', ratio: 0.5 },
    { label: '全部清仓', ratio: 1.0 },
  ];
});

function applyRatio(ratio: number) {
  if (form.side === 'buy') {
    if (form.price <= 0) {
      MessagePlugin.warning('请先指定委托单价');
      return;
    }
    const targetAmount = availableCash.value * ratio;
    const rawQty = Math.floor(targetAmount / (form.price * (1 + feeRate.value)));
    const roundQty = Math.floor(rawQty / 100) * 100;
    form.quantity = Math.max(100, roundQty);
  } else {
    if (!existingHolding.value) {
      MessagePlugin.warning('当前账户未持有该标的');
      return;
    }
    const total = existingHolding.value.quantity;
    if (ratio >= 0.99) {
      form.quantity = total;
    } else {
      const raw = Math.round(total * ratio);
      form.quantity = Math.min(total, Math.max(100, Math.floor(raw / 100) * 100 || raw));
    }
  }
}

// 预计剩余现金
const estimatedRemainingCash = computed(() => {
  if (form.side === 'buy') {
    return availableCash.value - tradeAmount.value - estimatedFee.value;
  }
  return availableCash.value + tradeAmount.value - estimatedFee.value;
});

// 预计变动后持仓股数
const estimatedPostHoldingQty = computed(() => {
  const current = existingHolding.value?.quantity || 0;
  if (form.side === 'buy') {
    return current + form.quantity;
  }
  return Math.max(0, current - form.quantity);
});

// 预计新加权持仓成本 (仅买入时)
const estimatedNewCost = computed(() => {
  if (form.side !== 'buy' || form.quantity <= 0) return null;
  const current = existingHolding.value;
  if (!current) return form.price;
  const totalQty = current.quantity + form.quantity;
  if (totalQty <= 0) return null;
  return (current.cost * current.quantity + tradeAmount.value + estimatedFee.value) / totalQty;
});

// 校验交易合法性
const isTradeValid = computed(() => {
  if (!form.code || form.price <= 0 || form.quantity <= 0) return false;
  if (form.side === 'buy') {
    return tradeAmount.value + estimatedFee.value <= availableCash.value;
  }
  return existingHolding.value !== null && form.quantity <= existingHolding.value.quantity;
});

function pnlColor(val: number) {
  if (val > 0) return '#b8433e';
  if (val < 0) return '#16815f';
  return 'var(--td-text-color-primary)';
}

async function submitTrade() {
  if (!isTradeValid.value) {
    if (form.side === 'buy' && tradeAmount.value + estimatedFee.value > availableCash.value) {
      MessagePlugin.error('可用现金不足，无法买入');
      return;
    }
    if (form.side === 'sell' && (!existingHolding.value || form.quantity > existingHolding.value.quantity)) {
      MessagePlugin.error('卖出数量超出当前可用持仓');
      return;
    }
    MessagePlugin.warning('请检查输入的代码、价格和数量');
    return;
  }

  submitting.value = true;
  try {
    const result = invest.executeTrade({
      account: form.account,
      side: form.side,
      code: form.code,
      name: form.name || quoteData.name || form.code,
      price: form.price,
      quantity: form.quantity,
      todoId: form.todoId || undefined,
      note: form.note || undefined,
    });
    MessagePlugin.success(result.message);
    invest.closeTradeModal();
  } catch (err) {
    MessagePlugin.error(err instanceof Error ? err.message : '交易执行失败');
  } finally {
    submitting.value = false;
  }
}
</script>
<style lang="less" scoped>
.trade-dialog {
  :deep(.t-dialog__body) {
    padding: 20px 24px;
  }
}

.trade-modal-container {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.trade-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--td-component-stroke, #e2e8f0);

  .header-title {
    display: flex;
    flex-direction: column;

    .main-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--td-text-color-primary);
      letter-spacing: -0.01em;
    }

    .sub-title {
      font-size: 12px;
      color: var(--td-text-color-placeholder);
      margin-top: 2px;
    }
  }

  .side-switch {
    display: flex;
    background: var(--td-bg-color-secondarycontainer, #f1f5f9);
    padding: 3px;
    border-radius: 6px;
    gap: 4px;

    .switch-btn {
      border: none;
      outline: none;
      cursor: pointer;
      padding: 6px 16px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 4px;
      background: transparent;
      color: var(--td-text-color-secondary);
      transition: all 0.15s ease;

      &.buy-btn.active {
        background: #b8433e;
        color: #fff;
        box-shadow: 0 2px 6px rgb(184 67 62 / 25%);
      }

      &.sell-btn.active {
        background: #16815f;
        color: #fff;
        box-shadow: 0 2px 6px rgb(22 129 95 / 25%);
      }
    }
  }
}

.trade-form {
  :deep(.t-form__item) {
    margin-bottom: 12px;
  }
}

.cash-display {
  font-size: 16px;
  font-weight: 700;
  color: var(--td-brand-color, #0d706d);
  line-height: 32px;
}

.symbol-input-row {
  display: flex;
  gap: 8px;
  width: 100%;
}

.quote-info-bar {
  margin-top: 6px;
  padding: 6px 10px;
  background: var(--td-bg-color-secondarycontainer, #f8fafc);
  border: 1px solid var(--td-component-stroke, #e2e8f0);
  border-radius: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;

  &.loading {
    color: var(--td-text-color-placeholder);
    padding: 8px 10px;
  }

  .quote-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;

    .q-name {
      font-weight: 600;
      color: var(--td-text-color-primary);
    }

    .q-code {
      font-family: var(--td-font-family-mono);
      color: var(--td-text-color-placeholder);
      font-size: 11px;
    }

    .q-price {
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }

    .q-chg {
      font-variant-numeric: tabular-nums;
    }
  }
}

.holding-tip-bar {
  margin-top: 4px;
  font-size: 11px;
  color: var(--td-text-color-secondary);

  strong {
    color: var(--td-text-color-primary);
    font-variant-numeric: tabular-nums;
  }

  .tip-sub {
    color: var(--td-text-color-placeholder);
    font-variant-numeric: tabular-nums;
  }

  &.warning {
    color: #b8433e;
  }
}

.pos-ratio-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  font-size: 12px;
  color: var(--td-text-color-secondary);
  flex-wrap: wrap;
  gap: 8px;

  .ratio-buttons {
    display: flex;
    gap: 6px;
  }
}

.trade-preview-panel {
  background: var(--td-bg-color-secondarycontainer, #f8fafc);
  border: 1px solid var(--td-component-stroke, #e2e8f0);
  border-radius: 6px;
  padding: 10px 14px;
  margin-bottom: 12px;

  .preview-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding-bottom: 8px;
    border-bottom: 1px dashed var(--td-component-stroke, #e2e8f0);

    .preview-label {
      font-size: 12px;
      color: var(--td-text-color-secondary);
    }

    .preview-val.amount {
      font-size: 18px;
      font-weight: 700;
      color: var(--td-brand-color, #0d706d);
    }
  }

  .preview-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 8px;

    .grid-item {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .g-lbl {
        font-size: 11px;
        color: var(--td-text-color-placeholder);
      }

      .g-val {
        font-size: 13px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        color: var(--td-text-color-primary);

        &.danger {
          color: #b8433e;
        }

        small {
          font-size: 11px;
          font-weight: 400;
          color: var(--td-text-color-placeholder);
        }
      }
    }
  }
}

.todo-bound-tip {
  font-size: 12px;
  color: var(--td-brand-color, #0d706d);
  background: var(--td-brand-color-light, rgb(13 112 109 / 8%));
  padding: 6px 10px;
  border-radius: 4px;
}

.trade-dialog-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  margin-top: 6px;

  .submit-trade-btn {
    min-width: 160px;
    font-weight: 600;
  }
}
</style>
