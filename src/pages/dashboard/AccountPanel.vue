<template>
  <t-space direction="vertical" :size="16" style="width: 100%">
    <t-row :gutter="[16, 16]">
      <t-col :xs="12" :sm="6" :xl="3">
        <t-card>
          <t-statistic title="持仓市值" :value="stats.mv ?? 0" :precision="2" :loading="stats.mv == null">
            <template #extra>
              <span :style="{ color: pnlColor(stats.pnl) }">
                {{ signed(stats.pnl) }}<template v-if="stats.pnlPct != null"> · {{ pct(stats.pnlPct) }}</template>
              </span>
            </template>
          </t-statistic>
        </t-card>
      </t-col>
      <t-col :xs="12" :sm="6" :xl="3">
        <t-card>
          <t-statistic title="持仓成本" :value="stats.cost" :precision="2">
            <template #extra>仓位 {{ pctInt(stats.pos) }} · 现金 {{ pctInt(stats.cashPct) }}</template>
          </t-statistic>
        </t-card>
      </t-col>
      <t-col :xs="12" :sm="6" :xl="3">
        <t-card>
          <t-statistic
            title="浮动盈亏"
            :value="stats.pnl ?? 0"
            :precision="2"
            :loading="stats.pnl == null"
            :color="pnlColor(stats.pnl)"
          >
            <template #extra>年内 {{ pct(stats.pnlPct) }}</template>
          </t-statistic>
        </t-card>
      </t-col>
      <t-col :xs="12" :sm="6" :xl="3">
        <t-card>
          <t-statistic title="持仓健康度" :value="health.total" suffix="/100">
            <template #extra>{{ note }}</template>
          </t-statistic>
        </t-card>
      </t-col>
    </t-row>

    <t-row :gutter="[16, 16]">
      <t-col :xs="12" :xl="8">
        <t-space direction="vertical" :size="16" style="width: 100%">
          <t-card title="组合净值" subtitle="近 30 日示意，由当前浮盈反推">
            <div ref="lineEl" style="height: 228px" />
          </t-card>
          <t-card title="持仓与买卖点">
            <t-empty v-if="!rows.length" description="还没有持仓" />
            <t-table v-else :data="sorted" :columns="columns" row-key="code" size="small">
              <template #name="{ row }">
                <t-space align="center">
                  <t-avatar size="small" shape="round">{{ row.name.slice(0, 1) }}</t-avatar>
                  <div>
                    <div>{{ row.name }}</div>
                    <t-tag size="small" variant="light">{{ shortCode(row.code) }}</t-tag>
                    <t-tag v-if="row.tag" size="small" variant="light">{{ row.tag }}</t-tag>
                  </div>
                </t-space>
              </template>
              <template #mv="{ row }">{{ money(row.marketValue) }}</template>
              <template #cost="{ row }">{{ px(row.cost) }}</template>
              <template #last="{ row }">{{ row.last == null ? '—' : px(row.last) }}</template>
              <template #pnl="{ row }">
                <span :style="{ color: pnlColor(row.pnlPct) }">{{ pct(row.pnlPct) }}</span>
              </template>
              <template #action="{ row }">
                <t-tag size="small" variant="light" :theme="actionTheme[row.action]">{{ actionMap[row.action] }}</t-tag>
              </template>
            </t-table>
          </t-card>
        </t-space>
      </t-col>
      <t-col :xs="12" :xl="4">
        <t-space direction="vertical" :size="16" style="width: 100%">
          <t-card title="资产配置" subtitle="当前权重含现金">
            <t-empty v-if="!alloc.length" description="还没有市值" />
            <t-space v-else align="center" :size="16">
              <t-progress theme="circle" :percentage="Math.round((stats.pos ?? 0) * 100)">
                <template #label>已投资</template>
              </t-progress>
              <t-list style="flex: 1">
                <t-list-item v-for="a in alloc" :key="a.name">
                  {{ a.name }}
                  <template #action>{{ Math.round(a.pct * 100) }}%</template>
                </t-list-item>
              </t-list>
            </t-space>
          </t-card>
          <t-card title="风险提示" subtitle="需要关注">
            <t-list>
              <t-list-item v-for="r in riskItems" :key="r.title">
                <t-list-item-meta :title="r.title" :description="r.desc" />
                <template #action>
                  <t-tag size="small" variant="light" :theme="r.tone === 'ok' ? 'success' : 'warning'">{{
                    r.hint
                  }}</t-tag>
                </template>
              </t-list-item>
            </t-list>
          </t-card>
          <t-card title="持仓健康度" subtitle="分散度 / 论文 / 纪律">
            <t-space direction="vertical" style="width: 100%">
              <div v-for="row in healthRows" :key="row.label">
                <t-progress :percentage="row.value">
                  <template #label>{{ row.label }} {{ row.value }}</template>
                </t-progress>
              </div>
            </t-space>
            <template #footer>较上次 {{ weekDelta >= 0 ? '+' : '' }}{{ weekDelta }}</template>
          </t-card>
        </t-space>
      </t-col>
    </t-row>
  </t-space>
