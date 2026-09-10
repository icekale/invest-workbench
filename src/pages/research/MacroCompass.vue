<template>
  <div>
    <t-card class="macro-weather-card">
      <div class="macro-weather-header">
        <div class="weather-header-left">
          <span class="weather-title">仓位立场</span>
          <span class="weather-sub">对照账本 · 人工改</span>
        </div>
        <div class="weather-header-right">
          <t-space :size="8" align="center">
            <span class="sub-action-text">{{ invest.macroWeather?.updatedAt || '还没改过' }}</span>
            <t-button size="small" variant="text" theme="primary" @click="openMacroModal">改仓位</t-button>
          </t-space>
        </div>
      </div>

      <div class="macro-weather-bar">
        <div class="weather-col main-cycle">
          <div class="weather-label">一句话</div>
          <div class="weather-val">{{ invest.macroWeather?.cycle || '未写' }}</div>
        </div>
        <div class="weather-col sentiment-badge">
          <div class="weather-label">立场</div>
          <t-tag
            size="small"
            :theme="
              invest.macroWeather?.sentiment === '偏多'
                ? 'danger'
                : invest.macroWeather?.sentiment === '防守'
                  ? 'success'
                  : 'warning'
            "
            variant="light"
          >
            {{ invest.macroWeather?.sentiment }}
          </t-tag>
        </div>
        <div class="weather-col position-guide">
          <div class="weather-label">仓位</div>
          <div class="weather-val pos-text">
            <div>
              股票 现 {{ fmtPct(stockActual) }}
              <template v-if="invest.macroWeather?.suggestedStockPos">
                · 目标 {{ invest.macroWeather.suggestedStockPos }}
              </template>
              <t-tag v-if="stockGap" size="small" variant="light" :theme="stockGap === '超配' ? 'danger' : 'warning'">
                {{ stockGap }}
              </t-tag>
            </div>
            <div>
              ETF 现 {{ fmtPct(etfActual) }}
              <template v-if="invest.macroWeather?.suggestedEtfPos">
                · 目标 {{ invest.macroWeather.suggestedEtfPos }}
              </template>
              <t-tag v-if="etfGap" size="small" variant="light" :theme="etfGap === '超配' ? 'danger' : 'warning'">
                {{ etfGap }}
              </t-tag>
            </div>
          </div>
        </div>
      </div>
    </t-card>

    <t-card title="宏观数据" subtitle="PMI / CPI / GDP 东财，社融央行。点卡片看折线">
      <template #actions>
        <t-space :size="8" align="center">
          <span v-if="macroErrorMsg" class="sync-time-hint" style="color: var(--td-error-color)">
            {{ macroErrorMsg }}
          </span>
          <span v-else-if="macroSyncTime" class="sync-time-hint">已同步: {{ macroSyncTime }}</span>
          <t-button size="small" variant="outline" theme="primary" :loading="macroLoading" @click="refreshMacroData">
            <template #icon><t-icon name="refresh" /></template>
            重新同步
          </t-button>
        </t-space>
      </template>

      <t-row :gutter="[16, 16]">
        <!-- 支柱 1: 经济增长 (PMI) -->
        <t-col :xs="12" :sm="6" :xl="3">
          <div class="edb-pillar-card" @click="openMetricChart('pmi')">
            <div class="pillar-top">
              <span class="pillar-label">经济增长 · 景气度</span>
              <t-tag v-if="!growthPmi" size="small" variant="light">未同步</t-tag>
              <t-tag
                v-else
                size="small"
                :theme="growthPmi.latestValue != null && growthPmi.latestValue >= 50 ? 'danger' : 'warning'"
                variant="light"
              >
                {{ pmiTag(growthPmi.latestValue) }}
              </t-tag>
            </div>
            <div class="pillar-main">
              <span class="pillar-name">{{ growthPmi?.name || '官方制造业PMI' }}</span>
              <div class="pillar-val-row">
                <span class="pillar-val">{{ growthPmi?.latestValue ?? '—' }}</span>
                <span v-if="growthPmi" class="pillar-unit">{{ growthPmi.unit }}</span>
                <span
                  v-if="growthPmi?.change != null"
                  class="pillar-change"
                  :class="growthPmi.change >= 0 ? 'is-up' : 'is-down'"
                >
                  {{ growthPmi.change >= 0 ? '↑' : '↓' }} {{ Math.abs(growthPmi.change) }}
                </span>
              </div>
            </div>
            <div class="pillar-sub">
              <span>{{ growthPmi?.source || '数据未同步' }}</span>
              <span v-if="growthPmi" class="chart-link">趋势图 →</span>
            </div>
          </div>
        </t-col>

        <!-- 支柱 2: 通胀物价 (CPI / PPI) -->
        <t-col :xs="12" :sm="6" :xl="3">
          <div class="edb-pillar-card" @click="openMetricChart('cpi')">
            <div class="pillar-top">
              <span class="pillar-label">物价与利润 · 剪刀差</span>
              <t-tag v-if="!cpiMetric" size="small" variant="light">未同步</t-tag>
              <t-tag v-else size="small" :theme="cpiTheme(cpiMetric.latestValue)" variant="light">
                {{ cpiTag(cpiMetric.latestValue) }}
              </t-tag>
            </div>
            <div class="pillar-main">
              <span class="pillar-name">{{ cpiMetric?.name || 'CPI:当月同比' }}</span>
              <div class="pillar-val-row">
                <span class="pillar-val">{{ cpiMetric?.latestValue ?? '—' }}</span>
                <span v-if="cpiMetric" class="pillar-unit">{{ cpiMetric.unit }}</span>
                <span
                  v-if="cpiMetric?.change != null"
                  class="pillar-change"
                  :class="cpiMetric.change >= 0 ? 'is-up' : 'is-down'"
                >
                  {{ cpiMetric.change >= 0 ? '↑' : '↓' }} {{ Math.abs(cpiMetric.change) }}
                </span>
              </div>
            </div>
            <div class="pillar-sub">
              <span>{{ cpiSub(cpiMetric, ppiMetric) }}</span>
              <span v-if="cpiMetric" class="chart-link">趋势图 →</span>
            </div>
          </div>
        </t-col>

        <!-- 支柱 3: 经济总量 (GDP) -->
        <t-col :xs="12" :sm="6" :xl="3">
          <div class="edb-pillar-card" @click="openMetricChart('gdp')">
            <div class="pillar-top">
              <span class="pillar-label">经济总量 · 增长动能</span>
              <t-tag v-if="!gdpMetric" size="small" variant="light">未同步</t-tag>
              <t-tag
                v-else
                size="small"
                :theme="(gdpMetric.latestValue ?? 0) >= 5 ? 'success' : 'warning'"
                variant="light"
              >
                {{ gdpTag(gdpMetric.latestValue) }}
              </t-tag>
            </div>
            <div class="pillar-main">
              <span class="pillar-name">{{ gdpMetric?.name || 'GDP:不变价同比' }}</span>
              <div class="pillar-val-row">
                <span class="pillar-val">{{ gdpMetric?.latestValue ?? '—' }}</span>
                <span v-if="gdpMetric" class="pillar-unit">{{ gdpMetric.unit }}</span>
                <span
                  v-if="gdpMetric?.change != null"
                  class="pillar-change"
                  :class="gdpMetric.change >= 0 ? 'is-up' : 'is-down'"
                >
                  {{ gdpMetric.change >= 0 ? '↑' : '↓' }} {{ Math.abs(gdpMetric.change) }}
                </span>
              </div>
            </div>
            <div class="pillar-sub">
              <span>{{ gdpMetric?.source || '数据未同步' }}</span>
              <span v-if="gdpMetric" class="chart-link">趋势图 →</span>
            </div>
          </div>
        </t-col>

        <!-- 支柱 4: 流动性 · 社融全表 -->
        <t-col :xs="12" :sm="6" :xl="3">
          <div class="edb-pillar-card" @click="openMetricChart('afre')">
            <div class="pillar-top">
              <span class="pillar-label">流动性 · 社融全表</span>
              <t-tag v-if="!afreMetric" size="small" variant="light">未同步</t-tag>
              <t-tag v-else size="small" :theme="(afreMetric.change ?? 0) >= 0 ? 'danger' : 'warning'" variant="light">
                {{ (afreMetric.change ?? 0) >= 0 ? '信用扩张' : '信用回落' }}
              </t-tag>
            </div>
            <div class="pillar-main">
              <span class="pillar-name">{{ afreMetric?.name || '社会融资规模增量' }}</span>
              <div class="pillar-val-row">
                <span class="pillar-val">{{ afreMetric?.latestValue ?? '—' }}</span>
                <span v-if="afreMetric" class="pillar-unit">{{ afreMetric.unit }}</span>
                <span
                  v-if="afreMetric?.change != null"
                  class="pillar-change"
                  :class="afreMetric.change >= 0 ? 'is-up' : 'is-down'"
                >
                  {{ afreMetric.change >= 0 ? '↑' : '↓' }} {{ Math.abs(afreMetric.change) }}
                </span>
              </div>
            </div>
            <div class="pillar-sub">
              <span>{{ afreMetric?.source || '数据未同步' }}</span>
              <span v-if="afreMetric" class="chart-link">趋势图 →</span>
            </div>
          </div>
        </t-col>
      </t-row>

      <div class="afre-table-wrap">
        <div class="afre-caption">
          <t-radio-group v-model="afreTab" variant="default-filled" size="small">
            <t-radio-button value="flow">增量</t-radio-button>
            <t-radio-button value="stock">存量</t-radio-button>
          </t-radio-group>
          <span>{{ afreTab === 'flow' ? '亿元' : '万亿元' }} · 未公布月份已剔除</span>
        </div>
        <p v-if="afreViewError" class="sync-time-hint" style="color: var(--td-error-color)">{{ afreViewError }}</p>
        <table v-else-if="afreViewRows.length" class="afre-table">
          <thead>
            <tr>
              <th>月份</th>
              <th>{{ afreTab === 'flow' ? '社融增量' : '社融存量' }}</th>
              <th v-if="afreTab === 'stock'">同比%</th>
              <th>人民币贷款</th>
              <th>外币贷款</th>
              <th>委托贷款</th>
              <th>信托贷款</th>
              <th>未贴现承兑</th>
              <th>企业债</th>
              <th>政府债</th>
              <th>股票</th>
              <th>ABS</th>
              <th>核销</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in afreViewRows" :key="r.month">
              <td>{{ r.month }}</td>
              <td>{{ fmtAfre(r.afre_total) }}</td>
              <td v-if="afreTab === 'stock'">{{ r.yoy ?? '—' }}</td>
              <td>{{ fmtAfre(r.rmb_loans) }}</td>
              <td>{{ fmtAfre(r.fx_loans) }}</td>
              <td>{{ fmtAfre(r.entrusted_loans) }}</td>
              <td>{{ fmtAfre(r.trust_loans) }}</td>
              <td>{{ fmtAfre(r.undiscounted_bankers_acceptance) }}</td>
              <td>{{ fmtAfre(r.corporate_bonds) }}</td>
              <td>{{ fmtAfre(r.government_bonds) }}</td>
              <td>{{ fmtAfre(r.equity_financing) }}</td>
              <td>{{ fmtAfre(r.abs_by_depository) }}</td>
              <td>{{ fmtAfre(r.loans_written_off) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </t-card>

    <t-dialog
      v-model:visible="chartModalVisible"
      :header="activeMetric ? `${activeMetric.name} · 历史走势` : '指标走势'"
      width="680px"
      :footer="false"
      @opened="renderMetricChart"
    >
      <div v-if="activeMetric" class="metric-dialog-body">
        <div class="dialog-meta-bar">
          <div class="meta-item">
            <span class="meta-label">最新数值</span>
            <strong class="meta-val">{{ activeMetric.latestValue }} {{ activeMetric.unit }}</strong>
          </div>
          <div class="meta-item">
            <span class="meta-label">环比变化</span>
            <span
              class="meta-val"
              :class="activeMetric.change != null && activeMetric.change >= 0 ? 'is-up' : 'is-down'"
            >
              {{
                activeMetric.change != null
                  ? activeMetric.change >= 0
                    ? `+${activeMetric.change}`
                    : activeMetric.change
                  : '—'
              }}
            </span>
          </div>
          <div class="meta-item">
            <span class="meta-label">数据频次</span>
            <span class="meta-val">{{ activeMetric.freq }}频</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">权威来源</span>
            <span class="meta-val">{{ activeMetric.source }}</span>
          </div>
        </div>

        <div ref="metricChartEl" style="height: 320px; width: 100%; margin-top: 16px" />
        <div class="dialog-foot-note">
          <span>* PMI / CPI / PPI / GDP 经东财数据中心；社融为央行公布全表。无数据则留空，不造示意值。</span>
        </div>
      </div>
    </t-dialog>

    <t-dialog
      v-model:visible="macroModalVisible"
      header="改仓位立场"
      :confirm-btn="{ content: '保存', theme: 'primary' }"
      @confirm="submitMacroModal"
    >
      <t-form :data="weatherForm" label-align="left" :label-width="88">
        <t-form-item label="一句话">
          <t-input v-model="weatherForm.cycle" placeholder="如：钱松、别追高" />
        </t-form-item>
        <t-form-item label="立场">
          <t-radio-group v-model="weatherForm.sentiment">
            <t-radio-button value="偏多">偏多</t-radio-button>
            <t-radio-button value="中性">中性</t-radio-button>
            <t-radio-button value="谨慎">谨慎</t-radio-button>
            <t-radio-button value="防守">防守</t-radio-button>
          </t-radio-group>
        </t-form-item>
        <t-form-item label="股票目标">
          <t-input v-model="weatherForm.suggestedStockPos" placeholder="如：60% ~ 70%" />
        </t-form-item>
        <t-form-item label="ETF 目标">
          <t-input v-model="weatherForm.suggestedEtfPos" placeholder="如：75% ~ 85%" />
        </t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>
<script setup lang="ts">
import type { ECharts } from 'echarts/core';
import { MessagePlugin } from 'tdesign-vue-next';
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue';

import { useInvestStore } from '@/store';
import type { AfreRow } from '@/utils/afre';
import { afreToSeries, fetchAfre } from '@/utils/afre';
import { loadEcharts } from '@/utils/load-echarts';
import type { MacroSeries } from '@/utils/macro-cn';
import { fetchMacroBundle, peekMacroBundle } from '@/utils/macro-cn';
import { accountPos, fmtPct, parsePosRange, posStatus } from '@/utils/position';

import { macroState } from './state';

type Stance = '偏多' | '中性' | '谨慎' | '防守';

const invest = useInvestStore();

function mvOf(account: 'stock' | 'etf') {
  return invest.enriched
    .filter((h) => h.account === account)
    .reduce((s, h) => s + (h.marketValue ?? h.cost * h.quantity), 0);
}

function gapLabel(actual: number | null, target: string | undefined) {
  const s = posStatus(actual, parsePosRange(target));
  if (s === 'over') return '超配';
  if (s === 'under') return '低配';
  return '';
}

const stockActual = computed(() => accountPos(mvOf('stock'), invest.cash.stock));
const etfActual = computed(() => accountPos(mvOf('etf'), invest.cash.etf));
const stockGap = computed(() => gapLabel(stockActual.value, invest.macroWeather?.suggestedStockPos));
const etfGap = computed(() => gapLabel(etfActual.value, invest.macroWeather?.suggestedEtfPos));
const macroLoading = ref(false);
const macroSyncTime = ref('');
const macroErrorMsg = ref('');
const growthPmi = ref<MacroSeries | null>(null);
const cpiMetric = ref<MacroSeries | null>(null);
const ppiMetric = ref<MacroSeries | null>(null);
const gdpMetric = ref<MacroSeries | null>(null);
const afreMetric = ref<MacroSeries | null>(null);
const afreRows = ref<AfreRow[]>([]);
const afreStockRows = ref<AfreRow[]>([]);
const afreErrorMsg = ref('');
const afreStockErrorMsg = ref('');
const afreTab = ref<'flow' | 'stock'>('flow');
const afreViewRows = computed(() => (afreTab.value === 'stock' ? afreStockRows.value : afreRows.value));
const afreViewError = computed(() => (afreTab.value === 'stock' ? afreStockErrorMsg.value : afreErrorMsg.value));

const chartModalVisible = ref(false);
const activeMetric = ref<MacroSeries | null>(null);
const metricChartEl = ref<HTMLDivElement | null>(null);
let chartInstance: ECharts | null = null;

const macroModalVisible = ref(false);
const weatherForm = reactive({
  cycle: '',
  sentiment: '中性' as Stance,
  suggestedStockPos: '',
  suggestedEtfPos: '',
});

function openMacroModal() {
  weatherForm.cycle = invest.macroWeather?.cycle || '';
  weatherForm.sentiment = (invest.macroWeather?.sentiment as Stance) || '中性';
  weatherForm.suggestedStockPos = invest.macroWeather?.suggestedStockPos || '60% ~ 70%';
  weatherForm.suggestedEtfPos = invest.macroWeather?.suggestedEtfPos || '75% ~ 85%';
  macroModalVisible.value = true;
}

function submitMacroModal() {
  if (!weatherForm.cycle.trim()) {
    MessagePlugin.warning('写一句仓位理由');
    return;
  }
  invest.updateMacroWeather({
    cycle: weatherForm.cycle.trim(),
    sentiment: weatherForm.sentiment,
    suggestedStockPos: weatherForm.suggestedStockPos,
    suggestedEtfPos: weatherForm.suggestedEtfPos,
    updatedAt: `今日 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 已改`,
  });
  MessagePlugin.success('仓位立场已保存');
  macroModalVisible.value = false;
}

function pmiTag(v: number | null | undefined) {
  return v != null && v >= 50 ? '荣枯线上' : '荣枯线下';
}

function cpiTag(v: number | null | undefined) {
  if (v == null) return '未同步';
  if (v < 0) return '通缩压力';
  if (v < 2) return '低于2%目标';
  return '物价偏热';
}

function cpiTheme(v: number | null | undefined): 'danger' | 'warning' | 'primary' {
  if (v == null || v < 0) return 'warning';
  if (v < 2) return 'primary';
  return 'danger';
}

function gdpTag(v: number | null | undefined) {
  return v != null && v >= 5 ? '达到5%目标' : '低于5%目标';
}

function cpiSub(cpi: MacroSeries | null, ppi: MacroSeries | null) {
  if (cpi?.latestValue != null && ppi?.latestValue != null) {
    const gap = Math.round((cpi.latestValue - ppi.latestValue) * 10) / 10;
    return `PPI ${ppi.latestValue}% · 剪刀差 ${gap}`;
  }
  return cpi?.source || '数据未同步';
}

function fmtAfre(n: number) {
  return n.toLocaleString('zh-CN', {
    maximumFractionDigits: afreTab.value === 'stock' ? 2 : 0,
  });
}

function openMetricChart(type: 'pmi' | 'cpi' | 'ppi' | 'gdp' | 'afre') {
  if (type === 'pmi') {
    activeMetric.value = growthPmi.value;
  } else if (type === 'cpi') {
    activeMetric.value = cpiMetric.value;
  } else if (type === 'ppi') {
    activeMetric.value = ppiMetric.value;
  } else if (type === 'gdp') {
    activeMetric.value = gdpMetric.value;
  } else {
    activeMetric.value = afreMetric.value;
  }
  if (!activeMetric.value) return;
  chartModalVisible.value = true;
}

async function renderMetricChart() {
  await nextTick();
  if (!metricChartEl.value || !activeMetric.value) return;
  const echarts = await loadEcharts();
  if (!chartInstance) chartInstance = echarts.init(metricChartEl.value);
  const dates = activeMetric.value.dates.map((d) => d.slice(0, 7));
  const values = activeMetric.value.values;

  chartInstance.setOption(
    {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const p = params[0];
          return `${p.name}<br/>${activeMetric.value?.name}: <strong>${p.value} ${activeMetric.value?.unit}</strong>`;
        },
      },
      grid: { left: 52, right: 24, top: 24, bottom: 28 },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: '#dcdcdc' } },
        axisLabel: { color: '#666' },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLabel: {
          formatter: `{value}${activeMetric.value.unit}`,
          color: '#666',
        },
        splitLine: { lineStyle: { color: '#f0f0f0' } },
      },
      series: [
        {
          name: activeMetric.value.name,
          type: 'line',
          data: values,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          itemStyle: { color: '#0d706d' },
          lineStyle: { width: 3, color: '#0d706d' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(13, 112, 109, 0.28)' },
              { offset: 1, color: 'rgba(13, 112, 109, 0.02)' },
            ]),
          },
        },
      ],
    },
    true,
  );
  chartInstance.resize();
}

