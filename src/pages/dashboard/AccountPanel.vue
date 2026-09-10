<template>
  <t-space class="panel" direction="vertical" :size="16" style="width: 100%">
    <t-row :gutter="[12, 12]" class="kpi-row">
      <t-col :xs="6" :sm="6" :xl="3">
        <t-card class="stat-card">
          <t-statistic title="持仓市值" :value="stats.mv ?? 0" :precision="2" :loading="stats.mv == null">
            <template #extra>
              <span :style="{ color: pnlColor(stats.pnl) }">
                {{ signed(stats.pnl) }}<template v-if="stats.pnlPct != null"> · {{ pct(stats.pnlPct) }}</template>
              </span>
            </template>
          </t-statistic>
        </t-card>
      </t-col>
      <t-col :xs="6" :sm="6" :xl="3">
        <t-card class="stat-card">
          <t-statistic title="持仓成本" :value="stats.cost" :precision="2">
            <template #extra>
              仓位 {{ pctInt(stats.pos) }} · 现金 ¥{{ money(props.cash) }}（{{ pctInt(stats.cashPct) }}）
            </template>
          </t-statistic>
        </t-card>
      </t-col>
      <t-col :xs="6" :sm="6" :xl="3">
        <t-card class="stat-card">
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
      <t-col :xs="6" :sm="6" :xl="3">
        <t-card class="stat-card">
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
            <template #actions
              ><span class="card-cap">{{ navCaption }}</span></template
            >
            <div v-if="curve" ref="lineEl" class="nav-line" />
            <div v-else class="nav-line nav-empty">
              <p>净值从今天开始攒。</p>
              <p class="nav-empty-sub">每日收盘自动落一条快照，满两个交易日后这里出现真曲线 —— 不画插值的假线。</p>
            </div>
          </t-card>
          <t-card class="gl-mod holdings-mod" title="持仓与买卖点">
            <template #actions>
              <t-space :size="8" align="center">
                <t-button size="small" theme="primary" variant="outline" @click="invest.openTradeModal({ account })">
                  <template #icon><t-icon name="swap" /></template>
                  模拟下单
                </t-button>
                <span class="card-cap">{{ sorted.length }} 只标的 · 动态建议</span>
              </t-space>
            </template>
            <t-empty v-if="!rows.length" description="还没有持仓" />
            <div v-else class="holdings-module">
              <!-- 移动端轻量快捷筛选 -->
              <div v-if="sorted.length > 1" class="mobile-filter-row">
                <button
                  v-for="f in filterOptions"
                  :key="f.key"
                  type="button"
                  class="m-filter-pill"
                  :class="{ 'is-active': currentFilter === f.key }"
                  @click="currentFilter = f.key"
                >
                  <span>{{ f.label }}</span>
                  <span class="pill-count">{{ f.count }}</span>
                </button>
              </div>

              <!-- 桌面端表格 (>= 768px) -->
              <div class="desktop-table-wrap">
                <t-table :data="sorted" :columns="columns" row-key="code" size="small">
                  <template #name="{ row }">
                    <div class="dual-cell">
                      <div class="dual-cell__main">{{ row.name }}</div>
                      <div class="dual-cell__sub tabular-nums">{{ money(row.marketValue) }}</div>
                    </div>
                  </template>
                  <template #qty="{ row }">
                    <div class="dual-cell dual-cell--right">
                      <div class="dual-cell__main tabular-nums">{{ row.quantity.toLocaleString() }}</div>
                      <div class="dual-cell__sub tabular-nums">{{ row.quantity.toLocaleString() }}</div>
                    </div>
                  </template>
                  <template #px="{ row }">
                    <div class="dual-cell dual-cell--right">
                      <div class="dual-cell__main tabular-nums">{{ row.last == null ? '—' : px(row.last) }}</div>
                      <div class="dual-cell__sub tabular-nums">{{ px(row.cost) }}</div>
                    </div>
                  </template>
                  <template #pnl="{ row }">
                    <div class="dual-cell dual-cell--right tabular-nums" :style="{ color: pnlColor(row.pnl) }">
                      <div class="dual-cell__main">{{ signed(row.pnl) }}</div>
                      <div class="dual-cell__sub">{{ pct(row.pnlPct) }}</div>
                    </div>
                  </template>
                  <template #dayPnl="{ row }">
                    <div
                      v-if="row.dayPnl != null"
                      class="dual-cell dual-cell--right tabular-nums"
                      :style="{ color: pnlColor(row.dayPnl) }"
                    >
                      <div class="dual-cell__main">{{ signed(row.dayPnl) }}</div>
                      <div class="dual-cell__sub">
                        {{ row.dayPnlPct >= 0 ? '+' : '' }}{{ Number(row.dayPnlPct).toFixed(2) }}%
                      </div>
                    </div>
                    <span v-else class="muted">—</span>
                  </template>
                  <template #weight="{ row }">{{ calcWeight(row.marketValue) }}</template>
                  <template #code="{ row }">
                    <span class="code-mono">{{ shortCode(row.code) }}</span>
                  </template>
                </t-table>
              </div>

              <!-- 移动端原生金融卡片流 (<= 767px) -->
              <div class="mobile-cards-stream">
                <div
                  v-for="row in displayedRows"
                  :key="row.code"
                  class="m-pos-card"
                  :class="`border-act-${row.action}`"
                  @click="emit('edit')"
                >
                  <!-- 顶部标的信息与买卖点动作 -->
                  <div class="m-pos-header">
                    <div class="m-pos-symbol">
                      <div class="m-symbol-main">
                        <span class="m-stock-name">{{ row.name }}</span>
                        <span class="code-mono">{{ shortCode(row.code) }}</span>
                      </div>
                      <div class="m-symbol-sub">
                        <t-tag v-if="row.tag" size="small" variant="light" class="m-tag">{{ row.tag }}</t-tag>
                        <span class="m-sub-qty">
                          {{ row.quantity.toLocaleString() }} {{ kind === 'etf' ? '份' : '股' }}
                        </span>
                      </div>
                    </div>

                    <!-- 醒目的买卖点动作徽章 -->
                    <div class="m-action-tag" :class="`act-${row.action}`">
                      <span class="act-pulse"></span>
                      <span class="act-name">{{ actionMap[row.action] }}</span>
                    </div>
                  </div>

                  <!-- 核心 3 列金融指标网格 -->
                  <div class="m-pos-grid">
                    <!-- 第 1 列：现价 / 成本 -->
                    <div class="m-grid-col">
                      <span class="col-lbl">现价/成本价</span>
                      <div class="col-val-row">
                        <span class="col-price tabular-nums" :style="{ color: priceChangeColor(row) }">
                          {{ row.last == null ? '—' : px(row.last) }}
                        </span>
                        <span
                          v-if="row.changePct != null"
                          class="col-day-chg tabular-nums"
                          :style="{ color: pnlColor(row.changePct) }"
                        >
                          {{ row.changePct >= 0 ? '+' : '' }}{{ row.changePct.toFixed(2) }}%
                        </span>
                      </div>
                      <span class="col-sub tabular-nums">成本 {{ px(row.cost) }}</span>
                    </div>

                    <!-- 第 2 列：持仓市值 / 占比 -->
                    <div class="m-grid-col text-center">
                      <span class="col-lbl">持仓市值</span>
                      <div class="col-val-row justify-center">
                        <span class="col-mv tabular-nums">{{ money(row.marketValue) }}</span>
                      </div>
                      <span class="col-sub">占比 {{ calcWeight(row.marketValue) }}</span>
                    </div>

                    <!-- 第 3 列：浮动盈亏 -->
                    <div class="m-grid-col text-right">
                      <span class="col-lbl">持仓盈亏</span>
                      <div class="col-val-row justify-end">
                        <span class="col-pnl-pill tabular-nums" :class="pnlClass(row.pnlPct)">
                          {{ pct(row.pnlPct) }}
                        </span>
                      </div>
                      <span class="col-sub tabular-nums" :style="{ color: pnlColor(row.pnl) }">
                        {{ signed(row.pnl) }}
                      </span>
                    </div>
                  </div>

                  <!-- 买卖点建议 / 纪律风控提示条 -->
                  <div v-if="alertMap[row.code]" class="m-alert-box" :class="`lvl-${alertMap[row.code].level}`">
                    <t-icon name="error-circle-filled" size="14px" class="box-icon" />
                    <div class="box-text">
                      <span class="box-title">{{ alertMap[row.code].title }}:</span>
                      <span class="box-desc">{{ alertMap[row.code].detail }}</span>
                    </div>
                  </div>
                  <div v-else-if="row.action !== 'hold'" class="m-guide-box" :class="`guide-${row.action}`">
                    <t-icon
                      :name="row.action === 'add' ? 'add-circle-filled' : 'info-circle-filled'"
                      size="14px"
                      class="box-icon"
                    />
                    <span class="box-desc">{{ getActionGuide(row) }}</span>
                  </div>

                  <div v-if="row.dayPnl != null" class="m-pos-footer">
                    <div class="m-day-pnl">
                      <span class="m-day-lbl">今日盈亏</span>
                      <span class="m-day-val tabular-nums" :style="{ color: pnlColor(row.dayPnl) }">
                        {{ signed(row.dayPnl) }} ({{ (row.dayPnlPct ?? 0) >= 0 ? '+' : ''
                        }}{{ Number(row.dayPnlPct ?? 0).toFixed(2) }}%)
                      </span>
                    </div>
                  </div>
                </div>

                <!-- 筛选空状态 -->
                <div v-if="!displayedRows.length" class="m-filter-empty">
                  <span>该分类下暂无标的</span>
                </div>
              </div>
            </div>
          </t-card>
        </t-space>
      </t-col>
      <t-col :xs="12" :xl="4">
        <t-space direction="vertical" :size="16" style="width: 100%">
          <t-card class="gl-mod" title="资产配置">
            <template #actions>
              <t-link v-if="drillL1" hover="color" @click="drillL1 = null">返回一级</t-link>
              <span v-else class="card-cap">目标 / 当前</span>
            </template>
            <t-empty v-if="!alloc.length" description="还没有市值" />
            <div v-else class="alloc">
              <div class="donut" :style="{ background: donutBg }" role="img" :aria-label="donutLabel">
                <div class="donut-hole">
                  <b>{{ donutPct }}%</b>
                  <span>{{ drillL1 || '已投资' }}</span>
                </div>
              </div>
              <div class="legend">
                <div
                  v-for="a in allocView"
                  :key="a.name"
                  class="leg-row"
                  :class="{ clickable: canDrill(a.name) }"
                  @click="onAllocClick(a.name)"
                >
                  <span class="dot" :style="{ background: a.color }" />
                  <span class="leg-name">{{ a.name }}</span>
                  <span v-if="hasTarget && !drillL1" class="leg-num muted">{{
                    a.target == null ? '—' : pctInt(a.target)
                  }}</span>
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
          <t-card title="持仓健康度" subtitle="分散度 / 论点 / 纪律">
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
import type { AccountId } from '@/types/invest';
import { allocation, healthNote, healthScore, risks, shortCode, summarize } from '@/utils/book';
import { navCurveFor } from '@/utils/nav-history';
import type { SwClass } from '@/utils/sw-industry';
import { fetchSwClass, swGroupOf } from '@/utils/sw-industry';

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
  dayPnl?: number | null;
  dayPnlPct?: number | null;
  health: string;
  action: string;
  thesisId: string;
}

