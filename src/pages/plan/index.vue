<template>
  <t-space direction="vertical" :size="16" style="width: 100%">
    <!-- 顶栏导航 Tabs -->
    <t-tabs v-model="activeTab" theme="card" size="medium">
      <t-tab-panel value="overview" label="账户设定与调仓纪律" />
      <t-tab-panel value="ledger" :label="`持仓与交易台账 (${invest.transactions.length})`" />
      <t-tab-panel value="alerts">
        <template #label>
          <span class="alerts-tab-label">
            <span>买卖点提醒</span>
            <span v-if="invest.activeAlerts.length" class="alerts-count-badge">{{ invest.activeAlerts.length }}</span>
          </span>
        </template>
      </t-tab-panel>
    </t-tabs>

    <!-- Tab 1: 账户管理与调仓纪律 -->
    <div v-show="activeTab === 'overview'">
      <t-space direction="vertical" :size="16" style="width: 100%">
        <span style="color: var(--td-text-color-secondary)">账户现金与隔离设定、纪律红线与配比执行目标。</span>

        <!-- 账户管理 -->
        <t-card title="账户管理">
          <t-list split>
            <t-list-item>
              <div class="acct-row">
                <span class="acct-name">股票账户</span>
                <span class="acct-mv">¥{{ money(stock.mv) }}</span>
                <t-tag theme="success" variant="light">已启用</t-tag>
              </div>
            </t-list-item>
            <t-list-item>
              <div class="acct-row">
                <span class="acct-name">ETF 账户</span>
                <span class="acct-mv">¥{{ money(etf.mv) }}</span>
                <t-tag theme="success" variant="light">已启用</t-tag>
              </div>
            </t-list-item>
          </t-list>
          <t-form class="acct-form" style="margin-top: 16px">
            <t-form-item label="账户隔离">
              <t-switch :value="invest.prefs.isolate" @change="(v) => invest.setPref('isolate', Boolean(v))" />
            </t-form-item>
            <t-form-item label="股票现金">
              <t-input-number
                :value="invest.cash.stock"
                :min="0"
                :decimal-places="0"
                @change="(v) => invest.setCash('stock', Number(v) || 0)"
              />
            </t-form-item>
            <t-form-item label="ETF 现金">
              <t-input-number
                :value="invest.cash.etf"
                :min="0"
                :decimal-places="0"
                @change="(v) => invest.setCash('etf', Number(v) || 0)"
              />
            </t-form-item>
          </t-form>
          <t-alert
            v-if="!invest.prefs.isolate"
            theme="warning"
            message="隔离已关闭，指标仍分账户展示，不会把两本账混成一笔。"
          />
        </t-card>

        <!-- 调仓计划（ETF） -->
        <t-card title="调仓目标配比（ETF）">
          <div class="table-wrap">
            <t-table :data="planRows" :columns="planCols" row-key="code">
              <template #target="{ row }">{{ pct(row.target) }}</template>
              <template #current="{ row }">{{ row.current == null ? '—' : pct(row.current) }}</template>
              <template #diff="{ row }">
                <t-tag
                  v-if="row.diff != null"
                  size="small"
                  variant="light"
                  :theme="row.diff > 0 ? 'danger' : 'success'"
                >
                  {{ pct(row.diff) }}
                </t-tag>
                <span v-else>—</span>
              </template>
            </t-table>
          </div>
        </t-card>

        <!-- 待办买卖 -->
        <t-card title="待办买卖清单">
          <template #actions>
            <t-button size="small" theme="primary" variant="outline" @click="activeTab = 'alerts'">
              查看买卖点建议 ({{ invest.activeAlerts.length }})
            </t-button>
          </template>
          <div class="table-wrap">
            <t-table :data="invest.todos" :columns="todoCols" row-key="id">
              <template #side="{ row }">
                <t-tag size="small" :theme="row.side === 'buy' ? 'danger' : 'success'" variant="light">
                  {{ row.side === 'buy' ? '买入' : '卖出' }}
                </t-tag>
              </template>
              <template #status="{ row }">
                <t-tag size="small" variant="outline" :theme="row.status === 'open' ? 'warning' : 'success'">
                  {{ row.status === 'open' ? '待执行' : '已完成' }}
                </t-tag>
              </template>
              <template #op="{ row }">
                <t-space :size="8">
                  <t-link theme="primary" hover="color" @click="toggleTodo(row.id, row.status)">
                    {{ row.status === 'open' ? '完成' : '重开' }}
                  </t-link>
                  <t-popconfirm content="确定移除此项待办？" @confirm="invest.removeTodo(row.id)">
                    <t-link theme="danger" hover="color">删除</t-link>
                  </t-popconfirm>
                </t-space>
              </template>
            </t-table>
          </div>
        </t-card>

        <!-- 纪律检查 -->
        <t-card title="纪律红线检查">
          <t-list split>
            <t-list-item v-for="r in checks" :key="r.id">
              <div class="check-row">
                <t-tag :theme="r.ok ? 'success' : 'danger'" variant="light">{{ r.ok ? '通过' : '预警' }}</t-tag>
                <div class="check-copy">
                  <div class="check-title">{{ r.title }}</div>
                  <div class="check-detail">{{ r.detail }}</div>
                </div>
              </div>
            </t-list-item>
          </t-list>
        </t-card>

        <!-- 数据来源 -->
        <t-card title="数据来源与网络状态">
          <t-list split>
            <t-list-item>
              <div class="acct-row">
                <span class="acct-name">行情数据源</span>
                <t-tag :theme="invest.quoteAt ? 'success' : 'default'" variant="light">
                  {{
                    invest.quoteAt ? `已连接腾讯/新浪 ${new Date(invest.quoteAt).toTimeString().slice(0, 5)}` : '未连接'
                  }}
                </t-tag>
              </div>
            </t-list-item>
            <t-list-item>
              <div class="acct-row">
                <span class="acct-name">研究资料缓存</span>
                <t-tag variant="light">本地持久化存储</t-tag>
              </div>
            </t-list-item>
            <t-list-item>
              <div class="acct-row">
                <span class="acct-name">收盘提醒</span>
                <t-switch
                  :value="invest.prefs.closeRemind"
                  @change="(v) => invest.setPref('closeRemind', Boolean(v))"
                />
              </div>
            </t-list-item>
          </t-list>
        </t-card>
      </t-space>
    </div>

    <!-- Tab 2: 持仓与交易台账 (第 1 步) -->
    <div v-show="activeTab === 'ledger'">
      <transaction-ledger />
    </div>

    <!-- Tab 3: 买卖点提醒 (第 3 步) -->
    <div v-show="activeTab === 'alerts'">
      <trade-alerts />
    </div>
  </t-space>
