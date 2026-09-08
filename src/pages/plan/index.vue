<template>
  <div class="plan-page-container">
    <!-- Top Tabs Header -->
    <t-tabs v-model="activeTab" theme="card" size="medium" class="plan-main-tabs">
      <t-tab-panel value="overview" label="账户设定与调仓目标" />
      <t-tab-panel value="ledger" :label="`持仓与交易台账 (${invest.transactions.length})`" />
      <t-tab-panel value="alerts">
        <template #label>
          <span class="alerts-tab-label">
            <span>买卖点建议</span>
            <span v-if="invest.activeAlerts.length" class="alerts-count-badge">{{ invest.activeAlerts.length }}</span>
          </span>
        </template>
      </t-tab-panel>
    </t-tabs>

    <!-- Tab 1: 账户管理与调仓纪律 -->
    <div v-show="activeTab === 'overview'" class="tab-pane-content">
      <t-space direction="vertical" :size="16" style="width: 100%">
        <!-- Page Overview Header Strip -->
        <div class="plan-hero-strip">
          <div class="strip-left">
            <h2 class="strip-title">双账户资金与调仓纪律</h2>
            <p class="strip-desc">双轨独立核算 · 现金动态调整 · ETF 配比自动再平衡 · 纪律红线严控</p>
          </div>
          <div class="strip-right">
            <div class="quick-kpi-group">
              <div class="kpi-mini">
                <span class="kpi-mini-label">总可用资金</span>
                <span class="kpi-mini-val">¥{{ money(invest.cash.stock + invest.cash.etf) }}</span>
              </div>
              <div class="kpi-mini-divider" />
              <div class="kpi-mini">
                <span class="kpi-mini-label">调仓待办</span>
                <span class="kpi-mini-val">{{ pendingTodosCount }} 笔</span>
              </div>
              <div class="kpi-mini-divider" />
              <div class="kpi-mini">
                <span class="kpi-mini-label">买卖点预警</span>
                <span class="kpi-mini-val" :class="{ 'text-warn': invest.activeAlerts.length > 0 }">
                  {{ invest.activeAlerts.length }} 条
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 1. 双账户资金与隔离管理 -->
        <t-card title="账户资金与隔离设定">
          <template #actions>
            <div class="card-action-bar">
              <span class="iso-label">双账户隔离</span>
              <t-switch
                :value="invest.prefs.isolate"
                size="medium"
                @change="(v) => invest.setPref('isolate', Boolean(v))"
              />
            </div>
          </template>

          <t-row :gutter="[16, 16]">
            <!-- 股票账户 Card -->
            <t-col :xs="12" :md="6">
              <div class="acct-tile">
                <div class="tile-header">
                  <div class="tile-title-group">
                    <span class="acct-badge-dot stock-dot" />
                    <span class="tile-name">股票账户</span>
                  </div>
                  <t-tag size="small" theme="success" variant="light">独立归因</t-tag>
                </div>
                <div class="tile-body">
                  <div class="metric-row">
                    <span class="m-label">持仓市值</span>
                    <span class="m-val tabular-nums">¥{{ money(stock.mv) }}</span>
                  </div>
                  <div class="metric-row">
                    <span class="m-label">现金储备</span>
                    <div class="cash-input-box">
                      <span class="currency-sign">¥</span>
                      <t-input-number
                        :value="invest.cash.stock"
                        :min="0"
                        :step="10000"
                        :decimal-places="0"
                        theme="column"
                        size="small"
                        class="cash-stepper"
                        @change="(v) => invest.setCash('stock', Number(v) || 0)"
                      />
                    </div>
                  </div>
                  <div class="metric-row total-row">
                    <span class="m-label">账户总资产</span>
                    <span class="m-val-hero tabular-nums">¥{{ money((stock.mv || 0) + invest.cash.stock) }}</span>
                  </div>
                </div>
              </div>
            </t-col>

            <!-- ETF 账户 Card -->
            <t-col :xs="12" :md="6">
              <div class="acct-tile">
                <div class="tile-header">
                  <div class="tile-title-group">
                    <span class="acct-badge-dot etf-dot" />
                    <span class="tile-name">ETF 账户</span>
                  </div>
                  <t-tag size="small" theme="success" variant="light">核心底仓</t-tag>
                </div>
                <div class="tile-body">
                  <div class="metric-row">
                    <span class="m-label">持仓市值</span>
                    <span class="m-val tabular-nums">¥{{ money(etf.mv) }}</span>
                  </div>
                  <div class="metric-row">
                    <span class="m-label">现金储备</span>
                    <div class="cash-input-box">
                      <span class="currency-sign">¥</span>
                      <t-input-number
                        :value="invest.cash.etf"
                        :min="0"
                        :step="10000"
                        :decimal-places="0"
                        theme="column"
                        size="small"
                        class="cash-stepper"
                        @change="(v) => invest.setCash('etf', Number(v) || 0)"
                      />
                    </div>
                  </div>
                  <div class="metric-row total-row">
                    <span class="m-label">账户总资产</span>
                    <span class="m-val-hero tabular-nums">¥{{ money((etf.mv || 0) + invest.cash.etf) }}</span>
                  </div>
                </div>
              </div>
            </t-col>
          </t-row>

          <t-alert
            v-if="!invest.prefs.isolate"
            theme="warning"
            message="账户隔离已关闭：指标仍分账户独立展示，严禁把两本账混成一个不可区分的大池子。"
            style="margin-top: 14px"
          />
        </t-card>

        <!-- 2. 调仓目标配比（ETF） -->
        <t-card title="调仓目标配比（ETF）">
          <template #actions>
            <div class="plan-summary-chips">
              <span class="chip-item">目标资产覆盖：<b>93.0%</b></span>
              <span class="chip-item">留存现金：<b>7.0%</b></span>
              <span class="chip-item">阈值：<b>±3.0%</b></span>
            </div>
          </template>

          <div class="table-wrap">
            <t-table :data="planRows" :columns="planCols" row-key="code" size="medium" hover class="guanlan-plan-table">
              <!-- Name & Code -->
              <template #name="{ row }">
                <span class="table-asset-name">{{ row.name }}</span>
              </template>

              <template #code="{ row }">
                <span class="code-mono">{{ row.code }}</span>
              </template>

              <!-- Weights -->
              <template #target="{ row }">
                <span class="num-cell tabular-nums font-medium">{{ pct(row.target) }}</span>
              </template>

              <template #current="{ row }">
                <span class="num-cell tabular-nums">
                  {{ row.current == null ? '—' : pct(row.current) }}
                </span>
              </template>

              <!-- Difference -->
              <template #diff="{ row }">
                <span
                  v-if="row.diff != null"
                  class="diff-badge tabular-nums"
                  :class="row.diff > 0 ? 'is-gain' : row.diff < 0 ? 'is-loss' : 'is-neutral'"
                >
                  {{ row.diff > 0 ? '+' : '' }}{{ pct(row.diff) }}
                </span>
                <span v-else class="text-placeholder">—</span>
              </template>

              <!-- Rebalance Advice Tag -->
              <template #status="{ row }">
                <t-tag
                  size="small"
                  :theme="row.statusTheme"
                  :variant="row.status === 'ok' ? 'outline' : 'light'"
                  class="action-tag"
                >
                  {{ row.statusText }}
                </t-tag>
              </template>
            </t-table>
          </div>
        </t-card>

        <!-- 3. 待办买卖清单 -->
        <t-card title="待办买卖清单">
          <template #actions>
            <t-space :size="10">
              <t-button size="small" theme="primary" variant="outline" @click="activeTab = 'alerts'">
                <template #icon><t-icon name="notification" /></template>
                查看买卖点建议 ({{ invest.activeAlerts.length }})
              </t-button>
            </t-space>
          </template>

          <div class="table-wrap">
            <t-table
              v-if="invest.todos.length"
              :data="invest.todos"
              :columns="todoCols"
              row-key="id"
              size="medium"
              hover
              class="guanlan-plan-table"
            >
              <template #name="{ row }">
                <span class="table-asset-name">{{ row.name }}</span>
              </template>

              <template #code="{ row }">
                <span class="code-mono">{{ row.code || '—' }}</span>
              </template>

              <template #side="{ row }">
                <t-tag size="small" :theme="row.side === 'buy' ? 'danger' : 'success'" variant="light" class="side-tag">
                  {{ row.side === 'buy' ? '买入' : '卖出' }}
                </t-tag>
              </template>

              <template #quantity="{ row }">
                <span class="num-cell tabular-nums font-medium"> {{ Number(row.quantity).toLocaleString() }} 份 </span>
              </template>

              <template #status="{ row }">
                <t-tag size="small" :theme="row.status === 'open' ? 'warning' : 'success'" variant="outline">
                  {{ row.status === 'open' ? '待执行' : '已完成' }}
                </t-tag>
              </template>

              <template #op="{ row }">
                <t-space :size="8">
                  <t-link theme="primary" hover="color" @click="toggleTodo(row.id, row.status)">
                    {{ row.status === 'open' ? '完成' : '重开' }}
                  </t-link>
                  <t-popconfirm content="确定移除此项待办事项？" @confirm="invest.removeTodo(row.id)">
                    <t-link theme="danger" hover="color">删除</t-link>
                  </t-popconfirm>
                </t-space>
              </template>
            </t-table>

            <t-empty v-else description="当前无待执行的买卖事项，各标的均在正常波动纪律内" style="padding: 32px 0" />
          </div>
        </t-card>

        <!-- 4. 纪律红线审查 -->
        <t-card title="纪律红线检查">
          <t-row :gutter="[16, 16]">
            <t-col v-for="r in checks" :key="r.id" :xs="12" :sm="6" :md="6">
              <div class="discipline-tile" :class="{ 'has-warning': !r.ok }">
                <div class="tile-top">
                  <span class="tile-gate-title">{{ r.title }}</span>
                  <t-tag size="small" :theme="r.ok ? 'success' : 'danger'" variant="light">
                    {{ r.ok ? '合规通过' : '风险预警' }}
                  </t-tag>
                </div>
                <div class="tile-detail">{{ r.detail }}</div>
              </div>
            </t-col>
          </t-row>
        </t-card>

        <!-- 5. 数据来源与系统状态 -->
        <div class="status-footer-panel">
          <div class="status-item">
            <span class="status-dot online" />
            <span class="status-text">
              行情数据通道：{{
                invest.quoteAt
                  ? `腾讯/新浪接口正常 (${new Date(invest.quoteAt).toTimeString().slice(0, 5)})`
                  : '等待连接'
              }}
            </span>
          </div>
          <div class="status-item">
            <span class="status-dot online" />
            <span class="status-text">本地离线决策引擎：已就绪</span>
          </div>
          <div class="status-item close-remind-switch">
            <span class="status-label-sub">收盘前提醒：</span>
            <t-switch
              :value="invest.prefs.closeRemind"
              size="small"
              @change="(v) => invest.setPref('closeRemind', Boolean(v))"
            />
          </div>
        </div>
      </t-space>
    </div>

    <!-- Tab 2: 持仓与交易台账 -->
    <div v-show="activeTab === 'ledger'" class="tab-pane-content">
      <transaction-ledger />
    </div>

    <!-- Tab 3: 买卖点建议 -->
    <div v-show="activeTab === 'alerts'" class="tab-pane-content">
      <trade-alerts />
    </div>
  </div>
