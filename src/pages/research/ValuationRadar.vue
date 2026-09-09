<template>
  <div>
    <!-- 核心指数估值分位与买卖信号 (Valuation Radar & Signals) -->
    <t-card
      class="valuation-radar-card"
      title="A股核心指数估值分位与买卖信号"
      subtitle="实时追踪核心宽基与行业 PE/PB 历史百分位与估值温度计，以安全边际与击球点指引仓位动态增减"
    >
      <template #actions>
        <div class="val-header-actions">
          <t-radio-group v-model="valFilter" variant="default-filled" size="small">
            <t-radio-button value="all">全部 ({{ valList.length }})</t-radio-button>
            <t-radio-button value="broad">大盘宽基</t-radio-button>
            <t-radio-button value="dividend">红利防守</t-radio-button>
            <t-radio-button value="growth">成长科技</t-radio-button>
            <t-radio-button value="sector">行业赛道</t-radio-button>
          </t-radio-group>
          <t-radio-group v-model="valViewMode" variant="default-filled" size="small" style="margin-left: 8px">
            <t-radio-button value="cards">卡片视图</t-radio-button>
            <t-radio-button value="table">详细列表</t-radio-button>
          </t-radio-group>
          <t-button
            size="small"
            variant="outline"
            :loading="valLoading"
            style="margin-left: 8px"
            @click="loadValuations"
          >
            <template #icon><t-icon name="refresh" /></template>
            刷新估值
          </t-button>
        </div>
      </template>

      <!-- 估值分位图例与状态提示条 -->
      <div class="val-legend-strip">
        <div class="legend-items">
          <span class="legend-dot green">🟢 &lt;20% 极度低估 (强力买入)</span>
          <span class="legend-dot teal">🟢 20%~40% 合理偏低 (积极加仓)</span>
          <span class="legend-dot yellow">🟡 40%~60% 合理中枢 (中性持有)</span>
          <span class="legend-dot orange">🟠 60%~80% 合理偏高 (适度止盈)</span>
          <span class="legend-dot red">🔴 &gt;80% 极度高估 (风险防守)</span>
        </div>
        <div class="val-summary-text">
          <span
            >共跟踪 <strong>{{ valList.length }}</strong> 只核心指数 · 处于低估机会区
            <strong>{{ bargainCount }}</strong> 只</span
          >
        </div>
      </div>

      <!-- 卡片网格视图 -->
      <div v-if="valViewMode === 'cards'" class="val-cards-grid">
        <div
          v-for="item in filteredValuations"
          :key="item.code"
          class="val-card"
          :class="`val-signal-${item.signal.toLowerCase()}`"
          @click="openValChartModal(item)"
        >
          <div class="val-card-header">
            <div class="val-title-box">
              <strong class="val-name">{{ item.name }}</strong>
              <span class="val-code">{{ item.code.toUpperCase() }}</span>
            </div>
            <span
              class="val-signal-badge"
              :style="{ backgroundColor: `${item.color}1a`, color: item.color, borderColor: item.color }"
            >
              {{ item.signalLabel }}
            </span>
          </div>

          <div class="val-data-row">
            <div class="val-price-box">
              <span class="val-price">{{ item.price > 0 ? Number(item.price).toFixed(2) : '—' }}</span>
              <span v-if="item.price > 0" class="val-change" :class="item.changePct >= 0 ? 'is-up' : 'is-down'">
                {{
                  item.changePct >= 0
                    ? `+${Number(item.changePct).toFixed(2)}%`
                    : `${Number(item.changePct).toFixed(2)}%`
                }}
              </span>
              <span v-else class="val-change muted-hint">行情未同步</span>
            </div>
            <div class="val-pe-box">
              <span class="pe-label">PE(TTM)</span>
              <strong class="pe-val">{{ Number(item.pe).toFixed(2) }}</strong>
            </div>
          </div>

          <!-- 分位数刻度条 -->
          <div class="val-gauge-wrapper">
            <div class="gauge-meta">
              <span class="gauge-label">历史分位 (10年)</span>
              <strong class="gauge-pct" :style="{ color: item.color }">{{ item.pePercentile }}%</strong>
            </div>
            <div class="gauge-bar-track">
              <!-- 20% 机会区间 -->
              <div class="gauge-zone zone-opp" style="width: 20%" title="0-20% 机会低估区" />
              <!-- 20-40% 偏低区间 -->
              <div class="gauge-zone zone-low" style="width: 20%" title="20-40% 偏低区" />
              <!-- 40-60% 中枢区间 -->
              <div class="gauge-zone zone-mid" style="width: 20%" title="40-60% 合理中枢" />
              <!-- 60-80% 偏高区间 -->
              <div class="gauge-zone zone-high" style="width: 20%" title="60-80% 偏高区" />
              <!-- 80-100% 高估区间 -->
              <div class="gauge-zone zone-risk" style="width: 20%" title="80-100% 高估危险区" />
              <!-- 光标指示针 -->
              <div
                class="gauge-pointer"
                :style="{ left: `${Math.max(2, Math.min(98, item.pePercentile))}%`, backgroundColor: item.color }"
              />
            </div>
            <div class="gauge-axis-labels">
              <span>0% 极低</span>
              <span>20% 机会</span>
              <span>50% 中位</span>
              <span>80% 警戒</span>
              <span>100% 极高</span>
            </div>
          </div>

          <div class="val-advice-box">
            <span class="advice-title"
              >建议配置偏离: <strong>{{ item.allocationTilt }}</strong></span
            >
            <p class="advice-text">{{ item.advice }}</p>
          </div>

          <div class="val-card-footer" @click.stop>
            <div class="etf-anchor" @click="openValChartModal(item)">
              <span class="etf-tag">标的</span>
              <span class="etf-name">{{ item.etfName }}</span>
              <span class="etf-code">({{ item.etfCode }})</span>
            </div>
            <div class="val-card-btns">
              <t-button size="small" variant="text" theme="primary" @click="openValChartModal(item)"> 走势 → </t-button>
              <t-button size="small" theme="primary" variant="outline" @click="quickAddValuationTodo(item)">
                + 待办
              </t-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 详细列表视图 -->
      <t-table
        v-else
        :data="filteredValuations"
        :columns="valTableColumns"
        row-key="code"
        size="small"
        class="val-table"
      >
        <template #indexInfo="{ row }">
          <div class="table-idx-cell">
            <strong class="idx-name">{{ row.name }}</strong>
            <span class="idx-code">{{ row.code.toUpperCase() }}</span>
            <t-tag size="small" variant="outline" class="idx-cat">{{ row.categoryLabel }}</t-tag>
          </div>
        </template>

        <template #etfInfo="{ row }">
          <div class="table-etf-cell">
            <span class="etf-name">{{ row.etfName }}</span>
            <span class="etf-code">{{ row.etfCode }}</span>
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
            <small class="pe-sub">10年中位 {{ row.peStats.p50 }}</small>
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
            <t-button size="small" variant="text" theme="primary" @click="openValChartModal(row)">走势</t-button>
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
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';