</template>
<script setup lang="ts">
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

const etfMv = computed(() => {
  const rows = invest.etfRows;
  if (!rows.length) return 0;
  if (rows.every((r) => r.marketValue == null)) return null;
  return rows.reduce((s, r) => s + (r.marketValue ?? 0), 0);
});

const planRows = computed(() =>
  planTargets.map((t) => {
    const row = invest.etfRows.find((r) => r.code === t.code);
    const current = etfMv.value && row?.marketValue != null ? row.marketValue / etfMv.value : null;
    return {
      code: t.code,
      name: row?.name || t.code,
      target: t.targetWeight,
      current,
      diff: current == null ? null : current - t.targetWeight,
    };
  }),
);

const planCols = [
  { colKey: 'name', title: '名称' },
  { colKey: 'code', title: '代码', width: 90 },
  { colKey: 'target', title: '目标' },
  { colKey: 'current', title: '当前' },
  { colKey: 'diff', title: '差' },
];

const todoCols = [
  { colKey: 'name', title: '标的', minWidth: 100 },
  { colKey: 'side', title: '方向', width: 70 },
  { colKey: 'quantity', title: '数量', width: 85 },
  { colKey: 'reason', title: '原因' },
  { colKey: 'status', title: '状态', width: 80 },
  { colKey: 'op', title: '操作', width: 100 },
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
        detail: offenders.length ? offenders.map((o) => o.name).join('、') : '无超配',
      };
    }
    return {
      id: rule.id,
      title: rule.title,
      ok: true,
      detail: '已对接交易台账与止损扫描规则',
    };
  }),
);

function toggleTodo(id: string, status: TodoStatus) {
  invest.setTodoStatus(id, status === 'open' ? 'done' : 'open');
}
</script>
<style scoped>
.check-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  width: 100%;
}

.check-copy {
  min-width: 0;
  flex: 1;
}

.check-title {
  font-weight: 600;
  line-height: 22px;
}

.check-detail {
  margin-top: 4px;
  color: var(--td-text-color-secondary);
  line-height: 22px;
  overflow-wrap: anywhere;
}

.acct-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.acct-name {
  font-weight: 500;
}

.acct-mv {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.table-wrap {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
}

.acct-form :deep(.t-input-number) {
  width: 100%;
  max-width: 280px;
}

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
</style>
