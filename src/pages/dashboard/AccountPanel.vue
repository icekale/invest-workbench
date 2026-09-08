<template>
  <t-space class="panel" direction="vertical" :size="16" style="width: 100%">
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
          <t-card class="gl-mod" title="组合净值">
            <template #actions><span class="card-cap">单位净值 · 近 30 个交易日</span></template>
            <div ref="lineEl" class="nav-line" />
          </t-card>
          <t-card title="持仓与买卖点">
            <t-empty v-if="!rows.length" description="还没有持仓" />
            <div v-else class="table-wrap">
              <t-table :data="sorted" :columns="columns" row-key="code" size="small">
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
                  <t-tag size="small" variant="light" :theme="actionTheme[row.action]">{{
                    actionMap[row.action]
                  }}</t-tag>
                </template>
              </t-table>
            </div>
          </t-card>
        </t-space>
      </t-col>
      <t-col :xs="12" :xl="4">
        <t-space direction="vertical" :size="16" style="width: 100%">
          <t-card class="gl-mod" title="资产配置">
            <template #actions><span class="card-cap">目标 / 当前</span></template>
            <t-empty v-if="!alloc.length" description="还没有市值" />
            <div v-else class="alloc">
              <div class="donut" :style="{ background: donutBg }" role="img" :aria-label="`已投资 ${investedPct}%`">
                <div class="donut-hole">
                  <b>{{ investedPct }}%</b>
                  <span>已投资</span>
                </div>
              </div>
              <div class="legend">
                <div v-for="a in allocView" :key="a.name" class="leg-row">
                  <span class="dot" :style="{ background: a.color }" />
                  <span class="leg-name">{{ a.name }}</span>
                  <span v-if="hasTarget" class="leg-num muted">{{ a.target == null ? '—' : pctInt(a.target) }}</span>
                  <span class="leg-num">{{ pctInt(a.pct) }}</span>
                </div>
              </div>
            </div>
          </t-card>
          <t-card class="gl-mod" title="风险提示">
            <template #actions><span class="card-cap">需要关注</span></template>
            <div class="risks">
              <div v-for="r in riskItems" :key="r.title" class="risk-row">
                <div class="risk-ico" :class="r.tone">
                  <t-icon :name="riskIcon[r.tone]" size="18px" />
                </div>
                <div class="risk-body">
                  <div class="risk-title">{{ r.title }}</div>
                  <div class="risk-desc">{{ r.desc }}</div>
                </div>
                <div class="risk-side">
                  <div class="risk-hint">{{ r.hint }}</div>
                  <div v-if="r.extra" class="risk-extra">{{ r.extra }}</div>
                </div>
              </div>
            </div>
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
import { useResizeObserver } from '@vueuse/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import { planTargets } from '@/mock/invest';
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
const ALLOC_COLORS = ['#0d706d', '#dfb56d', '#3569bb', '#16815f'];
const CASH_COLOR = '#b7c0c5';
const riskIcon = { warn: 'error-triangle-filled', info: 'calendar-filled', ok: 'secured-filled' };
function cssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function lastWeekdays(n = 30) {
  const out: string[] = [];
  const d = new Date();
  while (out.length < n) {
    const w = d.getDay();
    if (w && w < 6) {
      out.push(`${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`);
    }
    d.setDate(d.getDate() - 1);
  }
  return out.reverse();
}
const navDates = lastWeekdays(30);

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

