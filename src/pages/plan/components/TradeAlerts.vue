<template>
  <t-space direction="vertical" :size="16" style="width: 100%">
    <!-- 顶部状态栏 -->
    <t-row :gutter="[16, 16]">
      <t-col :xs="6" :sm="6" :xl="3">
        <t-card :bordered="false" class="alert-kpi-card">
          <div class="kpi-label">当前动作提醒</div>
          <div class="kpi-value num-hero">{{ alerts.length }}</div>
          <div class="kpi-tip">全组合实时扫描</div>
        </t-card>
      </t-col>
      <t-col :xs="6" :sm="6" :xl="3">
        <t-card :bordered="false" class="alert-kpi-card">
          <div class="kpi-label">触及止损 / 破损</div>
          <div class="kpi-value num-hero" :style="{ color: dangerCount ? 'var(--guanlan-gain)' : 'inherit' }">
            {{ dangerCount }}
          </div>
          <div class="kpi-tip">严格执行风控纪律</div>
        </t-card>
      </t-col>
      <t-col :xs="6" :sm="6" :xl="3">
        <t-card :bordered="false" class="alert-kpi-card">
          <div class="kpi-label">目标止盈 / 需复核</div>
          <div class="kpi-value num-hero" :style="{ color: warningCount ? 'var(--guanlan-warning)' : 'inherit' }">
            {{ warningCount }}
          </div>
          <div class="kpi-tip">锁定收益或检视逻辑</div>
        </t-card>
      </t-col>
      <t-col :xs="6" :sm="6" :xl="3">
        <t-card :bordered="false" class="alert-kpi-card">
          <div class="kpi-label">偏离再平衡</div>
          <div class="kpi-value num-hero">{{ rebalanceCount }}</div>
          <div class="kpi-tip">按目标配比平滑调仓</div>
        </t-card>
      </t-col>
    </t-row>

    <!-- 提醒看板卡片 -->
    <t-card title="持仓风控与触发提醒">
      <template #actions>
        <t-button size="small" variant="outline" theme="default" @click="configOpen = true">
          <template #icon><t-icon name="setting" /></template>
          设置风控阈值
        </t-button>
      </template>

      <!-- 筛选分类 -->
      <div class="alert-filter-bar">
        <t-radio-group v-model="filterType" variant="default-filled" size="small">
          <t-radio-button value="all">全部提醒 ({{ alerts.length }})</t-radio-button>
          <t-radio-button value="stop_loss">止损红线</t-radio-button>
          <t-radio-button value="take_profit">止盈离场</t-radio-button>
          <t-radio-button value="thesis_risk">逻辑预警</t-radio-button>
          <t-radio-button value="rebalance">再平衡</t-radio-button>
        </t-radio-group>
      </div>

      <!-- 无提醒状态 -->
      <t-empty
        v-if="!filteredAlerts.length"
        description="当前所有持仓均在纪律与估值合理区间内，无触发预警"
        style="padding: 32px 0"
      />

      <!-- 提醒列表 -->
      <div v-else class="alerts-grid">
        <div v-for="item in filteredAlerts" :key="item.id" class="alert-item-card" :class="`level-${item.level}`">
          <div class="alert-card-head">
            <div class="alert-head-left">
              <t-tag size="small" :theme="levelTheme(item.level)" variant="light">{{ typeLabel(item.type) }}</t-tag>
              <strong class="symbol-name">{{ item.name }}</strong>
              <span class="symbol-code">{{ shortCode(item.code) }}</span>
              <t-tag size="small" variant="outline">{{ item.account === 'stock' ? '股票' : 'ETF' }}</t-tag>
            </div>
            <div class="alert-head-right">
              <span class="alert-time">{{ item.triggerTime }}</span>
            </div>
          </div>

          <div class="alert-title">{{ item.title }}</div>
          <div class="alert-detail">{{ item.detail }}</div>

          <div class="alert-footer">
            <div class="alert-suggest">
              <span class="suggest-label">建议动作：</span>
              <t-tag size="medium" :theme="actionTheme(item.suggestedAction)" variant="dark">
                {{ actionLabel(item.suggestedAction) }}
                <template v-if="item.suggestedQty"> {{ item.suggestedQty }} 股/份</template>
              </t-tag>
            </div>
            <div class="alert-actions">
              <t-button v-if="isTodoAdded(item)" size="small" variant="text" theme="success" disabled>
                <template #icon><t-icon name="check" /></template>
                已在待办中
              </t-button>
              <t-button v-else size="small" theme="primary" @click="convertToTodo(item)">
                <template #icon><t-icon name="arrow-right" /></template>
                一键转为交易待办
              </t-button>
            </div>
          </div>
        </div>
      </div>
    </t-card>

    <!-- 风控阈值配置弹窗 -->
    <t-dialog
      v-model:visible="configOpen"
      header="调整买卖点扫描阈值"
      width="min(460px, 94vw)"
      :confirm-btn="{ content: '保存设置', theme: 'primary' }"
      :on-confirm="saveConfig"
    >
      <t-form label-width="120px" style="margin-top: 14px">
        <t-form-item label="止损阈值 (%)">
          <t-input-number v-model="cfg.stopLossPct" :min="1" :max="30" :step="1" style="width: 100%" />
          <template #help>当标的跌幅达到该百分比时报警（默认 -8%）</template>
        </t-form-item>
        <t-form-item label="止盈阈值 (%)">
          <t-input-number v-model="cfg.takeProfitPct" :min="5" :max="100" :step="5" style="width: 100%" />
          <template #help>当标的涨幅达到该百分比时提示止盈（默认 +25%）</template>
        </t-form-item>
        <t-form-item label="偏离再平衡 (%)">
          <t-input-number v-model="cfg.rebalanceThresholdPct" :min="1" :max="10" :step="0.5" style="width: 100%" />
          <template #help>仓位偏离目标权重超过该比例时提示再平衡（默认 3%）</template>
        </t-form-item>
      </t-form>
    </t-dialog>
  </t-space>
