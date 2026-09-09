<template>
  <div>
    <t-card class="macro-weather-card">
      <div class="macro-weather-header">
        <div class="weather-header-left">
          <span class="weather-title">宏观周期罗盘与大类定调</span>
          <span class="weather-sub">基于万得 EDB 宏观数据与货币政策执行报告综合研判</span>
        </div>
        <div class="weather-header-right">
          <t-space :size="8" align="center">
            <span class="sub-action-text">{{ invest.macroWeather?.updatedAt || '每日 08:30 投研定调' }}</span>
            <t-button size="small" variant="text" theme="primary" @click="openMacroModal">
              + 记研判/会议/产业
            </t-button>
          </t-space>
        </div>
      </div>

      <div class="macro-weather-bar">
        <div class="weather-col main-cycle">
          <div class="weather-label">宏观周期定调</div>
          <div class="weather-val">{{ invest.macroWeather?.cycle }}</div>
        </div>
        <div class="weather-col sentiment-badge">
          <div class="weather-label">市场风险偏好</div>
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
          <div class="weather-label">建议基准仓位</div>
          <div class="weather-val pos-text">
            股票 <strong>{{ invest.macroWeather?.suggestedStockPos }}</strong> · ETF
            <strong>{{ invest.macroWeather?.suggestedEtfPos }}</strong>
          </div>
        </div>
      </div>
    </t-card>

    <!-- 万得 EDB 宏观四大支柱量化温度计 -->
    <t-card title="万得 EDB 宏观四大支柱温度计" subtitle="点击任一指标卡片可下钻查看真实历史走势图与分位数">
      <template #actions>
        <t-space :size="8" align="center">
          <span v-if="macroErrorMsg" class="sync-time-hint" style="color: var(--td-error-color)">
            {{ macroErrorMsg }}
          </span>
          <span v-else-if="macroSyncTime" class="sync-time-hint">已同步: {{ macroSyncTime }}</span>
          <t-button size="small" variant="outline" theme="primary" :loading="macroLoading" @click="refreshMacroData">
            <template #icon><t-icon name="refresh" /></template>
            从万得同步
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
                {{ growthPmi.latestValue != null && growthPmi.latestValue >= 50 ? '荣枯线上' : '弱势筑底' }}
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
              <t-tag v-else size="small" theme="primary" variant="light">
                {{ cpiMetric.latestValue != null && cpiMetric.latestValue > 0 ? '温和物价' : '低位磨底' }}
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
              <span>{{
                cpiMetric && ppiMetric
                  ? `PPI ${ppiMetric.latestValue ?? '—'}% · 剪刀差`
                  : cpiMetric?.source || '数据未同步'
              }}</span>
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
              <t-tag v-else size="small" theme="success" variant="light">
                {{ (gdpMetric.latestValue ?? 0) >= 5 ? '总量稳健' : '增速承压' }}
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

        <!-- 支柱 4: 流动性 · 新增人民币贷款（社融主项） -->
        <t-col :xs="12" :sm="6" :xl="3">
          <div class="edb-pillar-card" @click="openMetricChart('loan')">
            <div class="pillar-top">
              <span class="pillar-label">流动性 · 社融主项</span>
              <t-tag v-if="!loanMetric" size="small" variant="light">未同步</t-tag>
              <t-tag
                v-else
                size="small"
                :theme="(loanMetric.latestValue ?? 0) >= 0 ? 'danger' : 'warning'"
                variant="light"
              >
                {{ (loanMetric.latestValue ?? 0) >= 0 ? '信用扩张' : '信贷回落' }}
              </t-tag>
            </div>
            <div class="pillar-main">
              <span class="pillar-name">{{ loanMetric?.name || '新增人民币贷款' }}</span>
              <div class="pillar-val-row">
                <span class="pillar-val">{{ loanMetric?.latestValue ?? '—' }}</span>
                <span v-if="loanMetric" class="pillar-unit">{{ loanMetric.unit }}</span>
                <span
                  v-if="loanMetric?.change != null"
                  class="pillar-change"
                  :class="loanMetric.change >= 0 ? 'is-up' : 'is-down'"
                >
                  {{ loanMetric.change >= 0 ? '↑' : '↓' }} {{ Math.abs(loanMetric.change) }}
                </span>
              </div>
            </div>
            <div class="pillar-sub">
              <span>{{ loanMetric?.source || '数据未同步' }}</span>
              <span v-if="loanMetric" class="chart-link">趋势图 →</span>
            </div>
          </div>
        </t-col>
      </t-row>
    </t-card>

    <!-- 万得指标下钻历史曲线弹窗 (ECharts) -->
    <t-dialog
      v-model:visible="chartModalVisible"
      :header="activeMetric ? `${activeMetric.name} · 历史走势` : '万得指标走势'"
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
          <span
            >* 数据来源于万得 Wind EDB 金融数据库，经 Caddy
            安全反向代理直连取数。接口不可用时展示静态示意，非真实数据。</span
          >
        </div>
      </div>
    </t-dialog>

    <!-- 记研判/会议/产业管理弹窗 -->
    <t-dialog
      v-model:visible="macroModalVisible"
      header="宏观研判与投研管理"
      :confirm-btn="{ content: '保存更新', theme: 'primary' }"
      @confirm="submitMacroModal"
    >
      <t-tabs v-model="macroManageTab" theme="card">
        <t-tab-panel value="weather" label="调宏观天气与仓位" />
        <t-tab-panel value="brief" label="记一条晨会研判" />
      </t-tabs>

      <div v-if="macroManageTab === 'weather'" style="margin-top: 16px">
        <t-form :data="weatherForm" label-align="left" :label-width="100">
          <t-form-item label="宏观周期定调">
            <t-input v-model="weatherForm.cycle" placeholder="如：弱复苏·宽货币·信用温和扩张" />
          </t-form-item>
          <t-form-item label="市场风险偏好">
            <t-radio-group v-model="weatherForm.sentiment">
              <t-radio-button value="偏多">偏多</t-radio-button>
              <t-radio-button value="中性">中性</t-radio-button>
              <t-radio-button value="防守">防守</t-radio-button>
            </t-radio-group>
          </t-form-item>
          <t-form-item label="建议股票仓位">
            <t-input v-model="weatherForm.suggestedStockPos" placeholder="如：60% ~ 70%" />
          </t-form-item>
          <t-form-item label="建议 ETF 仓位">
            <t-input v-model="weatherForm.suggestedEtfPos" placeholder="如：75% ~ 85%" />
          </t-form-item>
        </t-form>
      </div>

      <div v-else-if="macroManageTab === 'brief'" style="margin-top: 16px">
        <t-form :data="briefForm" label-align="left" :label-width="90">
          <t-form-item label="标题">
            <t-input v-model="briefForm.title" placeholder="如：央行二季度货币政策报告定调适度宽松" />
          </t-form-item>
          <t-form-item label="领域分类">
            <t-radio-group v-model="briefForm.topic">
              <t-radio-button value="增长">增长</t-radio-button>
              <t-radio-button value="流动性">流动性</t-radio-button>
              <t-radio-button value="政策">政策</t-radio-button>
              <t-radio-button value="海外">海外</t-radio-button>
            </t-radio-group>
          </t-form-item>
          <t-form-item label="定调倾向">
            <t-radio-group v-model="briefForm.tone">
              <t-radio-button value="利多">利多</t-radio-button>
              <t-radio-button value="中性">中性</t-radio-button>
              <t-radio-button value="警惕">警惕</t-radio-button>
            </t-radio-group>
          </t-form-item>
          <t-form-item label="研判正文">
            <t-textarea v-model="briefForm.body" placeholder="填写核心观点与逻辑..." :rows="3" />
          </t-form-item>
          <t-form-item label="应对策略">
            <t-input v-model="briefForm.actionAdvice" placeholder="如：逢低增配核心宽基底仓" />
          </t-form-item>
        </t-form>
      </div>
    </t-dialog>
  </div>