const props = defineProps<{ account: AccountId; title: string; rows: Row[]; cash: number }>();
const emit = defineEmits<{ (e: 'edit'): void }>();

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

const invest = useInvestStore();
const lineEl = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

const actionMap: Record<string, string> = { hold: '持有', add: '加仓区', reduce: '观察', exit: '止盈线' };
const actionRank: Record<string, number> = { exit: 0, reduce: 1, add: 2, hold: 3 };
const ALLOC_COLORS = ['#0d706d', '#dfb56d', '#3569bb', '#16815f'];
const CASH_COLOR = '#b7c0c5';
const riskIcon = { warn: 'error-triangle-filled', info: 'calendar-filled', ok: 'secured-filled' };
function cssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

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

const account = computed(() => props.account);
// 单位、行业口径这些行为看性质，不看账户叫什么 —— 见 utils/accounts.ts
const kind = computed(() => invest.accountKind(account.value));
/** 真净值曲线：首个记录日 = 1。不足两个点时为 null，界面如实说还在攒。 */
const curve = computed(() => navCurveFor(invest.navSnapshots, account.value));
const navCaption = computed(() =>
  curve.value ? `单位净值 · 自 ${curve.value.baseDate} 起（${curve.value.ys.length} 个交易日）` : '单位净值 · 待累计',
);
const targets = computed(() => planTargets.filter((t) => t.account === account.value));
const stats = computed(() => summarize(props.rows, props.cash));
const swMap = ref<Record<string, SwClass>>({});
const drillL1 = ref<string | null>(null);
async function loadSw() {
  if (kind.value !== 'stock') return;
  const codes = props.rows.map((r) => r.code);
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
const alloc = computed(() => {
  if (kind.value === 'etf') return allocation(props.rows, props.cash, targets.value);
  if (drillL1.value) {
    const sub = props.rows.filter((p) => swGroupOf(p, swMap.value, 'l1') === drillL1.value);
    return allocation(sub, 0, [], (p) => swGroupOf(p, swMap.value, 'l2'));
  }
  return allocation(props.rows, props.cash, targets.value, (p) => swGroupOf(p, swMap.value, 'l1'));
});
const hasTarget = computed(() => !drillL1.value && alloc.value.some((a) => a.target != null));
const investedPct = computed(() => Math.round((stats.value.pos ?? 0) * 100));
const parentShare = computed(() => {
  if (!drillL1.value) return stats.value.pos ?? 0;
  const full = allocation(props.rows, props.cash, [], (p) => swGroupOf(p, swMap.value, 'l1'));
  return full.find((a) => a.name === drillL1.value)?.pct ?? 0;
});
const donutPct = computed(() => (drillL1.value ? Math.round(parentShare.value * 100) : investedPct.value));
function canDrill(name: string) {
  return (
    kind.value === 'stock' && !drillL1.value && name !== '现金' && Object.values(swMap.value).some((c) => c.l1 === name)
  );
}
function onAllocClick(name: string) {
  if (canDrill(name)) drillL1.value = name;
}
const donutLabel = computed(() =>
  drillL1.value ? `${drillL1.value} ${donutPct.value}%` : `已投资 ${investedPct.value}%`,
);
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
const series = computed(() => curve.value?.ys ?? []);
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
  { label: '论点完备度', value: health.value.thesis },
  { label: '交易纪律', value: health.value.discipline },
]);
const weekDelta = ref(0);
watch(
  () => health.value.total,
  (total) => {
    weekDelta.value = invest.touchHealth(account.value, total);
  },
  { immediate: true },
);