</template>
<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next';
import { computed, reactive, ref } from 'vue';

import { useInvestStore } from '@/store';
import type { ActionPoint, AlertLevel, AlertType, TradeAlert, TradeSide } from '@/types/invest';

defineOptions({ name: 'TradeAlerts' });

const invest = useInvestStore();

const filterType = ref<'all' | AlertType>('all');
const configOpen = ref(false);

const cfg = reactive({
  stopLossPct: Math.abs((invest.prefs.stopLossPct ?? -0.08) * 100),
  takeProfitPct: (invest.prefs.takeProfitPct ?? 0.25) * 100,
  rebalanceThresholdPct: (invest.prefs.rebalanceThresholdPct ?? 0.03) * 100,
});

const alerts = computed(() => invest.activeAlerts);

const dangerCount = computed(() => alerts.value.filter((a) => a.level === 'danger').length);
const warningCount = computed(() => alerts.value.filter((a) => a.level === 'warning').length);
const rebalanceCount = computed(() => alerts.value.filter((a) => a.type === 'rebalance').length);

const filteredAlerts = computed(() => {
  if (filterType.value === 'all') return alerts.value;
  return alerts.value.filter((a) => a.type === filterType.value);
});

const shortCode = (c: string) => c.replace(/^(sh|sz|bj)/i, '');

const levelTheme = (lvl: AlertLevel) => {
  if (lvl === 'danger') return 'danger';
  if (lvl === 'warning') return 'warning';
  return 'primary';
};

const typeLabel = (t: AlertType) => {
  switch (t) {
    case 'stop_loss':
      return '止损红线';
    case 'take_profit':
      return '阶段止盈';
    case 'thesis_risk':
      return '逻辑预警';
    case 'rebalance':
      return '仓位再平衡';
    default:
      return '买卖提醒';
  }
};

