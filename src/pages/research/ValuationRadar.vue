<template>
  <div>
    <!-- 核心指数估值分位与买卖信号 (Valuation Radar & Signals) -->
    <t-card class="valuation-radar-card" title="估值分位" subtitle="偏低/偏高优先，中性默认收起">
      <template #actions>
        <div class="val-header-actions">
          <t-radio-group v-model="valFilter" variant="default-filled" size="small">
            <t-radio-button value="all">全部 ({{ valList.length }})</t-radio-button>
            <t-radio-button value="broad">大盘宽基</t-radio-button>
            <t-radio-button value="dividend">红利防守</t-radio-button>
            <t-radio-button value="growth">成长科技</t-radio-button>
            <t-radio-button value="sector">申万一级</t-radio-button>
          </t-radio-group>
          <t-radio-group v-model="valViewMode" variant="default-filled" size="small" style="margin-left: 8px">
            <t-radio-button value="rank">分位条</t-radio-button>
            <t-radio-button value="table">明细</t-radio-button>
          </t-radio-group>
          <t-input v-model="valQuery" size="small" clearable placeholder="搜行业 / 指数" class="val-search" />
          <t-button size="small" variant="outline" :loading="valLoading" @click="loadValuations(true)">
            <template #icon><t-icon name="refresh" /></template>
            刷新估值
          </t-button>
        </div>
      </template>

      <!-- 估值分位图例与状态提示条 -->
      <div class="val-legend-strip">
        <div class="legend-items">
          <button
            type="button"
            class="legend-dot"
            :class="{ on: signalFilter === 'low' }"
            @click="signalFilter = 'low'"
          >
            偏低 {{ nLow }}
          </button>
          <button
            type="button"
            class="legend-dot"
            :class="{ on: signalFilter === 'mid' }"
            @click="signalFilter = 'mid'"
          >
            中性 {{ nMid }}
          </button>
          <button
            type="button"
            class="legend-dot"
            :class="{ on: signalFilter === 'high' }"
            @click="signalFilter = 'high'"
          >
            偏高 {{ nHigh }}
          </button>
          <button
            type="button"
            class="legend-dot"
            :class="{ on: signalFilter === 'ends' }"
            @click="signalFilter = 'ends'"
          >
            两端
          </button>
          <button
            type="button"
            class="legend-dot"
            :class="{ on: signalFilter === 'all' }"
            @click="signalFilter = 'all'"
          >
            全部
          </button>
          <button
            v-if="heldCount && valFilter === 'sector'"
            type="button"
            class="legend-dot"
            :class="{ on: signalFilter === 'held' }"
            @click="signalFilter = 'held'"
          >
            持仓 {{ heldCount }}
          </button>
        </div>
        <div class="val-summary-text">按分位从便宜到贵扫</div>
      </div>

      <div v-if="valViewMode === 'rank'" class="val-rank">
        <template v-for="group in rankGroups" :key="group.key">
          <div class="val-rank-hd">{{ group.label }} · {{ group.items.length }}</div>
          <div v-for="item in group.items" :key="item.code" class="val-rank-row" @click="runRowAction(item)">
            <strong class="rk-name">
              {{ item.name }}
              <span
                v-if="heldMap[item.name]"
                class="rk-held"
                :title="`股票仓中 ${item.name} 占 ${heldMap[item.name]}%`"
              >
                持仓 {{ heldMap[item.name] }}%
              </span>
            </strong>
            <span class="rk-pe">{{ Number(item.pe).toFixed(1) }}</span>
            <div class="rk-bar" aria-hidden="true">
              <span
                class="rk-fill"
                :style="{ width: `${Math.max(2, Math.min(100, item.pePercentile))}%`, background: item.color }"
              />
            </div>
            <strong class="rk-pct" :style="{ color: item.color }">{{ item.pePercentile }}%</strong>
            <span class="rk-tag">{{ item.signalLabel }}</span>
            <button type="button" class="rk-action" @click.stop="runRowAction(item)">{{ rowActionLabel(item) }}</button>
          </div>
        </template>
        <div v-if="!rankGroups.length" class="val-rank-empty">这一侧没有标的</div>
      </div>

      <!-- 详细列表视图 -->
      <t-table v-else :data="shownValuations" :columns="valTableColumns" row-key="code" size="small" class="val-table">
        <template #indexInfo="{ row }">
          <div class="table-idx-cell">
            <strong class="idx-name">{{ row.name }}</strong>
            <span class="idx-code">{{ row.code.toUpperCase() }}</span>
            <t-tag size="small" variant="outline" class="idx-cat">{{ row.categoryLabel }}</t-tag>
            <t-tag v-if="heldMap[row.name]" size="small" theme="primary" variant="light" class="idx-held">
              持仓 {{ heldMap[row.name] }}%
            </t-tag>
          </div>
        </template>

        <template #etfInfo="{ row }">
          <div class="table-etf-cell">
            <span class="etf-name">{{ row.etfName || row.description }}</span>
            <span class="etf-code">{{ row.etfCode || '—' }}</span>
          </div>
        </template>

        <template #priceInfo="{ row }">
          <div class="table-price-cell">
            <strong class="idx-price">{{ row.price > 0 ? Number(row.price).toFixed(2) : '—' }}</strong>
            <span class="idx-chg" :class="row.changePct >= 0 ? 'is-up' : 'is-down'">
              {{
                row.changePct >= 0 ? `+${Number(row.changePct).toFixed(2)}%` : `${Number(row.changePct).toFixed(2)}%`
              }}
            </span>
          </div>
        </template>

        <template #peInfo="{ row }">
          <div class="table-pe-cell">
            <span class="pe-val">{{ Number(row.pe).toFixed(2) }}</span>
            <small v-if="!isSwL1(row)" class="pe-sub">10年中位 {{ row.peStats.p50 }}</small>
            <small v-else class="pe-sub">乐咕乐股</small>
          </div>
        </template>

        <template #percentileInfo="{ row }">
          <div class="table-pct-cell">
            <div class="pct-num" :style="{ color: row.color }">{{ row.pePercentile }}%</div>
            <t-progress :percentage="row.pePercentile" :color="row.color" :label="false" size="small" class="pct-bar" />
          </div>
        </template>

        <template #signalInfo="{ row }">
          <t-tag size="small" :theme="row.statusTag" variant="light">
            {{ row.signalLabel }}
          </t-tag>
        </template>

        <template #adviceInfo="{ row }">
          <div class="table-advice-cell">
            <span class="tilt-badge">{{ row.allocationTilt }}</span>
            <span class="advice-desc">{{ row.advice }}</span>
          </div>
        </template>

        <template #op="{ row }">
          <t-space :size="8">
            <t-button v-if="!isSwL1(row)" size="small" variant="text" theme="primary" @click="openValChartModal(row)"
              >走势</t-button
            >
            <t-button size="small" variant="outline" theme="primary" @click="quickAddValuationTodo(row)"
              >+待办</t-button
            >
          </t-space>
        </template>
      </t-table>
    </t-card>

    <!-- 估值走势与通道下钻弹窗 (ECharts) -->
    <t-dialog
      v-model:visible="valChartModalVisible"
      :header="
        selectedValuation
          ? `${selectedValuation.name} (${selectedValuation.code.toUpperCase()}) · 估值走势（示意）`
          : '估值走势（示意）'
      "
      width="740px"
      :footer="false"
      @opened="renderValuationChart"
    >
      <div v-if="selectedValuation" class="val-dialog-body">
        <div class="val-dialog-header-meta">
          <div class="meta-col">
            <span class="m-label">当前最新 PE(TTM)</span>
            <strong class="m-val highlight">{{ selectedValuation.pe }}</strong>
          </div>
          <div class="meta-col">
            <span class="m-label">历史分位数</span>
            <strong class="m-val" :style="{ color: selectedValuation.color }">
              {{ selectedValuation.pePercentile }}% ({{ selectedValuation.signalLabel }})
            </strong>
          </div>
          <div class="meta-col">
            <span class="m-label">20% 机会低估线</span>
            <span class="m-val green">{{ selectedValuation.peStats.p20 }}</span>
          </div>
          <div class="meta-col">
            <span class="m-label">50% 价值中枢</span>
            <span class="m-val">{{ selectedValuation.peStats.p50 }}</span>
          </div>
          <div class="meta-col">
            <span class="m-label">80% 风险警戒线</span>
            <span class="m-val red">{{ selectedValuation.peStats.p80 }}</span>
          </div>
        </div>

        <div class="val-dialog-period-bar">
          <span class="period-title">历史回溯周期：</span>
          <t-radio-group v-model="valChartPeriod" variant="default-filled" size="small" @change="renderValuationChart">
            <t-radio-button :value="3">近3年</t-radio-button>
            <t-radio-button :value="5">近5年</t-radio-button>
            <t-radio-button :value="10">近10年</t-radio-button>
          </t-radio-group>
        </div>

        <div ref="valChartEl" style="height: 340px; width: 100%; margin-top: 12px" />

        <div class="val-dialog-advice-card" :style="{ borderColor: selectedValuation.color }">
          <div class="card-hd">
            <span class="hd-title">🎯 估值诊断与仓位指引</span>
            <t-tag size="small" :theme="selectedValuation.statusTag" variant="light">
              建议偏离 {{ selectedValuation.allocationTilt }}
            </t-tag>
          </div>
          <p class="card-desc">{{ selectedValuation.advice }}</p>
          <div class="card-action-line">
            <span class="action-hint"
              >场内直接映射标的：<strong
                >{{ selectedValuation.etfName }} ({{ selectedValuation.etfCode }})</strong
              ></span
            >
            <t-button size="small" theme="primary" @click="quickAddValuationTodo(selectedValuation)">
              一键生成买卖待办 →
            </t-button>
          </div>
        </div>
      </div>
    </t-dialog>
  </div>
