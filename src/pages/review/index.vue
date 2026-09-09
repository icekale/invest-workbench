<template>
  <t-space direction="vertical" :size="16" style="width: 100%">
    <t-row :gutter="[16, 16]">
      <t-col :xs="12" :xl="6">
        <t-card title="股票账户">
          <div class="kpi-num num-hero">{{ money(stock.mv) }}</div>
          <div class="kpi-foot">
            <span class="pnl-span" :style="{ color: pnlColor(stock.pnl) }">
              盈亏 {{ signed(stock.pnl) }}<template v-if="stock.pnlPct != null"> ({{ pct(stock.pnlPct) }})</template>
            </span>
          </div>
          <div class="cash-row">
            <span class="cash-label"
              >现金 <b class="cash-amt">{{ money(invest.cash.stock) }}</b></span
            >
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
        </t-card>
      </t-col>
      <t-col :xs="12" :xl="6">
        <t-card title="ETF 账户">
          <div class="kpi-num num-hero">{{ money(etf.mv) }}</div>
          <div class="kpi-foot">
            <span class="pnl-span" :style="{ color: pnlColor(etf.pnl) }">
              盈亏 {{ signed(etf.pnl) }}<template v-if="etf.pnlPct != null"> ({{ pct(etf.pnlPct) }})</template>
            </span>
          </div>
          <div class="cash-row">
            <span class="cash-label"
              >现金 <b class="cash-amt">{{ money(invest.cash.etf) }}</b></span
            >
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
        </t-card>
      </t-col>
    </t-row>

    <!-- 投资组合全貌 -->
    <t-card title="投资组合持仓">
      <div class="hold-toolbar">
        <t-radio-group v-model="accountView" variant="default-filled" size="small">
          <t-radio-button value="stock">股票账户</t-radio-button>
          <t-radio-button value="etf">ETF 账户</t-radio-button>
        </t-radio-group>
        <t-radio-group v-model="holdView" variant="default-filled" size="small">
          <t-radio-button value="list">明细</t-radio-button>
          <t-radio-button value="weight">行业占比</t-radio-button>
        </t-radio-group>
      </div>
      <t-empty v-if="!activeRows.length" description="暂无持仓数据" />
      <div v-else-if="holdView === 'weight'" class="weight-view">
        <div v-if="drillL1" class="weight-back">
          <t-link hover="color" @click="drillL1 = null">返回一级</t-link>
          <span>{{ drillL1 }}</span>
        </div>
        <div class="weight-body">
          <div ref="pieEl" class="donut-chart" role="img" :aria-label="`${accountLabel}行业占比`" />
          <div class="weight-rows">
            <div
              v-for="a in allocItems"
              :key="a.name"
              class="weight-row"
              :class="{ clickable: canDrill(a.name) }"
              @click="onAllocClick(a.name)"
            >
              <span class="dot" :style="{ background: colorOf(a.name) }" />
              <span class="w-name">{{ a.name }}</span>
              <span class="w-pct">{{ (a.pct * 100).toFixed(1) }}%</span>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="table-wrap">
        <t-table :data="activeRows" :columns="cols" row-key="code" size="small" hover>
          <template #name="{ row }">
            <t-space align="center" :size="8">
              <span class="stock-name">{{ row.name }}</span>
              <t-tag size="small" variant="light">{{ shortCode(row.code) }}</t-tag>
            </t-space>
          </template>
          <template #quantity="{ row }">{{ row.quantity?.toLocaleString('zh-CN') }}</template>
          <template #cost="{ row }">¥{{ row.cost?.toFixed(2) }}</template>
          <template #mv="{ row }">{{ money(row.marketValue) }}</template>
          <template #weight="{ row }">{{ weightOf(row.marketValue) }}</template>
          <template #pnl="{ row }">
            <div class="pnl-cell" :style="{ color: pnlColor(row.pnl) }">
              <span>{{ signed(row.pnl) }}</span>
              <span v-if="row.pnlPct != null" class="pnl-pct">({{ pct(row.pnlPct) }})</span>
            </div>
          </template>
          <template #op="{ row }">
            <t-space :size="4">
              <t-link theme="danger" hover="color" @click="tradeRow(row, 'buy')">买</t-link>
              <t-link theme="success" hover="color" @click="tradeRow(row, 'sell')">卖</t-link>
            </t-space>
          </template>
        </t-table>
      </div>
    </t-card>

    <transaction-ledger :account="accountView" />

    <t-card v-if="invest.todos.length" title="待办">
      <t-table :data="invest.todos" :columns="todoCols" row-key="id" size="small" hover>
        <template #name="{ row }">
          <span class="todo-name">{{ row.name }}</span>
          <span class="todo-code">{{ row.code || '—' }}</span>
        </template>
        <template #side="{ row }">
          <t-tag size="small" :theme="row.side === 'buy' ? 'danger' : 'success'" variant="light">
            {{ row.side === 'buy' ? '买' : '卖' }}
          </t-tag>
        </template>
        <template #quantity="{ row }">{{ Number(row.quantity).toLocaleString() }}</template>
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
            <t-popconfirm content="删除待办？" @confirm="invest.removeTodo(row.id)">
              <t-link theme="danger" hover="color">删除</t-link>
            </t-popconfirm>
          </t-space>
        </template>
      </t-table>
    </t-card>

    <t-card title="三情景目标价">
      <template #actions>
        <span class="card-cap">目标价 = 参考值 × (1+增长率) × 目标倍数；参考值默认 = 现价 ÷ 当前PE/PB</span>
      </template>
      <t-empty v-if="!activeRows.length" description="暂无持仓，无法测算目标价" />
      <div v-else class="scen-wrap">
        <table class="scen-table">
          <thead>
            <tr>
              <th rowspan="2" class="col-name">标的</th>
              <th rowspan="2">参考指标</th>
              <th rowspan="2">参考值</th>
              <th colspan="4" class="hd-bear">保守情景</th>
              <th colspan="4" class="hd-base">基准情景</th>
              <th colspan="4" class="hd-bull">乐观情景</th>
              <th rowspan="2" class="col-note">关键假设与风险</th>
            </tr>
            <tr>
              <th v-for="h in subHeads" :key="h" class="sub-h">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in activeRows" :key="row.code">
              <td class="col-name">
                <div class="scen-name">{{ row.name }}</div>
                <div class="scen-sub">
                  {{ shortCode(row.code) }}
                  <template v-if="row.last != null"> · ¥{{ px(row.last) }}</template>
                </div>
              </td>
              <td class="num-cell">
                <t-select
                  size="small"
                  :value="scenOf(row.code).metric || 'eps'"
                  :options="metricOpts"
                  @change="(v) => setMetric(row.code, String(v))"
                />
              </td>
              <td class="num-cell ref-cell">
                <t-input-number
                  size="small"
                  theme="normal"
                  :decimal-places="2"
                  :step="0.1"
                  :min="0"
                  :value="refOf(row) ?? undefined"
                  @change="(v) => invest.patchPriceScenario(row.code, { ref: Number(v) || null })"
                />
              </td>
              <template v-for="key in scenKeys" :key="key">
                <td class="num-cell" :class="`td-${key}`">
                  <t-input-number
                    size="small"
                    theme="normal"
                    :decimal-places="1"
                    :step="1"
                    :value="scenOf(row.code)[key].growth * 100"
                    suffix="%"
                    @change="(v) => setLeg(row.code, key, 'growth', Number(v) / 100)"
                  />
                </td>
                <td class="num-cell" :class="`td-${key}`">
                  <t-input-number
                    size="small"
                    theme="normal"
                    :decimal-places="2"
                    :step="1"
                    :min="0"
                    :value="scenOf(row.code)[key].multiple"
                    @change="(v) => setLeg(row.code, key, 'multiple', Number(v))"
                  />
                </td>
                <td class="num-cell px" :class="`td-${key}`">{{ targetTxt(targetOf(row, key)) }}</td>
                <td class="num-cell space" :class="`td-${key}`" :style="{ color: pnlColor(upsideOf(row, key)) }">
                  {{ fmtSignedPct(upsideOf(row, key)) }}
                </td>
              </template>
              <td class="col-note">
                <t-input
                  size="small"
                  :value="scenOf(row.code).note"
                  placeholder="估值中枢、核心变量与风险"
                  @change="(v) => invest.patchPriceScenario(row.code, { note: String(v || '') })"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </t-card>
  </t-space>
