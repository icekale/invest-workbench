<template>
  <t-space direction="vertical" :size="16" style="width: 100%">
    <funds-nav />
    <t-alert v-if="error" theme="warning" :message="error" />

    <template v-if="step === 'form'">
      <t-row :gutter="[16, 16]">
        <t-col :xs="12" :xl="8">
          <t-card title="设定可承受的最大损失" :subtitle="`${profile.label} · ${profile.risk}`">
            <div class="loss-label">可承受最大回撤 {{ maxLoss.toFixed(1) }}%</div>
            <t-slider v-model="maxLoss" :min="0" :max="40" :step="0.1" />
            <t-loading :loading="loading">
              <div ref="chartEl" class="scatter" />
            </t-loading>
            <t-row :gutter="16" style="margin-top: 8px">
              <t-col :span="4">
                <t-statistic title="匹配基金" :value="matched.length" unit="只" />
              </t-col>
              <t-col :span="4">
                <t-statistic title="预览年化" :value="preview.yield" unit="%" :decimal-places="1" />
              </t-col>
              <t-col :span="4">
                <t-statistic title="预览回撤" :value="preview.loss" unit="%" :decimal-places="1" />
              </t-col>
            </t-row>
            <t-alert
              v-if="!loading && matched.length > 0 && matched.length < 5"
              theme="info"
              message="匹配不足 5 只，将按现有数量等权建仓"
              style="margin-top: 12px"
            />
            <t-button
              theme="primary"
              block
              style="margin-top: 16px"
              :disabled="loading || !previewHoldings.length"
              @click="createPortfolio"
            >
              创建组合
            </t-button>
          </t-card>
        </t-col>
        <t-col :xs="12" :xl="4">
          <t-card title="创建流程">
            <t-list>
              <t-list-item>1. 拖动回撤阈值，看散点匹配</t-list-item>
              <t-list-item>2. 点创建，生成等权组合</t-list-item>
              <t-list-item>3. 从备选池加减持仓</t-list-item>
              <t-list-item>4. 命名后保存到本机</t-list-item>
            </t-list>
          </t-card>
          <t-card title="匹配规则" style="margin-top: 16px">
            <p class="muted">可买（限额开放或 ≥1000）且最大回撤不超过阈值。同系列优先 A 类，按样本顺序取前 5 只。</p>
          </t-card>
          <t-card title="我的组合" style="margin-top: 16px">
            <t-list v-if="invest.customPortfolios.length" split>
              <t-list-item v-for="p in invest.customPortfolios" :key="p.id">
                <div class="hold-row">
                  <span class="hold-name">{{ p.name }}</span>
                  <t-space>
                    <t-button size="small" variant="text" theme="primary" @click="openSaved(p)">打开</t-button>
                    <t-button size="small" variant="text" theme="danger" @click="invest.removeCustomPortfolio(p.id)">
                      删除
                    </t-button>
                  </t-space>
                </div>
              </t-list-item>
            </t-list>
            <span v-else class="muted">创建后保存在本机，刷新仍在。</span>
          </t-card>
        </t-col>
      </t-row>
    </template>

    <template v-else>
      <t-space>
        <t-button variant="outline" @click="step = 'form'">重新设定</t-button>
        <t-button theme="primary" :disabled="!holdings.length" @click="savePortfolio">保存到我的组合</t-button>
      </t-space>
      <t-card>
        <t-space align="center" style="margin-bottom: 8px">
          <t-input v-model="name" placeholder="组合名称" style="width: 280px" />
          <t-tag theme="primary" variant="light">{{ profile.label }}</t-tag>
          <t-tag variant="outline">{{ profile.risk }}</t-tag>
        </t-space>
        <p class="muted">{{ desc }}</p>
        <t-row :gutter="16">
          <t-col :span="3">
            <t-statistic title="年化收益" :value="stats.yield" unit="%" :decimal-places="1" />
          </t-col>
          <t-col :span="3">
            <t-statistic title="波动率" :value="stats.vix" :decimal-places="2" />
          </t-col>
          <t-col :span="3">
            <t-statistic title="最大回撤" :value="stats.loss" unit="%" :decimal-places="1" />
          </t-col>
          <t-col :span="3">
            <t-statistic title="近1年" :value="stats.ret1y" unit="%" :decimal-places="1" />
          </t-col>
        </t-row>
        <div v-if="alloc.length" class="alloc">
          <div v-for="a in alloc" :key="a.label" class="alloc-row">
            <span>{{ a.label }}</span>
            <div class="alloc-track"><i :style="{ width: `${a.pct}%`, background: a.color }" /></div>
            <b>{{ a.pct.toFixed(1) }}%</b>
          </div>
        </div>
      </t-card>
      <t-row :gutter="[16, 16]">
        <t-col :xs="12" :xl="8">
          <t-card title="累计收益" subtitle="等权合成 · 近1年净值">
            <t-loading :loading="navLoading">
              <t-alert v-if="navError" theme="warning" :message="navError" />
              <div ref="navEl" class="nav-chart" />
              <span v-if="!navLoading && !growth.length && !navError" class="muted">暂无净值曲线</span>
            </t-loading>
          </t-card>
        </t-col>
        <t-col :xs="12" :xl="4">
          <t-card title="区间收益">
            <div class="periods">
              <div v-for="r in periods" :key="r.label" class="period">
                <span class="muted">{{ r.label }}</span>
                <b class="num">{{ r.v == null ? '—' : `${r.v.toFixed(1)}%` }}</b>
              </div>
            </div>
          </t-card>
          <t-card title="收益分布" subtitle="日涨跌天数" style="margin-top: 16px">
            <div v-for="b in hist.buckets" :key="b.label" class="alloc-row hist-row">
              <span>{{ b.label }}</span>
              <div class="alloc-track">
                <i :style="{ width: `${histMax ? (b.n / histMax) * 100 : 0}%` }" />
              </div>
              <b>{{ b.n }}</b>
            </div>
            <p v-if="hist.days" class="muted" style="margin-top: 8px">上涨日 {{ upPct }}%</p>
          </t-card>
        </t-col>
      </t-row>
      <t-card title="穿透持仓" subtitle="等权合成最新季报">
        <t-loading :loading="posLoading">
          <t-list v-if="positions.length" split>
            <t-list-item v-for="p in positions" :key="`${p.kind}-${p.code}-${p.name}`">
              <div class="hold-row">
                <t-list-item-meta :title="p.name" :description="`${p.kind} · ${p.code || '—'}`" />
                <span class="hold-w">{{ p.weight.toFixed(2) }}%</span>
              </div>
            </t-list-item>
          </t-list>
          <span v-else class="muted">{{ posError || '暂无穿透持仓' }}</span>
        </t-loading>
      </t-card>
      <t-row :gutter="[16, 16]">
        <t-col :xs="12" :xl="7">
          <t-card title="组合明细" :subtitle="`等权 ${holdings.length} 只`">
            <t-list split>
              <t-list-item v-for="f in holdings" :key="f.code">
                <div class="hold-row">
                  <t-list-item-meta :title="f.name" :description="`${f.code} · ${f.type}`" />
                  <div class="hold-side">
                    <span class="num">{{ f.yield.toFixed(1) }}% / {{ f.loss.toFixed(1) }}%</span>
                    <span class="hold-w">{{ weight }}%</span>
                    <t-button size="small" variant="text" theme="danger" @click="removeHolding(f.code)">移除</t-button>
                    <t-button
                      size="small"
                      variant="text"
                      theme="primary"
                      @click="router.push(`/funds/detail/${f.code}`)"
                    >
                      详情
                    </t-button>
                  </div>
                </div>
              </t-list-item>
            </t-list>
            <span v-if="!holdings.length" class="muted">持仓已清空，从右侧备选加入。</span>
          </t-card>
        </t-col>
        <t-col :xs="12" :xl="5">
          <t-card title="备选基金">
            <t-input v-model="q" placeholder="名称/代码搜索全样本" clearable style="margin-bottom: 12px" />
            <t-list split>
              <t-list-item v-for="f in alternates" :key="f.code">
                <div class="hold-row">
                  <t-list-item-meta :title="f.name" :description="`${f.code} · 回撤 ${f.loss.toFixed(1)}%`" />
                  <t-button size="small" theme="primary" variant="outline" @click="addHolding(f)">加入</t-button>
                </div>
              </t-list-item>
            </t-list>
            <span v-if="!alternates.length" class="muted">没有可加入的基金。</span>
          </t-card>
        </t-col>
      </t-row>
    </template>
  </t-space>
