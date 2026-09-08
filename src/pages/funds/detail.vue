<template>
  <t-space direction="vertical" :size="16" style="width: 100%">
    <t-button variant="text" theme="primary" @click="router.push('/funds/index')">返回列表</t-button>
    <t-alert v-if="error" theme="error" :message="error" />
    <t-card v-if="fund" :title="fund.name">
      <t-descriptions :column="3">
        <t-descriptions-item label="代码">{{ fund.code }}</t-descriptions-item>
        <t-descriptions-item label="经理">{{ fund.manager }}</t-descriptions-item>
        <t-descriptions-item label="公司">{{ fund.company }}</t-descriptions-item>
        <t-descriptions-item label="类型">{{ fund.type }}</t-descriptions-item>
        <t-descriptions-item label="净值">{{ fund.nav ?? '—' }}</t-descriptions-item>
        <t-descriptions-item label="日涨幅">{{ fmtPct(fund.day) }}</t-descriptions-item>
        <t-descriptions-item label="近三年">{{ fmtPct(fund.year3) }}</t-descriptions-item>
        <t-descriptions-item label="夏普">{{ fund.sharpe ?? '—' }}</t-descriptions-item>
      </t-descriptions>
      <t-row :gutter="16" style="margin-top: 16px">
        <t-col :span="3">
          <t-statistic title="Yield 近1年" :value="fund.year ?? 0" unit="%" :loading="fund.year == null" />
        </t-col>
        <t-col :span="3">
          <t-statistic title="Vix 波动" :value="fund.stddev ?? 0" :loading="fund.stddev == null" />
        </t-col>
        <t-col :span="3">
          <t-statistic
            title="Loss 回撤"
            :value="fund.drawdown == null ? 0 : -fund.drawdown"
            unit="%"
            :loading="fund.drawdown == null"
          />
        </t-col>
        <t-col :span="3">
          <t-statistic title="研选分" :value="score ?? 0" :loading="score == null" />
        </t-col>
      </t-row>
      <t-alert v-if="note" theme="info" :message="note" style="margin-top: 12px" />
      <t-descriptions v-if="sample" :column="4" style="margin-top: 16px" title="拾光全样本">
        <t-descriptions-item label="Yield">{{ sample.yield.toFixed(2) }}%</t-descriptions-item>
        <t-descriptions-item label="Vix">{{ sample.vix.toFixed(2) }}</t-descriptions-item>
        <t-descriptions-item label="Loss">{{ sample.loss.toFixed(2) }}%</t-descriptions-item>
        <t-descriptions-item label="OLS残差">{{ residual == null ? '—' : residual.toFixed(2) }}</t-descriptions-item>
      </t-descriptions>
      <t-alert v-if="sampleNote" theme="info" :message="sampleNote" style="margin-top: 12px" />
      <t-button style="margin-top: 16px" variant="outline" @click="invest.toggleWatch(fund.code)">
        {{ invest.watchlist.includes(fund.code) ? '移出备选池' : '加入备选池' }}
      </t-button>
      <div style="margin-top: 16px">单位净值 · 近1年</div>
      <t-alert v-if="navError" theme="warning" :message="navError" style="margin-top: 8px" />
      <div ref="chartEl" style="height: 280px; margin-top: 8px" />
    </t-card>
    <t-loading v-else-if="!error" text="加载基金..." />
  </t-space>
</template>
<script setup lang="ts">
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useInvestStore } from '@/store';
import type { FundDetail, NavPoint } from '@/utils/fund';
import { fetchFundDetail, fetchFundNav, fetchFundRank, fmtPct, researchScore, riskNote } from '@/utils/fund';
import type { FundModel, SampleFund } from '@/utils/fund-model';
import { loadFundModel, loadSample, lossResidual } from '@/utils/fund-model';

defineOptions({ name: 'FundsDetail' });

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

const route = useRoute();
const router = useRouter();
const invest = useInvestStore();
const fund = ref<FundDetail | null>(null);
const nav = ref<NavPoint[]>([]);
const error = ref('');
const navError = ref('');
const chartEl = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;
const sample = ref<SampleFund | null>(null);
const model = ref<FundModel | null>(null);
const score = computed(() =>
  fund.value ? researchScore(fund.value.year, fund.value.stddev, fund.value.drawdown) : null,
);
const note = computed(() => (fund.value ? riskNote(fund.value.stddev, fund.value.drawdown) : ''));
const residual = computed(() => (sample.value && model.value ? lossResidual(model.value, sample.value) : null));
const sampleNote = computed(() => {
  if (residual.value == null) return '';
  if (residual.value < -1) return '回撤深于 OLS 预测';
  if (residual.value > 1) return '回撤浅于 OLS 预测';
  return '回撤与 OLS 预测接近';
});

function renderChart() {
  if (!chartEl.value) return;
  if (!chart) chart = echarts.init(chartEl.value);
  chart.setOption(
    {
      tooltip: { trigger: 'axis' },
      grid: { left: 48, right: 16, top: 24, bottom: 32 },
      xAxis: { type: 'category', data: nav.value.map((p) => p.date), boundaryGap: false },
      yAxis: { type: 'value', scale: true },
      series: [{ type: 'line', name: '单位净值', showSymbol: false, data: nav.value.map((p) => p.nav) }],
    },
    true,
  );
}

async function load(code: string) {
  fund.value = null;
  nav.value = [];
  sample.value = null;
  error.value = '';
  navError.value = '';
  chart?.dispose();
  chart = null;
  try {
    fund.value = await fetchFundDetail(code);
    // 详情接口不返回日涨幅（RZDF 缺失），从排行缓存补齐
    if (fund.value.day == null) {
      const rank = await fetchFundRank().catch(() => []);
      fund.value.day = rank.find((f) => f.code === code)?.day ?? null;
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '基金详情加载失败';
    return;
  }
  try {
    const all = await loadSample();
    sample.value = all.find((f) => f.code === code) || null;
    if (sample.value) model.value = await loadFundModel();
  } catch {
    sample.value = null;
  }
  try {
    nav.value = await fetchFundNav(code);
    if (!nav.value.length) navError.value = '暂无净值曲线';
  } catch (e) {
    navError.value = e instanceof Error ? e.message : '净值曲线加载失败';
  }
  await nextTick();
  renderChart();
}

onMounted(() => load(String(route.params.code)));
watch(
  () => route.params.code,
  (c) => load(String(c)),
);
onUnmounted(() => chart?.dispose());
</script>
