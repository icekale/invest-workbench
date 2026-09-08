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
          <t-statistic title="近1年收益率" :value="fund.year ?? 0" unit="%" :loading="detailLoading" />
        </t-col>
        <t-col :span="3">
          <t-statistic title="年化波动率" :value="fund.stddev ?? 0" :loading="detailLoading" />
        </t-col>
        <t-col :span="3">
          <t-statistic
            title="最大回撤"
            :value="fund.drawdown == null ? 0 : -fund.drawdown"
            unit="%"
            :loading="detailLoading"
          />
        </t-col>
        <t-col :span="3">
          <t-statistic title="研选分" :value="score ?? 0" :loading="detailLoading" />
        </t-col>
      </t-row>
      <t-alert v-if="note" theme="info" :message="note" style="margin-top: 12px" />
      <t-descriptions v-if="sample" :column="4" style="margin-top: 16px" title="拾光全样本">
        <t-descriptions-item label="近1年收益">{{ sample.yield.toFixed(2) }}%</t-descriptions-item>
        <t-descriptions-item label="波动率">{{ sample.vix.toFixed(2) }}</t-descriptions-item>
        <t-descriptions-item label="最大回撤">{{ sample.loss.toFixed(2) }}%</t-descriptions-item>
        <t-descriptions-item label="OLS残差">{{ residual == null ? '—' : residual.toFixed(2) }}</t-descriptions-item>
      </t-descriptions>
      <t-alert v-if="sampleNote" theme="info" :message="sampleNote" style="margin-top: 12px" />
      <t-space style="margin-top: 16px" break-line>
        <t-button variant="outline" @click="invest.toggleWatch(fund.code)">
          {{ invest.watchlist.includes(fund.code) ? '移出备选池' : '加入备选池' }}
        </t-button>
        <t-button theme="primary" @click="openTodoDialog">生成买入待办</t-button>
        <t-button theme="default" variant="outline" @click="handleAddToOpportunity">加入研究机会池</t-button>
      </t-space>
      <div style="margin-top: 16px">单位净值 · 近1年</div>
      <t-alert v-if="navError" theme="warning" :message="navError" style="margin-top: 8px" />
      <t-loading :loading="navLoading" text="加载净值曲线...">
        <div ref="chartEl" style="height: 280px; margin-top: 8px" />
      </t-loading>
    </t-card>
    <t-loading v-else-if="!error" text="加载基金..." />

    <!-- 生成买入待办弹窗 -->
    <t-dialog
      v-model:visible="todoDialogVisible"
      header="生成买入待办"
      :confirm-btn="{ content: '确认添加', theme: 'primary' }"
      @confirm="confirmBuyTodo"
    >
      <t-form :data="todoForm" label-align="left" :label-width="80">
        <t-form-item label="标的">
          <span>{{ fund?.name }} ({{ fund?.code }})</span>
        </t-form-item>
        <t-form-item label="归属账户">
          <t-radio-group v-model="todoForm.account">
            <t-radio-button value="etf">ETF 账户</t-radio-button>
            <t-radio-button value="stock">股票账户</t-radio-button>
          </t-radio-group>
        </t-form-item>
        <t-form-item label="拟买份数">
          <t-input-number v-model="todoForm.quantity" :min="100" :step="1000" style="width: 180px" />
        </t-form-item>
        <t-form-item label="决策理由">
          <t-input v-model="todoForm.reason" placeholder="如：拾光研选分高、回撤可控、估值低位" />
        </t-form-item>
      </t-form>
    </t-dialog>
  </t-space>
</template>
<script setup lang="ts">
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { MessagePlugin } from 'tdesign-vue-next';
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useInvestStore } from '@/store';
import type { AccountId } from '@/types/invest';
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
const detailLoading = ref(true);
const nav = ref<NavPoint[]>([]);
const error = ref('');
const navError = ref('');
const navLoading = ref(false);
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

const todoDialogVisible = ref(false);
const todoForm = reactive({
  account: 'etf' as AccountId,
  quantity: 1000,
  reason: '',
});

function openTodoDialog() {
  if (!fund.value) return;
  todoForm.reason = `拾光研选${score.value ?? '—'}分，近1年收益率 ${fund.value.year ?? '—'}%`;
  todoDialogVisible.value = true;
}

function confirmBuyTodo() {
  if (!fund.value) return;
  invest.addTodo({
    account: todoForm.account,
    code: fund.value.code,
    name: fund.value.name,
    side: 'buy',
    quantity: todoForm.quantity,
    reason: todoForm.reason || '拾光研选推荐',
  });
  todoDialogVisible.value = false;
  MessagePlugin.success(`已为【${fund.value.name}】生成买入待办`);
}

function handleAddToOpportunity() {
  if (!fund.value) return;
  const existing = invest.opportunities.find((o) => o.name === fund.value?.name);
  if (existing) {
    MessagePlugin.info('该标的已在研究机会池中');
    return;
  }
  invest.addOpportunity({
    account: 'etf',
    name: fund.value.name,
    thesis: `${fund.value.type} · 拾光研选分 ${score.value ?? '—'} · ${sampleNote.value || '表现优异'}`,
    score: score.value ?? 85,
    note: `${fund.value.company} · 经理 ${fund.value.manager}`,
  });
  MessagePlugin.success(`已将【${fund.value.name}】加入研究机会池`);
}

function onResize() {
  chart?.resize();
}

function renderChart() {
  if (!chartEl.value || !nav.value.length) return;
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
  requestAnimationFrame(() => chart?.resize());
}

async function load(code: string) {
  detailLoading.value = true;
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
  }
  try {
    const all = await loadSample();
    sample.value = all.find((f) => f.code === code) || null;
    if (sample.value) {
      model.value = await loadFundModel();
      if (fund.value) {
        if (fund.value.stddev == null && sample.value.vix != null) fund.value.stddev = sample.value.vix;
        if (fund.value.drawdown == null && sample.value.loss != null) fund.value.drawdown = Math.abs(sample.value.loss);
        if (fund.value.year == null && sample.value.yield != null) fund.value.year = sample.value.yield;
      }
    }
  } catch {
    sample.value = null;
  } finally {
    detailLoading.value = false;
  }
  if (!fund.value) return;
  navLoading.value = true;
  try {
    nav.value = await fetchFundNav(code);
    if (!nav.value.length) navError.value = '暂无净值曲线';
  } catch (e) {
    navError.value = e instanceof Error ? e.message : '净值曲线加载失败';
  } finally {
    navLoading.value = false;
  }
  await nextTick();
  renderChart();
}

onMounted(() => {
  window.addEventListener('resize', onResize);
  load(String(route.params.code));
});
watch(
  () => route.params.code,
  (c) => load(String(c)),
);
onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  chart?.dispose();
});
</script>