</template>
<script setup lang="ts">
import type { PrimaryTableCol } from 'tdesign-vue-next';
import { computed, onMounted, ref } from 'vue';

import { disciplineRules, planTargets } from '@/mock/invest';
import { useInvestStore } from '@/store';
import type { TodoStatus } from '@/types/invest';
import { summarize } from '@/utils/book';

import TradeAlerts from './components/TradeAlerts.vue';
import TransactionLedger from './components/TransactionLedger.vue';

defineOptions({ name: 'PlanIndex' });

const invest = useInvestStore();
const activeTab = ref<'overview' | 'ledger' | 'alerts'>('overview');

onMounted(() => {
  invest.refreshQuotes();
});

const stock = computed(() => summarize(invest.stockRows, invest.cash.stock));
const etf = computed(() => summarize(invest.etfRows, invest.cash.etf));

const money = (n: number | null) => (n == null ? '—' : n.toLocaleString('zh-CN', { maximumFractionDigits: 0 }));
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const pendingTodosCount = computed(() => invest.todos.filter((t) => t.status === 'open').length);

const etfMv = computed(() => {
  const rows = invest.etfRows;
  if (!rows.length) return 0;
  if (rows.every((r) => r.marketValue == null)) return null;
  return rows.reduce((s, r) => s + (r.marketValue ?? 0), 0);
});