</template>
<script setup lang="ts">
import type { ECharts } from 'echarts/core';
import { MessagePlugin } from 'tdesign-vue-next';
import { nextTick, onMounted, onUnmounted, reactive, ref } from 'vue';

import { useInvestStore } from '@/store';
import { loadEcharts } from '@/utils/load-echarts';
import type { MacroSeries } from '@/utils/macro-cn';
import { fetchMacroBundle, peekMacroBundle } from '@/utils/macro-cn';

import { macroState } from './state';

type MacroTone = '利多' | '中性' | '警惕' | '待定';
type MacroTopic = '增长' | '流动性' | '政策' | '海外';

const invest = useInvestStore();
const macroLoading = ref(false);
const macroSyncTime = ref('');
const macroErrorMsg = ref('');
const growthPmi = ref<MacroSeries | null>(null);
const cpiMetric = ref<MacroSeries | null>(null);
const ppiMetric = ref<MacroSeries | null>(null);
const gdpMetric = ref<MacroSeries | null>(null);
const loanMetric = ref<MacroSeries | null>(null);

const chartModalVisible = ref(false);
const activeMetric = ref<MacroSeries | null>(null);
const metricChartEl = ref<HTMLDivElement | null>(null);
let chartInstance: ECharts | null = null;

const macroModalVisible = ref(false);
const macroManageTab = ref('weather');
const weatherForm = reactive({
  cycle: '',
  sentiment: '偏多' as '偏多' | '中性' | '防守',
  suggestedStockPos: '',
  suggestedEtfPos: '',
});