</template>
<script setup lang="ts">
import type { ECharts } from 'echarts/core';
import type { PrimaryTableCol } from 'tdesign-vue-next';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { useInvestStore } from '@/store';
import { allocation } from '@/utils/book';
import { loadEcharts } from '@/utils/load-echarts';
import type { SwClass } from '@/utils/sw-industry';
import { bareCode, fetchSwClass, swGroupOf } from '@/utils/sw-industry';
import { isSwL1 } from '@/utils/sw-valuation';
import type { IndexCategory, IndexValuationItem } from '@/utils/valuation';
import { fetchIndexPeHistory, generateValuationHistorySeries } from '@/utils/valuation';

import { ensureValuations, valuationItems } from './state';
import { todoDialogVisible, todoForm } from './todo';

const VAL_VIEW_KEY = 'invest-valuation-view';
const VIEW_MODES = ['rank', 'table'] as const;
const SIGNAL_MODES = ['ends', 'all', 'low', 'mid', 'high', 'held'] as const;
const CATEGORIES = ['all', 'broad', 'dividend', 'growth', 'sector'] as const;
type SignalMode = (typeof SIGNAL_MODES)[number];

function pick<T extends string>(list: readonly T[], v: unknown, fallback: T): T {
  return list.includes(v as T) ? (v as T) : fallback;
}