</template>
<script setup lang="ts">
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import { useInvestStore } from '@/store';
import { allocation, healthNote, healthScore, risks, shortCode, sparkSeries, summarize } from '@/utils/book';

interface Row {
  code: string;
  name: string;
  tag?: string;
  quantity: number;
  cost: number;
  last: number | null;
  changePct: number | null;
  marketValue: number | null;
  pnl: number | null;
  pnlPct: number | null;
  health: string;
  action: string;
  thesisId: string;
}

const props = defineProps<{ title: string; rows: Row[]; cash: number }>();

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

const invest = useInvestStore();
const lineEl = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

const actionMap: Record<string, string> = { hold: '持有', add: '加仓区', reduce: '观察', exit: '止盈线' };
const actionTheme: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  hold: 'success',
  add: 'danger',
  reduce: 'warning',
  exit: 'danger',
};
const actionRank: Record<string, number> = { exit: 0, reduce: 1, add: 2, hold: 3 };

const money = (n: number | null) => (n == null ? '—' : n.toLocaleString('zh-CN', { maximumFractionDigits: 0 }));
const signed = (n: number | null) =>
  n == null ? '—' : `${n >= 0 ? '+' : '-'}${Math.abs(n).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
const pct = (n: number | null) => (n == null ? '—' : `${n > 0 ? '+' : ''}${(n * 100).toFixed(2)}%`);
const pctInt = (n: number | null) => (n == null ? '—' : `${Math.round(n * 100)}%`);
const px = (n: number) => n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const pnlColor = (n: number | null) => {
  if (n == null) return undefined;
  return n >= 0 ? 'var(--td-error-color)' : 'var(--td-success-color)';
};

const stats = computed(() => summarize(props.rows, props.cash));
const alloc = computed(() => allocation(props.rows, props.cash));
const health = computed(() => healthScore(props.rows, invest.theses, invest.journal, props.cash));
const note = computed(() => healthNote(health.value.total, alloc.value.find((a) => a.name !== '现金')?.name));
const series = computed(() => sparkSeries(stats.value.pnlPct ?? 0));
const riskItems = computed(() =>
  risks(
    props.rows,
    invest.theses,
    invest.todos.filter((t) => t.account === (props.title.includes('ETF') ? 'etf' : 'stock')),
  ),
);
const healthRows = computed(() => [
  { label: '分散度', value: health.value.diversify },
  { label: '论文完整度', value: health.value.thesis },
  { label: '交易纪律', value: health.value.discipline },
]);
const weekDelta = ref(0);
watch(
  () => health.value.total,
  (total) => {
    weekDelta.value = invest.touchHealth(props.title.includes('ETF') ? 'etf' : 'stock', total);
  },
  { immediate: true },
);

const sorted = computed(() =>
  [...props.rows].sort((a, b) => (actionRank[a.action] ?? 9) - (actionRank[b.action] ?? 9)),
);

const columns = [
  { colKey: 'name', title: '标的', minWidth: 180 },
  { colKey: 'mv', title: '持仓市值', width: 110, align: 'right' as const },
  { colKey: 'cost', title: '成本价', width: 96, align: 'right' as const },
  { colKey: 'last', title: '现价', width: 96, align: 'right' as const },
  { colKey: 'pnl', title: '浮动盈亏', width: 100, align: 'right' as const },
  { colKey: 'action', title: '动作', width: 88 },
];

function renderLine() {
  if (!lineEl.value) return;
  if (!chart) chart = echarts.init(lineEl.value);
  chart.setOption(
    {
      tooltip: { trigger: 'axis' },
      grid: { left: 48, right: 16, top: 24, bottom: 28 },
      xAxis: { type: 'category', show: false, data: series.value.map((_, i) => i) },
      yAxis: { type: 'value', scale: true, axisLabel: { formatter: '{value}' } },
      series: [{ type: 'line', showSymbol: false, data: series.value, areaStyle: { opacity: 0.12 } }],
    },
    true,
  );
}

onMounted(renderLine);
watch(series, renderLine);
onUnmounted(() => chart?.dispose());
</script>