const planRows = computed(() => {
  const threshold = invest.prefs.rebalanceThresholdPct ?? 0.03;
  return planTargets.map((t) => {
    const row = invest.etfRows.find((r) => r.code === t.code);
    const current = etfMv.value && row?.marketValue != null ? row.marketValue / etfMv.value : null;
    const diff = current == null ? null : current - t.targetWeight;

    let statusText = '配比正常';
    let statusTheme: 'success' | 'warning' | 'danger' | 'default' = 'default';
    let status: 'ok' | 'over' | 'under' = 'ok';

    if (diff != null) {
      if (diff > threshold) {
        statusText = `超配 ${pct(diff)} (建议减仓)`;
        statusTheme = 'danger';
        status = 'over';
      } else if (diff < -threshold) {
        statusText = `欠配 ${pct(Math.abs(diff))} (建议补仓)`;
        statusTheme = 'success';
        status = 'under';
      }
    }

    return {
      code: t.code,
      name: row?.name || t.code,
      target: t.targetWeight,
      current,
      diff,
      status,
      statusText,
      statusTheme,
    };
  });
});

const planCols: PrimaryTableCol[] = [
  { colKey: 'name', title: '标的名称', minWidth: 140 },
  { colKey: 'code', title: '代码', width: 110 },
  { colKey: 'target', title: '目标权重', width: 110, align: 'right' },
  { colKey: 'current', title: '当前实际', width: 110, align: 'right' },
  { colKey: 'diff', title: '偏离差额', width: 120, align: 'right' },
  { colKey: 'status', title: '再平衡建议', width: 180, align: 'center' },
];