const account = computed(() => (props.title.includes('ETF') ? 'etf' : 'stock'));
const targets = computed(() => planTargets.filter((t) => t.account === account.value));
const stats = computed(() => summarize(props.rows, props.cash));
const alloc = computed(() => allocation(props.rows, props.cash, targets.value));
const hasTarget = computed(() => alloc.value.some((a) => a.target != null));
const investedPct = computed(() => Math.round((stats.value.pos ?? 0) * 100));
const allocView = computed(() => {
  let colorI = 0;
  return alloc.value.map((a) => ({
    ...a,
    color: a.name === '现金' ? CASH_COLOR : ALLOC_COLORS[colorI++ % ALLOC_COLORS.length],
  }));
});
const donutBg = computed(() => {
  let acc = 0;
  const stops = allocView.value.map((a) => {
    const from = acc * 100;
    acc += a.pct;
    return `${a.color} ${from}% ${acc * 100}%`;
  });
  if (acc < 0.999) stops.push(`var(--td-bg-color-page) ${acc * 100}% 100%`);
  return `conic-gradient(${stops.join(', ')})`;
});
const health = computed(() => healthScore(props.rows, invest.theses, invest.journal, props.cash));
const note = computed(() => healthNote(health.value.total, alloc.value.find((a) => a.name !== '现金')?.name));
const series = computed(() => sparkSeries(stats.value.pnlPct ?? 0));
const riskItems = computed(() =>
  risks(
    props.rows,
    invest.theses,
    invest.todos.filter((t) => t.account === account.value),
    props.cash,
    targets.value,
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
  const ys = series.value;
  const n = ys.length;
  const last = n - 1;
  const narrow = lineEl.value.clientWidth < 520;
  const ticks = new Set([0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), last]);
  const lineGreen = cssVar('--guanlan-accent', '#0d706d');
  const axisMuted = cssVar('--td-text-color-placeholder', '#5e6c76');
  const gridLine = cssVar('--td-component-stroke', '#e6eaed');
  const chartInk = cssVar('--td-text-color-secondary', '#4f5d67');
  const chartDotBorder = cssVar('--td-bg-color-container', '#fff');
  chart.setOption(
    {
      color: [lineGreen],
      tooltip: {
        trigger: 'axis',
        formatter: (ps: { axisValue: string; data: number | { value: number } }[]) => {
          const p = ps[0];
          const v = typeof p.data === 'object' ? p.data.value : p.data;
          return `${p.axisValue}<br/>净值 ${Number(v).toFixed(4)}`;
        },
      },
      grid: { left: 8, right: narrow ? 12 : 56, top: 12, bottom: 8, containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: navDates,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { color: axisMuted, fontSize: 12, interval: (i: number) => ticks.has(i) },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: gridLine } },
        axisLabel: { color: axisMuted, fontSize: 12, formatter: (v: number) => v.toFixed(2) },
      },
      series: [
        {
          type: 'line',
          clip: false,
          showSymbol: true,
          symbol: 'circle',
          lineStyle: { width: 2, color: lineGreen },
          emphasis: { scale: false },
          endLabel: narrow
            ? { show: false }
            : {
                show: true,
                formatter: () => Number(ys[last]).toFixed(4),
                color: chartInk,
                fontSize: 12,
                distance: 8,
              },
          data: ys.map((v, i) => ({
            value: v,
            symbolSize: i === last ? 10 : 0,
            itemStyle: { color: lineGreen, borderColor: chartDotBorder, borderWidth: 2 },
          })),
        },
      ],
    },
    true,
  );
}

useResizeObserver(lineEl, () => renderLine());
onMounted(renderLine);
watch(series, renderLine);
onUnmounted(() => {
  chart?.dispose();
  chart = null;
});
</script>
<style scoped>
.panel {
  max-width: 100%;
  overflow-x: hidden;
}

.panel :deep(.t-col),
.panel :deep(.t-row) {
  min-width: 0;
  max-width: 100%;
}

.table-wrap {
  overflow-x: auto;
  max-width: 100%;
}

.gl-mod :deep(.t-card__header) {
  border-bottom: none;
  gap: 8px;
}

.gl-mod :deep(.t-card__actions) {
  flex-shrink: 0;
}

.card-cap {
  font-size: 12px;
  line-height: 20px;
  color: var(--td-text-color-secondary);
}

.nav-line {
  height: 260px;
}

.alloc {
  display: flex;
  align-items: center;
  gap: 20px;
}

.donut {
  width: 112px;
  height: 112px;
  border-radius: 50%;
  flex-shrink: 0;
  display: grid;
  place-items: center;
}

.donut-hole {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  background: var(--td-bg-color-container, #fff);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.donut-hole b {
  font-size: 24px;
  font-weight: 600;
  line-height: 32px;
  font-variant-numeric: tabular-nums;
  color: var(--td-text-color-primary);
}

.donut-hole span {
  font-size: 12px;
  line-height: 20px;
  color: var(--td-text-color-secondary);
}

.legend {
  flex: 1;
  min-width: 0;
}

.leg-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex-shrink: 0;
}

.leg-name {
  flex: 1;
  font-size: 14px;
  color: var(--td-text-color-primary);
}

.leg-num {
  width: 44px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-size: 14px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.leg-num.muted {
  font-weight: 400;
  color: var(--td-text-color-secondary);
}

.risks {
  display: flex;
  flex-direction: column;
}

.risk-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.risk-ico {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.risk-ico.warn {
  background: var(--td-warning-color-1);
  color: var(--td-warning-color);
}

.risk-ico.info {
  background: var(--td-brand-color-1);
  color: var(--td-brand-color);
}

.risk-ico.ok {
  background: var(--td-success-color-1);
  color: var(--td-success-color);
}

.risk-ico :deep(.t-icon) {
  color: inherit;
}

.risk-body {
  flex: 1;
  min-width: 0;
}

.risk-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  color: var(--td-text-color-primary);
}

.risk-desc {
  font-size: 12px;
  line-height: 20px;
  color: var(--td-text-color-secondary);
}

.risk-side {
  text-align: right;
  flex-shrink: 0;
}

.risk-hint {
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  color: var(--td-text-color-primary);
}

.risk-extra {
  font-size: 12px;
  line-height: 20px;
  color: var(--td-text-color-secondary);
  font-variant-numeric: tabular-nums;
}

@media (width <= 640px) {
  .alloc {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