const sorted = computed(() =>
  [...props.rows].sort((a, b) => (actionRank[a.action] ?? 9) - (actionRank[b.action] ?? 9)),
);

// 买卖点与风控提醒映射
const alertMap = computed(() => {
  const map: Record<string, (typeof invest.activeAlerts)[number]> = {};
  for (const a of invest.activeAlerts) {
    if (a.account === account.value) {
      map[a.code] = a;
    }
  }
  return map;
});

// 组合总市值与标的占比
const totalMarketValue = computed(() => props.rows.reduce((sum, r) => sum + (r.marketValue ?? 0), 0));

function calcWeight(mv: number | null): string {
  if (!mv || !totalMarketValue.value) return '—';
  return `${((mv / totalMarketValue.value) * 100).toFixed(1)}%`;
}

function priceChangeColor(row: Row): string {
  if (row.changePct == null || row.changePct === 0) return 'var(--td-text-color-primary)';
  return row.changePct > 0 ? 'var(--guanlan-gain, #b8433e)' : 'var(--guanlan-loss, #16815f)';
}

function pnlClass(pctVal: number | null): string {
  if (pctVal == null || pctVal === 0) return 'pnl-neutral';
  return pctVal > 0 ? 'pnl-gain' : 'pnl-loss';
}

function getActionGuide(row: Row): string {
  const diff = row.pnlPct != null ? `${(row.pnlPct * 100).toFixed(1)}%` : '';
  if (row.action === 'add') {
    return `标的现处于加仓估值区间${diff ? `（浮动 ${diff}）` : ''}，可按计划分批补仓`;
  }
  if (row.action === 'reduce') {
    return `收益已达 ${diff || '目标位'}，触及观察/减仓区间，建议分批锁定利润`;
  }
  if (row.action === 'exit') {
    return '已触及止盈/止损离场线，建议严格落实交易纪律';
  }
  return '';
}