function applyMacroBundle(bundle: {
  pmi: MacroSeries | null;
  cpi: MacroSeries | null;
  ppi: MacroSeries | null;
  gdp: MacroSeries | null;
}) {
  if (bundle.pmi) growthPmi.value = bundle.pmi;
  if (bundle.cpi) cpiMetric.value = bundle.cpi;
  if (bundle.ppi) ppiMetric.value = bundle.ppi;
  if (bundle.gdp) gdpMetric.value = bundle.gdp;
  return [bundle.pmi, bundle.cpi, bundle.ppi, bundle.gdp].filter(Boolean).length;
}

async function fetchAndApplyMacro(force: boolean) {
  try {
    const bundle = await fetchMacroBundle(force);
    const okCount = applyMacroBundle(bundle);
    if (okCount > 0) {
      macroState.value = 'ok';
      macroSyncTime.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      macroErrorMsg.value = okCount < 4 ? '部分指标未同步' : '';
    } else {
      macroState.value = 'error';
      macroErrorMsg.value = '宏观数据未同步';
      macroSyncTime.value = '';
    }
  } catch (e) {
    if (!growthPmi.value && !cpiMetric.value && !ppiMetric.value && !gdpMetric.value) {
      macroState.value = 'error';
      macroErrorMsg.value = e instanceof Error ? e.message : '东财数据中心不可用';
    }
  } finally {
    macroLoading.value = false;
  }
}

