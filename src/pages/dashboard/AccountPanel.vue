<template>
  <section class="invest-card">
    <div class="invest-muted">{{ title }}</div>
    <div class="invest-grid-2" style="margin: 12px 0">
      <div>
        <div class="invest-muted">持仓成本</div>
        <div class="invest-kpi">{{ money(costValue) }}</div>
      </div>
      <div>
        <div class="invest-muted">持仓市值</div>
        <div class="invest-kpi">{{ money(marketValue) }}</div>
      </div>
      <div>
        <div class="invest-muted">浮动盈亏</div>
        <div class="invest-kpi" :class="pnlClass(pnl)">{{ money(pnl) }}</div>
      </div>
    </div>
    <div ref="chartEl" style="height: 160px" />
    <t-table :data="rows" :columns="columns" row-key="code" size="small" stripe>
      <template #name="{ row }">{{ row.name }} {{ row.code }}</template>
      <template #last="{ row }">{{ row.last == null ? '—' : row.last }}</template>
      <template #marketValue="{ row }">{{ money(row.marketValue) }}</template>
      <template #pnl="{ row }">
        <span :class="pnlClass(row.pnl)">{{ money(row.pnl) }}</span>
      </template>
      <template #health="{ row }">{{ healthMap[row.health] }}</template>
      <template #action="{ row }">{{ actionMap[row.action] }}</template>
    </t-table>
  </section>
</template>
<script setup lang="ts">
import { PieChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

const props = defineProps<{ title: string; rows: Row[] }>();

echarts.use([PieChart, TooltipComponent, CanvasRenderer]);

interface Row {
  code: string;
  name: string;
  quantity: number;
  cost: number;
  last: number | null;
  marketValue: number | null;
  pnl: number | null;
  health: string;
  action: string;
}

const chartEl = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

const healthMap: Record<string, string> = { healthy: '健康', watch: '观察', alert: '预警' };
const actionMap: Record<string, string> = { hold: '持有', add: '可加', reduce: '减仓', exit: '退出' };

const money = (n: number | null) => (n == null ? '—' : n.toLocaleString('zh-CN', { maximumFractionDigits: 0 }));
const pnlClass = (n: number | null) => (n == null ? '' : n >= 0 ? 'invest-up' : 'invest-down');

const costValue = computed(() => props.rows.reduce((s, r) => s + r.cost * r.quantity, 0));
const marketValue = computed(() =>
  props.rows.every((r) => r.marketValue == null) ? null : props.rows.reduce((s, r) => s + (r.marketValue ?? 0), 0),
);
const pnl = computed(() => (marketValue.value == null ? null : marketValue.value - costValue.value));

const columns = [
  { colKey: 'name', title: '名称' },
  { colKey: 'quantity', title: '数量' },
  { colKey: 'cost', title: '成本' },
  { colKey: 'last', title: '现价' },
  { colKey: 'marketValue', title: '市值' },
  { colKey: 'pnl', title: '盈亏' },
  { colKey: 'health', title: '健康度' },
  { colKey: 'action', title: '买卖点' },
];

function renderChart() {
  if (!chartEl.value) return;
  if (!chart) chart = echarts.init(chartEl.value);
  chart.setOption({
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        data: props.rows.map((r) => ({
          name: r.name,
          value: r.marketValue ?? r.cost * r.quantity,
        })),
      },
    ],
  });
}

onMounted(renderChart);
watch(() => props.rows, renderChart, { deep: true });
onUnmounted(() => chart?.dispose());
</script>
