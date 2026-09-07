<template>
  <div class="invest-page">
    <h1 class="invest-title">计划与执行</h1>
    <p class="invest-sub">目标仓位、待办买卖、纪律检查。不接券商下单。</p>

    <section class="invest-card" style="margin-bottom: 12px">
      <div class="invest-muted">调仓计划（ETF）</div>
      <t-table :data="planRows" :columns="planCols" row-key="code" size="small">
        <template #target="{ row }">{{ pct(row.target) }}</template>
        <template #current="{ row }">{{ row.current == null ? '—' : pct(row.current) }}</template>
        <template #diff="{ row }">{{ row.diff == null ? '—' : pct(row.diff) }}</template>
      </t-table>
    </section>

    <section class="invest-card" style="margin-bottom: 12px">
      <div class="invest-muted">待办买卖</div>
      <t-table :data="invest.todos" :columns="todoCols" row-key="id" size="small">
        <template #side="{ row }">{{ row.side === 'buy' ? '买' : '卖' }}</template>
        <template #status="{ row }">{{ row.status === 'open' ? '待执行' : '已完成' }}</template>
        <template #op="{ row }">
          <t-button size="small" variant="outline" @click="toggleTodo(row.id, row.status)">
            {{ row.status === 'open' ? '勾成已完成' : '重新打开' }}
          </t-button>
        </template>
      </t-table>
    </section>

    <section class="invest-card">
      <div class="invest-muted">纪律检查</div>
      <div v-for="r in checks" :key="r.id" style="margin-top: 8px">
        <t-tag :theme="r.ok ? 'success' : 'danger'" variant="light">{{ r.ok ? '通过' : '失败' }}</t-tag>
        {{ r.title }}
        <span class="invest-muted"> {{ r.detail }}</span>
      </div>
    </section>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';

import { disciplineRules, planTargets } from '@/mock/invest';
import { useInvestStore } from '@/store';
import type { TodoStatus } from '@/types/invest';

defineOptions({ name: 'PlanIndex' });

const invest = useInvestStore();
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const etfMv = computed(() => {
  const rows = invest.etfRows;
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

function toggleTodo(id: string, status: TodoStatus) {
  invest.setTodoStatus(id, status === 'open' ? 'done' : 'open');
}
</script>