const actionLabel = (act: ActionPoint) => {
  switch (act) {
    case 'add':
      return '加仓买入';
    case 'reduce':
      return '减仓卖出';
    case 'exit':
      return '坚决清仓';
    default:
      return '保持观察 / 复核';
  }
};

const actionTheme = (act: ActionPoint) => {
  switch (act) {
    case 'add':
      return 'danger'; // A-share red buy
    case 'reduce':
      return 'success'; // A-share green sell
    case 'exit':
      return 'danger';
    default:
      return 'default';
  }
};

function isTodoAdded(item: TradeAlert): boolean {
  return invest.todos.some((t) => t.code === item.code && t.status === 'open');
}

function convertToTodo(item: TradeAlert) {
  const side: TradeSide = item.suggestedAction === 'add' ? 'buy' : 'sell';
  const qty = item.suggestedQty || 100;

  invest.addTodo({
    account: item.account,
    code: item.code,
    name: item.name,
    side,
    quantity: qty,
    reason: `【${typeLabel(item.type)}】${item.title}: ${item.detail}`,
  });

  MessagePlugin.success(`已生成 ${item.name} 的交易待办`);
}

function saveConfig() {
  invest.setPref('stopLossPct', -Math.abs(cfg.stopLossPct) / 100);
  invest.setPref('takeProfitPct', cfg.takeProfitPct / 100);
  invest.setPref('rebalanceThresholdPct', cfg.rebalanceThresholdPct / 100);
  configOpen.value = false;
  MessagePlugin.success('风控阈值已更新');
  return true;
}
</script>
<style scoped>
.alert-kpi-card {
  background: var(--guanlan-surface-soft);
  border: 1px solid var(--guanlan-line);
  border-radius: 8px;
  padding: 14px 16px;
}

.kpi-label {
  font-size: 12px;
  color: var(--guanlan-muted);
  margin-bottom: 4px;
}

.kpi-value {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.25;
}

.kpi-tip {
  margin-top: 6px;
  font-size: 12px;
  color: var(--guanlan-muted);
}

.alert-filter-bar {
  margin-bottom: 16px;
}

.alerts-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.alert-item-card {
  padding: 14px 16px;
  background: var(--td-bg-color-container);
  border: 1px solid var(--guanlan-line);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.alert-item-card:hover {
  border-color: var(--td-component-stroke);
  box-shadow: var(--td-shadow-1);
}

.level-danger {
  border-color: rgb(184 67 62 / 28%);
  background: linear-gradient(180deg, rgb(184 67 62 / 4%) 0%, var(--td-bg-color-container) 100%);
}

.level-warning {
  border-color: rgb(184 120 45 / 28%);
  background: linear-gradient(180deg, rgb(184 120 45 / 4%) 0%, var(--td-bg-color-container) 100%);
}

.level-info {
  border-color: rgb(53 105 187 / 28%);
  background: linear-gradient(180deg, rgb(53 105 187 / 4%) 0%, var(--td-bg-color-container) 100%);
}

.alert-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 8px;
}

.alert-head-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.symbol-name {
  font-size: 14px;
  color: var(--guanlan-ink);
}

.symbol-code {
  font-size: 12px;
  color: var(--guanlan-muted);
}

.alert-time {
  font-size: 12px;
  color: var(--guanlan-muted);
}

.alert-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--guanlan-ink);
  margin-bottom: 4px;
}

.alert-detail {
  font-size: 14px;
  color: var(--guanlan-muted);
  line-height: 1.5;
  margin-bottom: 12px;
}

.alert-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px dashed var(--guanlan-line);
  padding-top: 10px;
  flex-wrap: wrap;
  gap: 8px;
}

.alert-suggest {
  display: flex;
  align-items: center;
  gap: 6px;
}

.suggest-label {
  font-size: 12px;
  color: var(--guanlan-muted);
}
</style>