async function loadMacroData(force = false) {
  if (!force) {
    const cached = await peekMacroBundle();
    const n = applyMacroBundle(cached);
    if (n > 0) {
      macroState.value = 'ok';
      macroLoading.value = false;
      return;
    }
  }
  macroLoading.value = true;
  macroState.value = 'loading';
  macroErrorMsg.value = '';
  await fetchAndApplyMacro(force);
}

async function loadAfre() {
  afreErrorMsg.value = '';
  afreStockErrorMsg.value = '';
  const [flow, stock] = await Promise.allSettled([fetchAfre('flow'), fetchAfre('stock')]);
  if (flow.status === 'fulfilled') {
    afreRows.value = [...flow.value].sort((a, b) => b.month.localeCompare(a.month));
    afreMetric.value = afreToSeries(flow.value);
  } else {
    afreErrorMsg.value = flow.reason instanceof Error ? flow.reason.message : '社融增量不可用';
  }
  if (stock.status === 'fulfilled') {
    afreStockRows.value = [...stock.value].sort((a, b) => b.month.localeCompare(a.month));
  } else {
    afreStockErrorMsg.value = stock.reason instanceof Error ? stock.reason.message : '社融存量不可用';
  }
}

function refreshMacroData() {
  loadMacroData(true);
  void loadAfre();
}

function onResize() {
  chartInstance?.resize();
}

onMounted(() => {
  loadMacroData();
  void loadAfre();
  window.addEventListener('resize', onResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  chartInstance?.dispose();
});
</script>
