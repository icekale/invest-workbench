<template>
  <t-space direction="vertical" :size="16" style="width: 100%">
    <span style="color: var(--td-text-color-secondary)">这个工作台先服务个人记账和研究，不接交易。</span>

    <t-card title="账户管理">
      <t-list split>
        <t-list-item>
          <div class="acct-row">
            <span class="acct-name">股票账户</span>
            <span class="acct-mv">{{ money(stock.mv) }}</span>
            <t-tag theme="success" variant="light">已启用</t-tag>
          </div>
        </t-list-item>
        <t-list-item>
          <div class="acct-row">
            <span class="acct-name">ETF 账户</span>
            <span class="acct-mv">{{ money(etf.mv) }}</span>
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

    <t-card title="数据来源">
      <t-list split>
        <t-list-item>
          <div class="acct-row">
            <span class="acct-name">行情数据</span>
            <t-tag :theme="invest.quoteAt ? 'success' : 'default'" variant="light">
              {{ invest.quoteAt ? `已连接腾讯 ${new Date(invest.quoteAt).toTimeString().slice(0, 5)}` : '未连接' }}
            </t-tag>
          </div>
        </t-list-item>
        <t-list-item>
          <div class="acct-row">
            <span class="acct-name">研究资料</span>
            <t-tag variant="light">本地</t-tag>
          </div>
        </t-list-item>
        <t-list-item>
          <div class="acct-row">
            <span class="acct-name">收盘提醒</span>
            <t-switch :value="invest.prefs.closeRemind" @change="(v) => invest.setPref('closeRemind', Boolean(v))" />
          </div>
        </t-list-item>
      </t-list>
    </t-card>

    <t-card title="后续可接入">
      <template #actions>
        <span class="plan-sub-action">建议迭代顺序</span>
      </template>
      <div class="future-list">
        <div v-for="item in futureFeatures" :key="item.step" class="future-item">
          <div class="future-icon-badge" :class="item.badgeClass">
            <svg
              v-if="item.iconType === 'sheet'"
              class="future-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="M8 13h8" />
              <path d="M8 17h8" />
              <path d="M12 13v8" />
            </svg>
            <svg
              v-else-if="item.iconType === 'broadcast'"
              class="future-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M4.9 16.1C1 12.2 1 5.8 4.9 1.9" />
              <path d="M7.8 13.2a6 6 0 0 1 0-8.5" />
              <circle cx="12" cy="9" r="2" />
              <path d="M12 11v11" />
              <path d="m9 22 3-8 3 8" />
              <path d="M16.2 4.8c2.4 2.3 2.4 6.1 0 8.5" />
              <path d="M19.1 1.9a14.2 14.2 0 0 1 0 14.2" />
            </svg>
            <svg
              v-else-if="item.iconType === 'bell'"
              class="future-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              <path d="M4 2C2.8 3.7 2 5.7 2 8" />
              <path d="M22 8c0-2.3-.8-4.3-2-6" />
            </svg>
          </div>
          <div class="future-content">
            <div class="future-title">{{ item.title }}</div>
            <div class="future-desc">{{ item.desc }}</div>
          </div>
          <div class="future-step">{{ item.step }}</div>
        </div>
      </div>
    </t-card>

    <t-card title="调仓计划（ETF）">
      <div class="table-wrap">
        <t-table :data="planRows" :columns="planCols" row-key="code">
          <template #target="{ row }">{{ pct(row.target) }}</template>
          <template #current="{ row }">{{ row.current == null ? '—' : pct(row.current) }}</template>
          <template #diff="{ row }">
            <t-tag v-if="row.diff != null" size="small" variant="light" :theme="row.diff > 0 ? 'danger' : 'success'">
              {{ pct(row.diff) }}
            </t-tag>
            <span v-else>—</span>
          </template>
        </t-table>
      </div>
    </t-card>

    <t-card title="待办买卖">
      <div class="table-wrap">
        <t-table :data="invest.todos" :columns="todoCols" row-key="id">
          <template #side="{ row }">
            <t-tag size="small" :theme="row.side === 'buy' ? 'danger' : 'success'" variant="light">
              {{ row.side === 'buy' ? '买' : '卖' }}
            </t-tag>
          </template>
          <template #status="{ row }">
            <t-tag size="small" variant="outline" :theme="row.status === 'open' ? 'warning' : 'success'">
              {{ row.status === 'open' ? '待执行' : '已完成' }}
            </t-tag>
          </template>
          <template #op="{ row }">
            <t-button size="small" variant="outline" @click="toggleTodo(row.id, row.status)">
              {{ row.status === 'open' ? '勾成已完成' : '重新打开' }}
            </t-button>
          </template>
        </t-table>
      </div>
    </t-card>

    <t-card title="纪律检查">
      <t-list split>
        <t-list-item v-for="r in checks" :key="r.id">
          <div class="check-row">
            <t-tag :theme="r.ok ? 'success' : 'danger'" variant="light">{{ r.ok ? '通过' : '失败' }}</t-tag>
            <div class="check-copy">
              <div class="check-title">{{ r.title }}</div>
              <div class="check-detail">{{ r.detail }}</div>
            </div>
          </div>
        </t-list-item>
      </t-list>
    </t-card>
  </t-space>
