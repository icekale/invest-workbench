<template>
  <t-space direction="vertical" :size="16" style="width: 100%">
    <span style="color: var(--td-text-color-secondary)">这个工作台先服务个人记账和研究，不接交易。</span>

    <t-card title="账户管理">
      <t-list split>
        <t-list-item>
          股票账户
          <template #action>
            <t-space>
              <span>{{ money(stock.mv) }}</span>
              <t-tag theme="success" variant="light">已启用</t-tag>
            </t-space>
          </template>
        </t-list-item>
        <t-list-item>
          ETF 账户
          <template #action>
            <t-space>
              <span>{{ money(etf.mv) }}</span>
              <t-tag theme="success" variant="light">已启用</t-tag>
            </t-space>
          </template>
        </t-list-item>
      </t-list>
      <t-form style="margin-top: 16px">
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
          行情数据
          <template #action>
            <t-tag :theme="invest.quoteAt ? 'success' : 'default'" variant="light">
              {{ invest.quoteAt ? `已连接腾讯 ${new Date(invest.quoteAt).toTimeString().slice(0, 5)}` : '未连接' }}
            </t-tag>
          </template>
        </t-list-item>
        <t-list-item>
          研究资料
          <template #action>
            <t-tag variant="light">本地</t-tag>
          </template>
        </t-list-item>
        <t-list-item>
          收盘提醒
          <template #action>
            <t-switch :value="invest.prefs.closeRemind" @change="(v) => invest.setPref('closeRemind', Boolean(v))" />
          </template>
        </t-list-item>
      </t-list>
    </t-card>

    <t-card title="后续可接入">
      <t-list split>
        <t-list-item>券商对账单导入</t-list-item>
        <t-list-item>真实交易日历与除权</t-list-item>
        <t-list-item>宏观日历自动抓取</t-list-item>
      </t-list>
    </t-card>

    <t-card title="调仓计划（ETF）">
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
    </t-card>

    <t-card title="待办买卖">
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
    </t-card>

    <t-card title="纪律检查">
      <t-list split>
        <t-list-item v-for="r in checks" :key="r.id">
          <t-tag :theme="r.ok ? 'success' : 'danger'" variant="light">{{ r.ok ? '通过' : '失败' }}</t-tag>
          {{ r.title }}
          <template #action>{{ r.detail }}</template>
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

function toggleTodo(id: string, status: TodoStatus) {
  invest.setTodoStatus(id, status === 'open' ? 'done' : 'open');
}
</script>