function readView() {
  try {
    return JSON.parse(localStorage.getItem(VAL_VIEW_KEY) || '{}') as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}

const saved = readView();
const router = useRouter();
const invest = useInvestStore();
const valLoading = ref(false);
const valList = computed(() => valuationItems.value);
const valFilter = ref<'all' | IndexCategory>(pick(CATEGORIES, saved.filter, 'all'));
const valViewMode = ref<'rank' | 'table'>(pick(VIEW_MODES, saved.view, 'rank'));
const signalFilter = ref<SignalMode>(pick(SIGNAL_MODES, saved.signal, 'ends'));
const valQuery = ref('');
watch(valFilter, (f) => {
  signalFilter.value = f === 'all' || f === 'sector' ? 'ends' : 'all';
});
watch([valFilter, valViewMode, signalFilter], () => {
  localStorage.setItem(
    VAL_VIEW_KEY,
    JSON.stringify({ filter: valFilter.value, view: valViewMode.value, signal: signalFilter.value }),
  );
});

/** 股票仓按申万一级归集，给出各行业在股票市值中的占比。 */
const swMap = ref<Record<string, SwClass>>({});
const stockRows = computed(() => invest.enriched.filter((h) => h.account === 'stock'));
const heldMap = computed<Record<string, number>>(() => {
  if (!Object.keys(swMap.value).length) return {};
  const rows = stockRows.value.filter((r) => swMap.value[bareCode(r.code)]);
  if (!rows.length) return {};
  const out: Record<string, number> = {};
  for (const a of allocation(rows, 0, [], (p) => swGroupOf(p, swMap.value, 'l1'))) {
    if (a.pct > 0) out[a.name] = Math.round(a.pct * 1000) / 10;
  }
  return out;
});
const heldCount = computed(() => Object.keys(heldMap.value).length);

async function loadHeldIndustries() {
  const codes = stockRows.value.map((h) => h.code);
  if (!codes.length) return;
  try {
    swMap.value = await fetchSwClass(codes);
  } catch {
    /* 上游失败则不标持仓，不影响估值展示 */
  }
}

function rowActionLabel(item: IndexValuationItem) {
  if (!isSwL1(item)) return '走势';
  return heldMap.value[item.name] ? '看持仓' : '待办';
}

function runRowAction(item: IndexValuationItem) {
  if (!isSwL1(item)) {
    openValChartModal(item);
    return;
  }
  if (heldMap.value[item.name]) {
    void router.push({ path: '/review/index', query: { l1: item.name } });
    return;
  }
  quickAddValuationTodo(item);
}
const selectedValuation = ref<IndexValuationItem | null>(null);
const valChartModalVisible = ref(false);
const valChartPeriod = ref<number>(3);
const valChartEl = ref<HTMLDivElement | null>(null);
let valChartInstance: ECharts | null = null;

const filteredValuations = computed(() => {
  const q = valQuery.value.trim().toLowerCase();
  const byCat = valFilter.value === 'all' ? valList.value : valList.value.filter((v) => v.category === valFilter.value);
  if (!q) return byCat;
  return byCat.filter((v) => v.name.toLowerCase().includes(q) || v.code.toLowerCase().includes(q));
});

function valBand(p: number): 'low' | 'mid' | 'high' {
  if (p < 40) return 'low';
  if (p > 60) return 'high';
  return 'mid';
}

const nLow = computed(() => filteredValuations.value.filter((v) => valBand(v.pePercentile) === 'low').length);
const nMid = computed(() => filteredValuations.value.filter((v) => valBand(v.pePercentile) === 'mid').length);
const nHigh = computed(() => filteredValuations.value.filter((v) => valBand(v.pePercentile) === 'high').length);

const shownValuations = computed(() => {
  const list = filteredValuations.value;
  if (signalFilter.value === 'all') return list;
  if (signalFilter.value === 'ends') return list.filter((v) => valBand(v.pePercentile) !== 'mid');
  if (signalFilter.value === 'held') return list.filter((v) => heldMap.value[v.name]);
  return list.filter((v) => valBand(v.pePercentile) === signalFilter.value);
});

const rankGroups = computed(() => {
  const low = shownValuations.value
    .filter((v) => valBand(v.pePercentile) === 'low')
    .sort((a, b) => a.pePercentile - b.pePercentile);
  const high = shownValuations.value
    .filter((v) => valBand(v.pePercentile) === 'high')
    .sort((a, b) => b.pePercentile - a.pePercentile);
  const mid = shownValuations.value
    .filter((v) => valBand(v.pePercentile) === 'mid')
    .sort((a, b) => a.pePercentile - b.pePercentile);
  const groups: { key: string; label: string; items: IndexValuationItem[] }[] = [];
  if (low.length) groups.push({ key: 'low', label: '偏低', items: low });
  if (high.length) groups.push({ key: 'high', label: '偏高', items: high });
  if (mid.length) groups.push({ key: 'mid', label: '中性', items: mid });
  return groups;
});

const valTableColumns: PrimaryTableCol[] = [
  { colKey: 'indexInfo', title: '指数名称 / 类别', width: 170 },
  { colKey: 'etfInfo', title: '对应场内标的', width: 150 },
  { colKey: 'priceInfo', title: '最新点位 / 涨跌', width: 130 },
  { colKey: 'peInfo', title: 'PE (TTM)', width: 120 },
  { colKey: 'percentileInfo', title: '历史估值分位', width: 160 },
  { colKey: 'signalInfo', title: '分位', width: 80 },
  { colKey: 'adviceInfo', title: '偏离', minWidth: 160 },
  { colKey: 'op', title: '操作', width: 120, fixed: 'right' },
];

async function loadValuations(force = true) {
  valLoading.value = true;
  try {
    await ensureValuations(force);
  } catch (e) {
    console.error('加载估值数据失败:', e);
  } finally {
    valLoading.value = false;
  }
}

function openValChartModal(item: IndexValuationItem) {
  if (isSwL1(item)) return;
  selectedValuation.value = item;
  valChartModalVisible.value = true;
}

async function renderValuationChart() {
  await nextTick(async () => {
    if (!valChartEl.value || !selectedValuation.value) return;
    const echarts = await loadEcharts();
    if (!valChartInstance) {
      valChartInstance = echarts.init(valChartEl.value);
    }
    const item = selectedValuation.value;
    const real = await fetchIndexPeHistory(item.code, valChartPeriod.value).catch(() => null);
    const seriesData = real ?? generateValuationHistorySeries(item, valChartPeriod.value);
    const sourceNote = real ? '数据源：中证指数有限公司' : '示意序列（非真实历史）';

    valChartInstance.setOption(
      {
        tooltip: {
          trigger: 'axis',
          formatter: (params: any) => {
            const p = params[0];
            return `<div style="font-size:12px;line-height:1.6">
              <strong>${p.name}</strong><br/>
              PE(TTM): <strong>${p.value}</strong><br/>
              ${sourceNote}<br/>
              当前最新: ${item.pe} (${item.pePercentile}%分位)<br/>
              20% 机会线: ${item.peStats.p20}<br/>
              50% 价值中枢: ${item.peStats.p50}<br/>
              80% 警戒线: ${item.peStats.p80}
            </div>`;
          },
        },
        grid: { left: 48, right: 36, top: 28, bottom: 28 },
        xAxis: {
          type: 'category',
          data: seriesData.dates,
          axisLine: { lineStyle: { color: '#dcdcdc' } },
          axisLabel: { color: '#666', fontSize: 11 },
        },
        yAxis: {
          type: 'value',
          scale: true,
          axisLabel: { formatter: '{value}x', color: '#666', fontSize: 11 },
          splitLine: { lineStyle: { color: '#f0f0f0' } },
        },
        series: [
          {
            name: `${item.name} PE(TTM)`,
            type: 'line',
            data: seriesData.peValues,
            smooth: true,
            symbol: 'none',
            lineStyle: { width: 2.5, color: '#0d706d' },
            markLine: {
              symbol: 'none',
              label: { position: 'end', fontSize: 10 },
              data: [
                {
                  yAxis: item.peStats.p80,
                  lineStyle: { color: '#b8433e', type: 'dashed', width: 1.5 },
                  label: { formatter: '80% 警戒: {c}', color: '#b8433e' },
                },
                {
                  yAxis: item.peStats.p50,
                  lineStyle: { color: '#b8782d', type: 'dashed', width: 1.5 },
                  label: { formatter: '50% 中枢: {c}', color: '#b8782d' },
                },
                {
                  yAxis: item.peStats.p20,
                  lineStyle: { color: '#16815f', type: 'dashed', width: 1.5 },
                  label: { formatter: '20% 机会: {c}', color: '#16815f' },
                },
              ],
            },
            markArea: {
              silent: true,
              data: [
                [
                  { yAxis: item.peStats.min, itemStyle: { color: 'rgba(22, 129, 95, 0.08)' } },
                  { yAxis: item.peStats.p20 },
                ],
                [
                  { yAxis: item.peStats.p80, itemStyle: { color: 'rgba(184, 67, 62, 0.08)' } },
                  { yAxis: item.peStats.max * 1.1 },
                ],
              ],
            },
          },
        ],
      },
      true,
    );
    valChartInstance.resize();
  });
}

function quickAddValuationTodo(item: IndexValuationItem) {
  // 申万一级是指数，不能下单：标的留空由用户填（或选行业 ETF），数量不预设
  const sw = isSwL1(item);
  todoForm.account = 'etf';
  todoForm.code = sw ? '' : item.etfCode;
  todoForm.name = sw ? item.name : item.etfName;
  todoForm.side = item.pePercentile < 50 ? 'buy' : 'sell';
  todoForm.quantity = sw ? 0 : 1000;
  todoForm.reason = sw
    ? `【行业估值】${item.name} PE=${item.pe}（${item.pePercentile}%分位，${item.signalLabel}）· 标的待填（可用行业 ETF）`
    : `【估值分位】${item.name} PE=${item.pe}(${item.pePercentile}%分位，${item.signalLabel})，偏离 ${item.allocationTilt}`;
  todoDialogVisible.value = true;
}

function onResize() {
  valChartInstance?.resize();
}

onMounted(() => {
  loadValuations(false);
  void loadHeldIndustries();
  window.addEventListener('resize', onResize);
});

watch(
  () => invest.holdings.length,
  () => void loadHeldIndustries(),
);

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  valChartInstance?.dispose();
});
</script>