import { loadEcharts } from '@/utils/load-echarts';
import type { IndexCategory, IndexValuationItem } from '@/utils/valuation';
import { fetchIndexPeHistory, fetchIndexValuations, generateValuationHistorySeries } from '@/utils/valuation';

import { bargainCount, valuationItems } from './state';
import { todoDialogVisible, todoForm } from './todo';

const valLoading = ref(false);
const valList = ref<IndexValuationItem[]>([]);
const valFilter = ref<'all' | IndexCategory>('all');
const valViewMode = ref<'cards' | 'table'>('cards');
const selectedValuation = ref<IndexValuationItem | null>(null);
const valChartModalVisible = ref(false);
const valChartPeriod = ref<number>(3);
const valChartEl = ref<HTMLDivElement | null>(null);
let valChartInstance: ECharts | null = null;

const filteredValuations = computed(() => {
  if (valFilter.value === 'all') return valList.value;
  return valList.value.filter((v) => v.category === valFilter.value);
});

const valTableColumns: PrimaryTableCol[] = [
  { colKey: 'indexInfo', title: '指数名称 / 类别', width: 170 },
  { colKey: 'etfInfo', title: '对应场内标的', width: 150 },
  { colKey: 'priceInfo', title: '最新点位 / 涨跌', width: 130 },
  { colKey: 'peInfo', title: 'PE (TTM)', width: 120 },
  { colKey: 'percentileInfo', title: '历史估值分位', width: 160 },
  { colKey: 'signalInfo', title: '估值状态 / 信号', width: 110 },
  { colKey: 'adviceInfo', title: '仓位建议 / 偏离指引', minWidth: 240 },
  { colKey: 'op', title: '操作', width: 120, fixed: 'right' },
];

async function loadValuations() {
  valLoading.value = true;
  try {
    valList.value = await fetchIndexValuations();
    valuationItems.value = valList.value;
    bargainCount.value = valList.value.filter((v) => v.pePercentile < 40).length;
  } catch (e) {
    console.error('加载估值数据失败:', e);
  } finally {
    valLoading.value = false;
  }
}

function openValChartModal(item: IndexValuationItem) {
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
  todoForm.account = 'etf';
  todoForm.code = item.etfCode;
  todoForm.name = item.etfName;
  todoForm.side = item.pePercentile < 50 ? 'buy' : 'sell';
  todoForm.quantity = 1000;
  todoForm.reason = `【估值信号】${item.name} PE=${item.pe}(${item.pePercentile}%分位，${item.signalLabel})，配置偏离建议 ${item.allocationTilt}`;
  todoDialogVisible.value = true;
}

function onResize() {
  valChartInstance?.resize();
}

onMounted(() => {
  loadValuations();
  window.addEventListener('resize', onResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  valChartInstance?.dispose();
});
</script>