const briefForm = reactive({
  title: '',
  topic: '增长' as MacroTopic,
  tone: '利多' as MacroTone,
  body: '',
  actionAdvice: '',
});

function openMacroModal() {
  weatherForm.cycle = invest.macroWeather?.cycle || '';
  weatherForm.sentiment = (invest.macroWeather?.sentiment as any) || '偏多';
  weatherForm.suggestedStockPos = invest.macroWeather?.suggestedStockPos || '60% ~ 70%';
  weatherForm.suggestedEtfPos = invest.macroWeather?.suggestedEtfPos || '75% ~ 85%';
  macroModalVisible.value = true;
}

function submitMacroModal() {
  if (macroManageTab.value === 'weather') {
    if (!weatherForm.cycle.trim()) {
      MessagePlugin.warning('请填写宏观周期定调');
      return;
    }
    invest.updateMacroWeather({
      cycle: weatherForm.cycle.trim(),
      sentiment: weatherForm.sentiment,
      suggestedStockPos: weatherForm.suggestedStockPos,
      suggestedEtfPos: weatherForm.suggestedEtfPos,
      updatedAt: `今日 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 投研定调`,
    });
    MessagePlugin.success('宏观天气与基准仓位已更新');
  } else {
    if (!briefForm.title.trim() || !briefForm.body.trim()) {
      MessagePlugin.warning('请填写研判标题和正文');
      return;
    }
    invest.addMacroBrief({
      title: briefForm.title.trim(),
      time: '今日',
      tone: briefForm.tone,
      topic: briefForm.topic,
      account: 'all',
      body: briefForm.body.trim(),
      actionAdvice: briefForm.actionAdvice.trim() || undefined,
    });
    MessagePlugin.success('已添加一条晨会宏观研判');
  }
  macroModalVisible.value = false;
}

function openMetricChart(type: 'pmi' | 'cpi' | 'ppi' | 'gdp' | 'loan') {
  if (type === 'pmi') {
    activeMetric.value = growthPmi.value;
  } else if (type === 'cpi') {
    activeMetric.value = cpiMetric.value;
  } else if (type === 'ppi') {
    activeMetric.value = ppiMetric.value;
  } else if (type === 'gdp') {
    activeMetric.value = gdpMetric.value;
  } else {
    activeMetric.value = loanMetric.value;
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
  loan?: MacroSeries | null;
}) {
  if (bundle.pmi) growthPmi.value = bundle.pmi;
  if (bundle.cpi) cpiMetric.value = bundle.cpi;
  if (bundle.ppi) ppiMetric.value = bundle.ppi;
  if (bundle.gdp) gdpMetric.value = bundle.gdp;
  if (bundle.loan) loanMetric.value = bundle.loan;
  return [bundle.pmi, bundle.cpi, bundle.ppi, bundle.gdp, bundle.loan].filter(Boolean).length;
}

async function fetchAndApplyMacro(force: boolean) {
  try {
    const bundle = await fetchMacroBundle(force);
    const okCount = applyMacroBundle(bundle);
    if (okCount > 0) {
      macroState.value = 'ok';
      macroSyncTime.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      macroErrorMsg.value = okCount < 5 ? '部分指标未同步' : '';
    } else {
      macroState.value = 'error';
      macroErrorMsg.value = '宏观数据未同步';
      macroSyncTime.value = '';
    }
  } catch (e) {
    if (!growthPmi.value && !cpiMetric.value && !ppiMetric.value && !gdpMetric.value && !loanMetric.value) {
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
      void fetchAndApplyMacro(true);
      return;
    }
  }
  macroLoading.value = true;
  macroState.value = 'loading';
  macroErrorMsg.value = '';
  await fetchAndApplyMacro(force);
}

function refreshMacroData() {
  loadMacroData(true);
}

function onResize() {
  chartInstance?.resize();
}

onMounted(() => {
  loadMacroData();
  window.addEventListener('resize', onResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  chartInstance?.dispose();
});
</script>