</template>
<script setup lang="ts">
import { LineChart, ScatterChart } from 'echarts/charts';
import { GridComponent, MarkLineComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { MessagePlugin } from 'tdesign-vue-next';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { useInvestStore } from '@/store';
import type { CustomPortfolio } from '@/types/invest';
import type { GrowthPoint, HoldingSlice, NavPoint } from '@/utils/fund';
import {
  combineEqualNav,
  dailyReturnHist,
  fetchFundNav,
  fetchFundPosition,
  mergePositions,
  periodReturn,
} from '@/utils/fund';
import type { SampleFund } from '@/utils/fund-model';
import { buyable, loadSample, matchPortfolio, portfolioStats, riskProfile } from '@/utils/fund-model';

import FundsNav from './FundsNav.vue';

defineOptions({ name: 'FundsPortfolios' });

echarts.use([ScatterChart, LineChart, GridComponent, MarkLineComponent, TooltipComponent, CanvasRenderer]);

const router = useRouter();
const invest = useInvestStore();
const loading = ref(false);
const error = ref('');
const funds = ref<SampleFund[]>([]);
const maxLoss = ref(0.6);
const step = ref<'form' | 'result'>('form');
const holdings = ref<SampleFund[]>([]);
const name = ref('');
const q = ref('');
const editingId = ref<string | null>(null);
const chartEl = ref<HTMLDivElement | null>(null);
const navEl = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;
let navChart: echarts.ECharts | null = null;
const growth = ref<GrowthPoint[]>([]);
const navLoading = ref(false);
const navError = ref('');
const positions = ref<HoldingSlice[]>([]);
const posLoading = ref(false);
const posError = ref('');
let analyticsSeq = 0;

const matched = computed(() => matchPortfolio(funds.value, maxLoss.value));
const previewHoldings = computed(() => matched.value.slice(0, 5));
const preview = computed(() => portfolioStats(previewHoldings.value));
const profile = computed(() => riskProfile(maxLoss.value));
const stats = computed(() => portfolioStats(holdings.value));
const weight = computed(() => (holdings.value.length ? (100 / holdings.value.length).toFixed(1) : '0'));
const desc = computed(
  () =>
    `按可承受最大回撤 ${maxLoss.value.toFixed(1)}% 筛选可买样本，风险偏${profile.value.label}（${profile.value.risk}），持仓等权。`,
);
const alloc = computed(() => {
  const tot = stats.value.shares + stats.value.bonds + stats.value.cash;
  if (tot <= 0) return [];
  return [
    { label: '股票', pct: (stats.value.shares / tot) * 100, color: 'var(--guanlan-accent)' },
    { label: '债券', pct: (stats.value.bonds / tot) * 100, color: 'var(--guanlan-gold)' },
    { label: '现金', pct: (stats.value.cash / tot) * 100, color: 'var(--guanlan-muted)' },
  ];
});
const periods = computed(() => [
  { label: '近1月', v: periodReturn(growth.value, 1) },
  { label: '近3月', v: periodReturn(growth.value, 3) },
  { label: '近半年', v: periodReturn(growth.value, 6) },
  { label: '近1年', v: periodReturn(growth.value, 12) },
]);
const hist = computed(() => dailyReturnHist(growth.value));
const histMax = computed(() => Math.max(0, ...hist.value.buckets.map((b) => b.n)));
const upPct = computed(() => (hist.value.days ? ((hist.value.up / hist.value.days) * 100).toFixed(0) : '0'));
const holdingCodes = computed(() => new Set(holdings.value.map((f) => f.code)));
const alternates = computed(() => {
  const s = q.value.trim().toLowerCase();
  const pool = s
    ? funds.value.filter((f) => buyable(f) && (f.name.toLowerCase().includes(s) || f.code.includes(s)))
    : matched.value.slice(5);
  return pool.filter((f) => !holdingCodes.value.has(f.code)).slice(0, 10);
});

function scatterData() {
  const list = funds.value;
  const stepN = list.length > 400 ? Math.ceil(list.length / 400) : 1;
  const out: [number, number, string][] = [];
  for (let i = 0; i < list.length; i += stepN) {
    const f = list[i];
    out.push([Math.abs(f.loss), f.yield, f.name]);
  }
  return out;
}

function renderChart() {
  if (!chartEl.value || step.value !== 'form') return;
  if (!chart) chart = echarts.init(chartEl.value);
  chart.setOption(
    {
      tooltip: {
        formatter: (p: { data?: [number, number, string] }) => {
          const d = p.data;
          if (!d) return '';
          return `${d[2]}<br/>回撤 ${d[0].toFixed(1)}%<br/>年化 ${d[1].toFixed(1)}%`;
        },
      },
      grid: { left: 56, right: 52, top: 28, bottom: 44 },
      xAxis: {
        name: '最大回撤 %',
        nameLocation: 'middle',
        nameGap: 28,
        min: 0,
        max: 40,
        splitLine: { lineStyle: { color: '#e6eaed' } },
      },
      yAxis: {
        name: '年化 %',
        nameLocation: 'middle',
        nameGap: 40,
        splitLine: { lineStyle: { color: '#e6eaed' } },
      },
      series: [
        {
          type: 'scatter',
          symbolSize: 8,
          itemStyle: { color: 'rgba(13, 112, 109, 0.45)' },
          data: scatterData(),
          markLine: {
            symbol: 'none',
            label: { show: false },
            lineStyle: { color: '#dfb56d', type: 'dashed' },
            data: [{ xAxis: maxLoss.value }],
          },
        },
      ],
    },
    true,
  );
}

function createPortfolio() {
  holdings.value = previewHoldings.value.slice();
  name.value = `${profile.value.label}组合`;
  editingId.value = null;
  q.value = '';
  step.value = 'result';
}

function addHolding(f: SampleFund) {
  if (holdingCodes.value.has(f.code)) return;
  holdings.value = [...holdings.value, f];
}

function removeHolding(code: string) {
  holdings.value = holdings.value.filter((f) => f.code !== code);
}

function savePortfolio() {
  const n = name.value.trim();
  if (!n) {
    MessagePlugin.warning('先填写组合名称');
    return;
  }
  if (!holdings.value.length) {
    MessagePlugin.warning('持仓为空');
    return;
  }
  const row: CustomPortfolio = {
    id: editingId.value || `p${Date.now()}`,
    name: n,
    desc: desc.value,
    maxLoss: maxLoss.value,
    codes: holdings.value.map((f) => f.code),
  };
  invest.saveCustomPortfolio(row);
  editingId.value = row.id;
  MessagePlugin.success('已保存到本机');
}

function openSaved(p: CustomPortfolio) {
  const map = new Map(funds.value.map((f) => [f.code, f]));
  const rows = p.codes.map((c) => map.get(c)).filter((f): f is SampleFund => !!f);
  if (!rows.length) {
    MessagePlugin.warning('样本中找不到这些基金');
    return;
  }
  maxLoss.value = p.maxLoss;
  holdings.value = rows;
  name.value = p.name;
  editingId.value = p.id;
  q.value = '';
  step.value = 'result';
}

onMounted(async () => {
  loading.value = true;
  try {
    funds.value = await loadSample();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '样本加载失败';
  } finally {
    loading.value = false;
    await nextTick();
    renderChart();
  }
});

watch([maxLoss, funds], () => {
  if (step.value === 'form') renderChart();
});
function renderNav() {
  if (!navEl.value || step.value !== 'result') return;
  if (!growth.value.length) {
    navChart?.clear();
    return;
  }
  if (!navChart) navChart = echarts.init(navEl.value);
  navChart.setOption(
    {
      tooltip: { trigger: 'axis', valueFormatter: (v: number) => `${Number(v).toFixed(2)}%` },
      grid: { left: 48, right: 16, top: 24, bottom: 32 },
      xAxis: { type: 'category', data: growth.value.map((p) => p.date), boundaryGap: false },
      yAxis: { type: 'value', scale: true, axisLabel: { formatter: '{value}%' } },
      series: [
        {
          type: 'line',
          name: '累计收益',
          showSymbol: false,
          data: growth.value.map((p) => p.value),
          lineStyle: { color: '#0d706d' },
          areaStyle: { color: 'rgba(13, 112, 109, 0.08)' },
        },
      ],
    },
    true,
  );
}

async function loadAnalytics() {
  const my = ++analyticsSeq;
  const codes = holdings.value.map((f) => f.code);
  growth.value = [];
  positions.value = [];
  navError.value = '';
  posError.value = '';
  if (step.value !== 'result' || !codes.length) {
    navChart?.clear();
    return;
  }
  navLoading.value = true;
  posLoading.value = true;
  const navP = Promise.all(codes.map((c) => fetchFundNav(c).catch(() => [] as NavPoint[])))
    .then((series) => {
      if (my !== analyticsSeq) return;
      const g = combineEqualNav(series);
      growth.value = g;
      if (!g.length) navError.value = '暂无净值曲线';
    })
    .catch((e) => {
      if (my !== analyticsSeq) return;
      navError.value = e instanceof Error ? e.message : '净值加载失败';
    })
    .finally(() => {
      if (my === analyticsSeq) navLoading.value = false;
    });
  const posP = Promise.all(codes.map((c) => fetchFundPosition(c).catch(() => [] as HoldingSlice[])))
    .then((bags) => {
      if (my !== analyticsSeq) return;
      positions.value = mergePositions(bags).slice(0, 12);
      if (!positions.value.length) posError.value = '暂无穿透持仓';
    })
    .catch((e) => {
      if (my !== analyticsSeq) return;
      posError.value = e instanceof Error ? e.message : '持仓加载失败';
    })
    .finally(() => {
      if (my === analyticsSeq) posLoading.value = false;
    });
  await navP;
  if (my !== analyticsSeq) return;
  await nextTick();
  renderNav();
  navChart?.resize();
  await posP;
}

watch(step, async (s) => {
  if (s === 'form') {
    chart?.dispose();
    chart = null;
    navChart?.dispose();
    navChart = null;
    await nextTick();
    renderChart();
    return;
  }
  await loadAnalytics();
});
watch(holdings, () => {
  if (step.value === 'result') loadAnalytics();
});
onUnmounted(() => {
  chart?.dispose();
  navChart?.dispose();
});
</script>
<style scoped>
.loss-label,
.num {
  font-variant-numeric: tabular-nums;
}

.loss-label {
  margin-bottom: 8px;
  color: var(--guanlan-ink);
  font-weight: 600;
}

.scatter,
.nav-chart {
  height: 280px;
  margin-top: 8px;
}

.periods {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 16px;
}

.period {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.period b {
  font-size: 20px;
  font-weight: 600;
  color: var(--guanlan-ink);
}

.hist-row {
  grid-template-columns: 56px 1fr 40px;
}

.muted {
  color: var(--guanlan-muted);
  font-size: 13px;
  line-height: 1.55;
}

.alloc {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
}

.alloc-row {
  display: grid;
  grid-template-columns: 36px 1fr 56px;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.alloc-track {
  height: 8px;
  overflow: hidden;
  background: var(--guanlan-surface-soft);
  border-radius: 999px;
}

.alloc-track i {
  display: block;
  height: 100%;
  background: var(--guanlan-accent);
}

.alloc-row b {
  text-align: right;
  font-weight: 600;
}

.hold-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  width: 100%;
}

.hold-name {
  min-width: 0;
  flex: 1;
  line-height: 22px;
  overflow-wrap: anywhere;
}

.hold-w {
  flex: 0 0 auto;
  color: var(--td-text-color-secondary);
  font-variant-numeric: tabular-nums;
}

.hold-side {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
}

@media (width <= 767px) {
  .hold-row,
  .hold-side {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