// 移动端轻量快捷筛选
const currentFilter = ref<'all' | 'action' | 'gain' | 'loss'>('all');
const actionCount = computed(() => sorted.value.filter((r) => r.action !== 'hold' || alertMap.value[r.code]).length);
const gainCount = computed(() => sorted.value.filter((r) => (r.pnl ?? 0) > 0).length);
const lossCount = computed(() => sorted.value.filter((r) => (r.pnl ?? 0) < 0).length);

const filterOptions = computed(() => [
  { key: 'all' as const, label: '全部', count: sorted.value.length },
  ...(actionCount.value > 0 ? [{ key: 'action' as const, label: '需关注', count: actionCount.value }] : []),
  { key: 'gain' as const, label: '盈利', count: gainCount.value },
  { key: 'loss' as const, label: '浮亏', count: lossCount.value },
]);

const displayedRows = computed(() => {
  if (currentFilter.value === 'action') {
    return sorted.value.filter((r) => r.action !== 'hold' || alertMap.value[r.code]);
  }
  if (currentFilter.value === 'gain') {
    return sorted.value.filter((r) => (r.pnl ?? 0) > 0);
  }
  if (currentFilter.value === 'loss') {
    return sorted.value.filter((r) => (r.pnl ?? 0) < 0);
  }
  return sorted.value;
});