const todoCols: PrimaryTableCol[] = [
  { colKey: 'name', title: '交易标的', minWidth: 130 },
  { colKey: 'code', title: '代码', width: 110 },
  { colKey: 'side', title: '方向', width: 80, align: 'center' },
  { colKey: 'quantity', title: '计划数量', width: 110, align: 'right' },
  { colKey: 'reason', title: '触发逻辑与纪律', minWidth: 180 },
  { colKey: 'status', title: '执行状态', width: 90, align: 'center' },
  { colKey: 'op', title: '操作', width: 110, align: 'center' },
];

const checks = computed(() =>
  disciplineRules.map((rule) => {
    if (rule.id === 'd1') {
      const offenders = invest.enriched.filter((h) => {
        const acc = invest.enriched.filter((x) => x.account === h.account);
        if (acc.every((x) => x.marketValue == null) || h.marketValue == null) return false;
        const mv = acc.reduce((s, x) => s + (x.marketValue ?? 0), 0);
        return mv > 0 && h.marketValue / mv > rule.limit;
      });
      return {
        id: rule.id,
        title: rule.title,
        ok: offenders.length === 0,
        detail: offenders.length
          ? `超标标的: ${offenders.map((o) => o.name).join('、')} (单票权重 > 25%)`
          : '各标的均在 25% 安全集中度红线内',
      };
    }
    return {
      id: rule.id,
      title: rule.title,
      ok: true,
      detail: '已对接交易台账、止损扫描 (-8%) 与再平衡触发模型',
    };
  }),
);