</template>
<script setup lang="ts">
import { computed, onMounted } from 'vue';

import { disciplineRules, planTargets } from '@/mock/invest';
import { useInvestStore } from '@/store';
import type { TodoStatus } from '@/types/invest';
import { summarize } from '@/utils/book';

defineOptions({ name: 'PlanIndex' });

const invest = useInvestStore();

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
  { colKey: 'code', title: '代码' },
  { colKey: 'target', title: '目标' },
  { colKey: 'current', title: '当前' },
  { colKey: 'diff', title: '差' },
];

const todoCols = [
  { colKey: 'name', title: '标的' },
  { colKey: 'side', title: '方向' },
  { colKey: 'quantity', title: '数量' },
  { colKey: 'reason', title: '原因' },
  { colKey: 'status', title: '状态' },
  { colKey: 'op', title: '操作' },
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
      detail: '第一期无交易录入，仅作提醒',
    };
  }),
);

const futureFeatures = [
  {
    step: '第 1 步',
    title: '持仓与交易台账',
    desc: '导入成交记录后自动计算成本、收益与换手',
    iconType: 'sheet',
    badgeClass: 'badge-green',
  },
  {
    step: '第 2 步',
    title: '宏观与行情数据',
    desc: '接入 Wind 或本地缓存，自动生成每日摘要',
    iconType: 'broadcast',
    badgeClass: 'badge-blue',
  },
  {
    step: '第 3 步',
    title: '买卖点提醒',
    desc: '根据估值、价格和论文状态生成动作提醒',
    iconType: 'bell',
    badgeClass: 'badge-amber',
  },
];

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
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  width: 100%;
}

.acct-name {
  min-width: 5.5em;
  font-weight: 600;
  line-height: 22px;
}

.acct-mv {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.table-wrap {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
}

.plan-sub-action {
  font-size: 13px;
  color: var(--td-text-color-secondary);
}

.future-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0;
}

.future-item {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
}

.future-icon-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 8px;
}

.badge-green {
  background-color: #e8f7ee;
  color: #16815f;
}

.badge-blue {
  background-color: #e8f3ff;
  color: #1668dc;
}

.badge-amber {
  background-color: #fef3e6;
  color: #d46b08;
}

.future-svg {
  width: 20px;
  height: 20px;
}

.future-content {
  flex: 1;
  min-width: 0;
}

.future-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--td-text-color-primary);
  line-height: 22px;
}

.future-desc {
  margin-top: 2px;
  font-size: 13px;
  color: var(--td-text-color-secondary);
  line-height: 20px;
}

.future-step {
  flex-shrink: 0;
  margin-left: auto;
  font-size: 13px;
  color: var(--td-text-color-secondary);
}

.acct-form :deep(.t-input-number) {
  width: 100%;
  max-width: 280px;
}

@media (width <= 767px) {
  .acct-row {
    justify-content: space-between;
  }

  .acct-mv {
    margin-left: 0;
  }

  .acct-form :deep(.t-form__item) {
    display: block;
  }

  .acct-form :deep(.t-form__label),
  .acct-form :deep(.t-form__controls) {
    width: 100% !important;
  }

  .acct-form :deep(.t-input-number) {
    max-width: none;
  }
}
</style>