</template>
<script setup lang="ts">
import { PieChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

import TransactionLedger from '@/pages/plan/components/TransactionLedger.vue';
import { useInvestStore } from '@/store';
import type { PriceScenario, TodoStatus, TradeSide } from '@/types/invest';
import { allocation, summarize } from '@/utils/book';
import { fmtSignedPct, impliedRef, mergeScenario, scenarioTarget, scenarioUpside } from '@/utils/scenario';
import type { SwClass } from '@/utils/sw-industry';
import { fetchSwClass, swGroupOf } from '@/utils/sw-industry';

defineOptions({ name: 'ReviewIndex' });

echarts.use([PieChart, TooltipComponent, CanvasRenderer]);

const invest = useInvestStore();
const accountView = ref<'stock' | 'etf'>('stock');
const holdView = ref<'list' | 'weight'>('list');
const pieEl = ref<HTMLDivElement>();
let pie: echarts.ECharts | null = null;
const scenKeys = ['bear', 'base', 'bull'] as const;
const metricOpts = [
  { label: '隐含EPS', value: 'eps' },
  { label: '隐含BVPS', value: 'bvps' },
];
const subHeads = [
  '增长率',
  '目标倍数',
  '目标价',
  '空间',
  '增长率',
  '目标倍数',
  '目标价',
  '空间',
  '增长率',
  '目标倍数',
  '目标价',
  '空间',
];

const swMap = ref<Record<string, SwClass>>({});
const drillL1 = ref<string | null>(null);

async function loadSw() {
  const codes = invest.holdings.filter((h) => h.account === 'stock').map((h) => h.code);
  if (!codes.length) {
    swMap.value = {};
    return;
  }
  try {
    swMap.value = await fetchSwClass(codes);
  } catch {
    /* 上游失败时仍用 tag */
  }
}

onMounted(() => {
  invest.refreshQuotes();
  void loadSw();
});
watch(
  () =>
    invest.holdings
      .filter((h) => h.account === 'stock')
      .map((h) => h.code)
      .join(','),
  () => void loadSw(),
);
watch(accountView, () => {
  drillL1.value = null;
});

const stock = computed(() => summarize(invest.stockRows, invest.cash.stock));
const etf = computed(() => summarize(invest.etfRows, invest.cash.etf));
const activeRows = computed(() => (accountView.value === 'etf' ? invest.etfRows : invest.stockRows));
const activeCash = computed(() => (accountView.value === 'etf' ? invest.cash.etf : invest.cash.stock));
const bookTotal = computed(() => {
  const mv = activeRows.value.reduce((s, r) => s + (r.marketValue ?? 0), 0);
  return mv + Math.max(0, activeCash.value);
});
const allocItems = computed(() => {
  if (accountView.value === 'etf') return allocation(activeRows.value, activeCash.value);
  if (drillL1.value) {
    const sub = activeRows.value.filter((p) => swGroupOf(p, swMap.value, 'l1') === drillL1.value);
    return allocation(sub, 0, [], (p) => swGroupOf(p, swMap.value, 'l2'));
  }
  return allocation(activeRows.value, activeCash.value, [], (p) => swGroupOf(p, swMap.value, 'l1'));
});
function canDrill(name: string) {
  return (
    accountView.value === 'stock' &&
    !drillL1.value &&
    name !== '现金' &&
    Object.values(swMap.value).some((c) => c.l1 === name)
  );
}
function onAllocClick(name: string) {
  if (canDrill(name)) drillL1.value = name;
}
const accountLabel = computed(() => (accountView.value === 'etf' ? 'ETF 账户' : '股票账户'));

const PALETTE = ['#0d706d', '#3569bb', '#b8782d', '#d05b55', '#16815f', '#7abbb6', '#dfb56d', '#5b7c99'];
function colorOf(name: string) {
  if (name === '现金') return '#93a3ad';
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
function renderPie() {
  if (!pieEl.value) return;
  if (!pie) {
    pie = echarts.init(pieEl.value);
    pie.on('click', (p) => onAllocClick(String(p.name)));
  }
  pie.setOption(
    {
      animation: false,
      tooltip: { trigger: 'item', formatter: '{b} {d}%' },
      series: [
        {
          type: 'pie',
          radius: ['42%', '68%'],
          avoidLabelOverlap: true,
          label: { formatter: '{b}\n{d}%', fontSize: 11, color: '#1f2d3a' },
          labelLine: { length: 8, length2: 6 },
          data: allocItems.value.map((a) => ({
            name: a.name,
            value: Number((a.pct * 100).toFixed(1)),
            itemStyle: { color: colorOf(a.name) },
          })),
        },
      ],
    },
    true,
  );
}
watch(
  [holdView, allocItems],
  async () => {
    if (holdView.value !== 'weight') {
      pie?.dispose();
      pie = null;
      return;
    }
    await nextTick();
    renderPie();
  },
  { deep: true },
);
onUnmounted(() => {
  pie?.dispose();
  pie = null;
});
function weightOf(mv: number | null) {
  if (mv == null || !bookTotal.value) return '—';
  return `${((mv / bookTotal.value) * 100).toFixed(1)}%`;
}

const money = (n: number | null) => (n == null ? '—' : `¥${n.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`);
const targetTxt = (n: number | null) =>
  n == null ? '—' : n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signed = (n: number | null) =>
  n == null ? '—' : `${n >= 0 ? '+' : '-'}¥${Math.abs(n).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
const pct = (n: number | null) => (n == null ? '—' : `${n > 0 ? '+' : ''}${(n * 100).toFixed(2)}%`);
const pnlColor = (n: number | null) => {
  if (n == null || n === 0) return 'var(--guanlan-muted)';
  return n > 0 ? 'var(--guanlan-red)' : 'var(--guanlan-green)';
};
const shortCode = (c: string) => c.replace(/^(sh|sz|bj)/i, '');

const cols = [
  { colKey: 'name', title: '名称 / 代码' },
  { colKey: 'quantity', title: '持仓量', width: 100 },
  { colKey: 'cost', title: '持仓成本', width: 100 },
  { colKey: 'mv', title: '市值', width: 120 },
  { colKey: 'weight', title: '占比', width: 80 },
  { colKey: 'pnl', title: '浮动盈亏' },
  { colKey: 'op', title: '交易', width: 72 },
];
const todoCols = [
  { colKey: 'name', title: '标的' },
  { colKey: 'side', title: '方向', width: 64 },
  { colKey: 'quantity', title: '数量', width: 90 },
  { colKey: 'reason', title: '原因' },
  { colKey: 'status', title: '状态', width: 88 },
  { colKey: 'op', title: '', width: 100 },
];
function scenOf(code: string): PriceScenario {
  return mergeScenario(
    code,
    invest.priceScenarios.find((s) => s.code === code),
  );
}

function setLeg(code: string, key: (typeof scenKeys)[number], field: 'growth' | 'multiple', value: number) {
  invest.patchPriceScenario(code, { [key]: { [field]: Number.isFinite(value) ? value : 0 } });
}

function setMetric(code: string, value: string) {
  invest.patchPriceScenario(code, { metric: value === 'bvps' ? 'bvps' : 'eps', ref: null });
}

function liveMultiple(code: string, metric: 'eps' | 'bvps') {
  const q = invest.quotes[code];
  return (metric === 'bvps' ? q?.pb : q?.pe) ?? null;
}

function refOf(row: { code: string; last: number | null }) {
  const s = scenOf(row.code);
  if (s.ref != null && s.ref > 0) return s.ref;
  return impliedRef(row.last, liveMultiple(row.code, s.metric || 'eps'));
}

function targetOf(row: { code: string; last: number | null }, key: (typeof scenKeys)[number]) {
  const leg = scenOf(row.code)[key];
  return scenarioTarget(refOf(row), leg.growth, leg.multiple);
}

function upsideOf(row: { code: string; last: number | null }, key: (typeof scenKeys)[number]) {
  return scenarioUpside(row.last, targetOf(row, key));
}

function px(n: number) {
  return n < 10 ? n.toFixed(3) : n.toFixed(2);
}

function tradeRow(row: { code: string; name: string; last: number | null; quantity: number }, side: TradeSide) {
  invest.openTradeModal({
    account: accountView.value,
    side,
    code: row.code,
    name: row.name,
    price: row.last || 0,
    quantity: side === 'sell' ? Math.min(100, row.quantity) : 100,
  });
}

function toggleTodo(id: string, status: TodoStatus) {
  invest.setTodoStatus(id, status === 'open' ? 'done' : 'open');
}
</script>
<style scoped>
.table-wrap {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
}

.kpi-num {
  font-size: 24px;
  font-weight: 600;
  color: var(--guanlan-ink);
  line-height: 1.2;
}

.kpi-unit {
  font-size: 14px;
  font-weight: 400;
  color: var(--guanlan-muted);
}

.kpi-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--guanlan-muted);
}

.cash-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  font-size: 13px;
  color: var(--guanlan-muted);
}

.cash-label {
  min-width: 0;
  flex: 1;
}

.cash-amt {
  color: var(--guanlan-ink);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.cash-stepper {
  width: 176px;
  flex: 0 0 176px;
}

.cash-stepper :deep(.t-input__inner) {
  text-overflow: clip;
}

.todo-name {
  font-weight: 600;
  margin-right: 8px;
}

.todo-code {
  font-family: var(--td-font-family-mono);
  font-size: 12px;
  color: var(--td-text-color-secondary, #4f5d67);
}

.dot-split {
  color: var(--guanlan-line);
}

.health-span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.health-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
}

.health-dot--good {
  background: var(--guanlan-green);
}

.health-dot--warn {
  background: var(--guanlan-amber);
}

.health-dot--alert {
  background: var(--guanlan-red);
}

.stock-name {
  font-weight: 500;
  color: var(--guanlan-ink);
}

.pnl-cell {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
  font-variant-numeric: tabular-nums;
}

.pnl-pct {
  font-size: 12px;
  opacity: 0.85;
}

.card-cap {
  font-size: 12px;
  color: var(--guanlan-muted);
}

.hold-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.weight-view {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.weight-back {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--guanlan-muted);
}

.weight-body {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 24px;
}

.donut-chart {
  width: 280px;
  height: 220px;
  flex-shrink: 0;
}

.weight-row.clickable {
  cursor: pointer;
}

.weight-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: max-content;
}

.weight-row {
  display: grid;
  grid-template-columns: 8px auto 48px;
  align-items: center;
  column-gap: 8px;
  font-size: 13px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.w-name {
  color: var(--guanlan-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.w-pct {
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--guanlan-ink);
}

.scen-wrap {
  width: max-content;
  max-width: 100%;
  overflow-x: auto;
}

.scen-table {
  width: auto;
  border-collapse: collapse;
  font-size: 12px;
}

.scen-table th,
.scen-table td {
  border: 1px solid var(--guanlan-line, #e6eaed);
  padding: 6px 8px;
  vertical-align: middle;
}

.scen-table thead th {
  font-weight: 500;
  text-align: center;
  background: #f4f7fa;
}

.hd-bear {
  background: #f7f1e4;
}

.hd-base {
  background: #e8eef6;
}

.hd-bull {
  background: #e7f3ea;
}

.td-bear {
  background: #fbf8f1;
}

.td-base {
  background: #f4f7fb;
}

.td-bull {
  background: #f3f9f4;
}

.scen-table .col-name {
  text-align: left;
  min-width: 120px;
}

.scen-name {
  font-weight: 600;
  color: var(--guanlan-ink);
}

.scen-sub {
  font-size: 11px;
  color: var(--guanlan-muted);
}

.num-cell {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.num-cell.px {
  font-weight: 600;
}

.ref-cell :deep(.t-input-number) {
  color: #2f5bdc;
}

.scen-table :deep(.t-select) {
  width: 112px;
}

.col-note {
  min-width: 180px;
}

.scen-table :deep(.t-input-number) {
  width: 88px;
}
</style>