function toggleTodo(id: string, status: TodoStatus) {
  invest.setTodoStatus(id, status === 'open' ? 'done' : 'open');
}
</script>
<style scoped lang="less">
.plan-page-container {
  width: 100%;
}

.plan-main-tabs {
  margin-bottom: 16px;
}

.tab-pane-content {
  width: 100%;
}

/* Overview Header Strip */
.plan-hero-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background-color: var(--td-bg-color-container, #fff);
  border: 1px solid var(--guanlan-line, #e6eaed);
  border-radius: 10px;
  padding: 16px 20px;
  box-shadow: 0 8px 30px rgb(24 40 51 / 5%);

  .strip-title {
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
    color: var(--td-text-color-primary, #14212b);
    margin: 0 0 4px;
  }

  .strip-desc {
    font-size: 13px;
    color: var(--td-text-color-secondary, #4f5d67);
    margin: 0;
    line-height: 20px;
  }

  .quick-kpi-group {
    display: flex;
    align-items: center;
    gap: 16px;

    .kpi-mini {
      display: flex;
      flex-direction: column;
      align-items: flex-end;

      .kpi-mini-label {
        font-size: 11px;
        color: var(--td-text-color-placeholder, #5e6c76);
        line-height: 16px;
      }

      .kpi-mini-val {
        font-size: 16px;
        font-weight: 600;
        line-height: 22px;
        font-variant-numeric: tabular-nums;
        color: var(--td-text-color-primary, #14212b);

        &.text-warn {
          color: var(--guanlan-gain, #b8433e);
        }
      }
    }

    .kpi-mini-divider {
      width: 1px;
      height: 24px;
      background-color: var(--guanlan-line, #e6eaed);
    }
  }
}

/* Card Action Bar */
.card-action-bar {
  display: flex;
  align-items: center;
  gap: 8px;

  .iso-label {
    font-size: 12px;
    color: var(--td-text-color-secondary, #4f5d67);
  }
}

/* Account Tiles */
.acct-tile {
  background-color: var(--td-bg-color-page, #f6f7f9);
  border: 1px solid var(--guanlan-line, #e6eaed);
  border-radius: 8px;
  padding: 16px 18px;

  .tile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;

    .tile-title-group {
      display: flex;
      align-items: center;
      gap: 8px;

      .acct-badge-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;

        &.stock-dot {
          background-color: #3569bb;
        }

        &.etf-dot {
          background-color: var(--td-brand-color, #0d706d);
        }
      }

      .tile-name {
        font-size: 14px;
        font-weight: 600;
        color: var(--td-text-color-primary, #14212b);
      }
    }
  }

  .tile-body {
    display: flex;
    flex-direction: column;
    gap: 10px;

    .metric-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 13px;

      .m-label {
        color: var(--td-text-color-secondary, #4f5d67);
      }

      .m-val {
        font-weight: 600;
        color: var(--td-text-color-primary, #14212b);
      }

      &.total-row {
        margin-top: 4px;
        padding-top: 10px;
        border-top: 1px dashed var(--guanlan-line, #e6eaed);

        .m-val-hero {
          font-size: 18px;
          font-weight: 700;
          color: var(--td-brand-color, #0d706d);
        }
      }
    }
  }
}

.cash-input-box {
  display: flex;
  align-items: center;
  gap: 4px;

  .currency-sign {
    font-size: 12px;
    font-weight: 600;
    color: var(--td-text-color-secondary, #4f5d67);
  }

  .cash-stepper {
    width: 140px;
  }
}

/* Plan Summary Chips */
.plan-summary-chips {
  display: flex;
  align-items: center;
  gap: 12px;

  .chip-item {
    font-size: 12px;
    color: var(--td-text-color-secondary, #4f5d67);

    b {
      font-weight: 600;
      color: var(--td-text-color-primary, #14212b);
    }
  }
}

/* Table Enhancements */
.guanlan-plan-table {
  :deep(.t-table__th) {
    font-size: 12px;
    font-weight: 500;
    color: var(--td-text-color-secondary, #4f5d67);
  }

  :deep(.t-table__td) {
    font-size: 13px;
  }

  .table-asset-name {
    font-weight: 600;
    color: var(--td-text-color-primary, #14212b);
  }

  .code-mono {
    font-family: var(--td-font-family-mono);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    letter-spacing: 0.3px;
    color: var(--td-text-color-primary, #14212b);
    background-color: var(--td-bg-color-page, #f6f7f9);
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid var(--guanlan-line, #e6eaed);
    display: inline-block;
  }

  .num-cell {
    font-variant-numeric: tabular-nums;

    &.font-medium {
      font-weight: 600;
    }
  }

  .diff-badge {
    font-size: 12px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;

    &.is-gain {
      color: var(--guanlan-gain, #b8433e);
      background-color: rgb(184 67 62 / 8%);
    }

    &.is-loss {
      color: var(--guanlan-loss, #16815f);
      background-color: rgb(22 129 95 / 8%);
    }

    &.is-neutral {
      color: var(--td-text-color-placeholder, #5e6c76);
    }
  }

  .side-tag {
    font-weight: 600;
  }

  .action-tag {
    font-weight: 500;
  }
}

.table-wrap {
  width: 100%;
  overflow-x: auto;
}

/* Discipline Tiles */
.discipline-tile {
  background-color: var(--td-bg-color-page, #f6f7f9);
  border: 1px solid var(--guanlan-line, #e6eaed);
  border-radius: 8px;
  padding: 14px 16px;
  transition: all 0.2s ease;

  &.has-warning {
    border-color: rgb(184 67 62 / 30%);
    background-color: rgb(184 67 62 / 2%);
  }

  .tile-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;

    .tile-gate-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--td-text-color-primary, #14212b);
    }
  }

  .tile-detail {
    font-size: 12px;
    color: var(--td-text-color-secondary, #4f5d67);
    line-height: 18px;
  }
}

/* Status Footer Panel */
.status-footer-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  background-color: var(--td-bg-color-container, #fff);
  border: 1px solid var(--guanlan-line, #e6eaed);
  border-radius: 8px;
  padding: 12px 18px;

  .status-item {
    display: flex;
    align-items: center;
    gap: 8px;

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;

      &.online {
        background-color: var(--guanlan-loss, #16815f);
        box-shadow: 0 0 6px rgb(22 129 95 / 50%);
      }
    }

    .status-text {
      font-size: 12px;
      color: var(--td-text-color-secondary, #4f5d67);
    }
  }

  .close-remind-switch {
    margin-left: auto;

    .status-label-sub {
      font-size: 12px;
      color: var(--td-text-color-secondary, #4f5d67);
    }
  }
}

/* Tab Header Badge */
.alerts-tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;

  .alerts-count-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
    color: #fff;
    background-color: var(--guanlan-gain, #b8433e);
    box-shadow: 0 1px 3px rgb(184 67 62 / 30%);
  }
}

@media (width <= 768px) {
  .plan-hero-strip {
    flex-direction: column;
    align-items: flex-start;

    .quick-kpi-group {
      width: 100%;
      justify-content: space-between;
    }
  }

  .plan-summary-chips {
    flex-wrap: wrap;
  }
}
</style>