const columns = [
  { colKey: 'name', title: '名称/市值', minWidth: 120 },
  { colKey: 'qty', title: '持仓/可用', width: 100, align: 'right' as const },
  { colKey: 'px', title: '现价/成本价', width: 110, align: 'right' as const },
  { colKey: 'pnl', title: '持仓盈亏', width: 110, align: 'right' as const },
  { colKey: 'dayPnl', title: '今日盈亏', width: 105, align: 'right' as const },
  { colKey: 'weight', title: '持仓占比', width: 88, align: 'right' as const },
  { colKey: 'code', title: '证券代码', width: 88 },
];

function renderLine() {
  if (!lineEl.value) return;
  // v-if 切换（无净值 → 有净值）后旧实例挂在一个已经摘掉的 DOM 上，不重建就是白图
  if (chart && chart.getDom() !== lineEl.value) {
    chart.dispose();
    chart = null;
  }
  if (!chart) chart = echarts.init(lineEl.value);
  const ys = series.value;
  if (!ys.length) return;
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
      animation: false,
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
        data: curve.value?.dates ?? [],
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
        axisLabel: { color: axisMuted, fontSize: 12, formatter: (v: number) => v.toFixed(3) },
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
onMounted(() => {
  renderLine();
  void loadSw();
});
watch(series, renderLine, { flush: 'post' });
watch(
  () => props.rows.map((r) => r.code).join(','),
  () => void loadSw(),
);
onUnmounted(() => {
  chart?.dispose();
  chart = null;
});
</script>
<style scoped lang="less">
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

.desktop-table-wrap {
  overflow-x: auto;
  max-width: 100%;

  .dual-cell {
    line-height: 1.25;

    &--right {
      text-align: right;
    }

    &__main {
      font-weight: 600;
    }

    &__sub {
      font-size: 11px;
      opacity: 0.85;
    }
  }
}

.mobile-filter-row,
.mobile-cards-stream {
  display: none;
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

/* 还没有两个点时不画图，但高度得占住，否则卡片会跟着数据长高长矮 */
.nav-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
  color: var(--td-text-color-placeholder);
  font-size: 13px;
}

.nav-empty p {
  margin: 0;
}

.nav-empty-sub {
  max-width: 30em;
  font-size: 12px;
  line-height: 1.6;
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

.leg-row.clickable {
  cursor: pointer;
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

.symbol-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.symbol-name {
  font-weight: 500;
  color: var(--td-text-color-primary);
  line-height: 20px;
}

.symbol-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
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

/* 移动端持仓与买卖点卡片流适配 (<= 767px) */
@media (width <= 767px) {
  .desktop-table-wrap {
    display: none !important;
  }

  .stat-card {
    :deep(.t-card__body) {
      padding: 12px 10px;
      overflow: hidden;
    }

    :deep(.t-statistic-title) {
      font-size: 12px;
      margin-bottom: 2px;
    }

    :deep(.t-statistic-content-value) {
      font-size: clamp(15px, 4.4vw, 19px);
      line-height: 24px;
      letter-spacing: -0.02em;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }

    :deep(.t-statistic-content-suffix),
    :deep(.t-statistic-content-unit) {
      font-size: 12px;
    }

    :deep(.t-statistic-extra) {
      font-size: 11px;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-variant-numeric: tabular-nums;
    }
  }

  .mobile-filter-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 12px;
    overflow-x: auto;
    padding-bottom: 2px;
    -webkit-overflow-scrolling: touch;
  }

  .m-filter-pill {
    border: 1px solid var(--guanlan-line, #e6eaed);
    background: var(--td-bg-color-container, #fff);
    border-radius: 14px;
    padding: 3px 10px;
    font-size: 12px;
    color: var(--guanlan-muted, #5e6c76);
    cursor: pointer;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: all 0.15s ease;

    .pill-count {
      font-size: 10px;
      opacity: 0.8;
      font-variant-numeric: tabular-nums;
    }

    &.is-active {
      background: var(--td-brand-color, #0d706d);
      border-color: var(--td-brand-color, #0d706d);
      color: #fff;
      font-weight: 500;
    }
  }

  .mobile-cards-stream {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .m-pos-card {
    background: var(--td-bg-color-container, #fff);
    border: 1px solid var(--guanlan-line, #e6eaed);
    border-radius: 10px;
    padding: 12px 14px;
    transition:
      transform 0.1s ease,
      box-shadow 0.15s ease;
    cursor: pointer;
    user-select: none;

    &:active {
      transform: scale(0.99);
      background: var(--td-bg-color-secondarycontainer, #f7f9fa);
    }

    &.border-act-add {
      border-left: 3px solid var(--guanlan-gain, #b8433e);
    }

    &.border-act-reduce {
      border-left: 3px solid var(--guanlan-warning, #b8782d);
    }

    &.border-act-exit {
      border-left: 3px solid var(--guanlan-gain, #b8433e);
    }

    &.border-act-hold {
      border-left: 3px solid transparent;
    }
  }

  .m-pos-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
  }

  .m-pos-symbol {
    flex: 1;
    min-width: 0;
  }

  .m-symbol-main {
    display: flex;
    align-items: center;
    gap: 6px;
    line-height: 20px;
  }

  .m-stock-name {
    font-size: 15px;
    font-weight: 600;
    color: var(--guanlan-ink, #14212b);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .m-symbol-sub {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
  }

  .m-tag {
    font-size: 11px;
    height: 18px;
    line-height: 18px;
    padding: 0 4px;
  }

  .m-sub-qty {
    font-size: 11px;
    color: var(--td-text-color-placeholder, #8e9ba5);
    font-variant-numeric: tabular-nums;
  }

  .m-action-tag {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    line-height: 18px;

    .act-pulse {
      width: 5px;
      height: 5px;
      border-radius: 50%;
    }

    &.act-add {
      background: rgb(184 67 62 / 8%);
      border: 1px solid rgb(184 67 62 / 25%);
      color: var(--guanlan-gain, #b8433e);

      .act-pulse {
        background: var(--guanlan-gain, #b8433e);
      }
    }

    &.act-reduce {
      background: rgb(184 120 45 / 8%);
      border: 1px solid rgb(184 120 45 / 25%);
      color: var(--guanlan-warning, #b8782d);

      .act-pulse {
        background: var(--guanlan-warning, #b8782d);
      }
    }

    &.act-exit {
      background: rgb(184 67 62 / 12%);
      border: 1px solid rgb(184 67 62 / 35%);
      color: var(--guanlan-gain, #b8433e);

      .act-pulse {
        background: var(--guanlan-gain, #b8433e);
      }
    }

    &.act-hold {
      background: rgb(13 112 109 / 6%);
      border: 1px solid rgb(13 112 109 / 18%);
      color: var(--td-brand-color, #0d706d);

      .act-pulse {
        background: var(--td-brand-color, #0d706d);
      }
    }
  }

  .m-pos-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
    gap: 8px;
    padding: 8px 0;
    border-top: 1px solid var(--guanlan-line, #f0f3f5);
    border-bottom: 1px solid var(--guanlan-line, #f0f3f5);
    margin-bottom: 8px;
  }

  .m-grid-col {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;

    &.text-center {
      text-align: center;
    }

    &.text-right {
      text-align: right;
    }
  }

  .col-lbl {
    font-size: 11px;
    color: var(--td-text-color-secondary, #5e6c76);
    line-height: 16px;
    margin-bottom: 2px;
  }

  .col-val-row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 4px;
    min-width: 0;
    line-height: 20px;

    &.justify-center {
      justify-content: center;
    }

    &.justify-end {
      justify-content: flex-end;
    }
  }

  .col-price,
  .col-mv {
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
    white-space: nowrap;
  }

  .col-mv {
    color: var(--guanlan-ink, #14212b);
  }

  .col-day-chg {
    flex-basis: 100%;
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
  }

  .col-pnl-pill {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 600;
    line-height: 16px;

    &.pnl-gain {
      color: var(--guanlan-gain, #b8433e);
      background: rgb(184 67 62 / 8%);
    }

    &.pnl-loss {
      color: var(--guanlan-loss, #16815f);
      background: rgb(22 129 95 / 8%);
    }

    &.pnl-neutral {
      color: var(--td-text-color-secondary);
      background: var(--td-bg-color-secondarycontainer);
    }
  }

  .col-sub {
    font-size: 11px;
    color: var(--td-text-color-placeholder, #8e9ba5);
    line-height: 16px;
    margin-top: 2px;
  }

  .m-alert-box,
  .m-guide-box {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    line-height: 18px;

    .box-icon {
      flex-shrink: 0;
      margin-top: 2px;
    }

    .box-title {
      font-weight: 600;
      margin-right: 4px;
    }

    .box-desc {
      font-size: 12px;
    }
  }

  .m-alert-box {
    &.lvl-danger {
      background: rgb(184 67 62 / 6%);
      color: var(--guanlan-gain, #b8433e);

      .box-desc {
        color: var(--guanlan-ink, #14212b);
      }
    }

    &.lvl-warning {
      background: rgb(184 120 45 / 8%);
      color: var(--guanlan-warning, #b8782d);

      .box-desc {
        color: var(--guanlan-ink, #14212b);
      }
    }

    &.lvl-info {
      background: rgb(13 112 109 / 6%);
      color: var(--td-brand-color, #0d706d);

      .box-desc {
        color: var(--guanlan-ink, #14212b);
      }
    }
  }

  .m-guide-box {
    &.guide-add {
      background: rgb(184 67 62 / 5%);
      color: var(--guanlan-gain, #b8433e);
    }

    &.guide-reduce {
      background: rgb(184 120 45 / 6%);
      color: var(--guanlan-warning, #b8782d);
    }

    &.guide-exit {
      background: rgb(184 67 62 / 8%);
      color: var(--guanlan-gain, #b8433e);
    }
  }

  .m-pos-footer {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px dashed var(--guanlan-line, #f0f3f5);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;

    .m-day-pnl {
      font-size: 11px;
      color: var(--td-text-color-secondary);
      display: flex;
      gap: 4px;
      align-items: baseline;

      .m-day-val {
        font-weight: 600;
      }
    }
  }

  .m-filter-empty {
    text-align: center;
    padding: 24px 0;
    font-size: 13px;
    color: var(--td-text-color-placeholder, #8e9ba5);
  }
}
</style>
