<template>
  <t-space direction="vertical" :size="16" style="width: 100%">
    <t-button variant="text" theme="primary" @click="router.push('/funds/index')">返回列表</t-button>
    <t-alert v-if="error" theme="error" :message="error" />
    <t-card title="基金对比">
      <t-loading v-if="loading" text="加载对比..." />
      <t-empty v-else-if="rows.length < 2" description="请至少选择两只基金" />
      <t-table v-else :data="table" :columns="columns" row-key="metric" bordered />
    </t-card>
  </t-space>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import type { FundDetail } from '@/utils/fund';
import { fetchFundDetail, fmtPct, researchScore, riskNote } from '@/utils/fund';

defineOptions({ name: 'FundsCompare' });

const route = useRoute();
const router = useRouter();
const rows = ref<FundDetail[]>([]);
const loading = ref(false);
const error = ref('');

onMounted(async () => {
  const codes = String(route.query.codes || '')
    .split(',')
    .filter(Boolean)
    .slice(0, 4);
  if (codes.length < 2) return;
  loading.value = true;
  try {
    rows.value = await Promise.all(codes.map(fetchFundDetail));
  } catch (e) {
    error.value = e instanceof Error ? e.message : '对比加载失败';
  } finally {
    loading.value = false;
  }
});

const columns = computed(() => [
  { colKey: 'metric', title: '指标', width: 100 },
  ...rows.value.map((f) => ({ colKey: f.code, title: f.name })),
]);

const table = computed(() => {
  const list = rows.value;
  const cell = (pick: (f: FundDetail) => string | number) => Object.fromEntries(list.map((f) => [f.code, pick(f)]));
  return [
    { metric: '代码', ...cell((f) => f.code) },
    { metric: '经理', ...cell((f) => f.manager) },
    { metric: '类型', ...cell((f) => f.type) },
    { metric: '净值', ...cell((f) => f.nav ?? '—') },
    { metric: '近3年', ...cell((f) => fmtPct(f.year3)) },
    { metric: '今年来', ...cell((f) => fmtPct(f.ytd)) },
    { metric: 'Yield 近1年', ...cell((f) => fmtPct(f.year)) },
    { metric: 'Vix 波动', ...cell((f) => (f.stddev == null ? '—' : f.stddev.toFixed(2))) },
    { metric: 'Loss 回撤', ...cell((f) => (f.drawdown == null ? '—' : fmtPct(-f.drawdown))) },
    { metric: '夏普', ...cell((f) => f.sharpe ?? '—') },
    { metric: '研选分', ...cell((f) => researchScore(f.year, f.stddev, f.drawdown) ?? '—') },
    { metric: '回撤/波动', ...cell((f) => riskNote(f.stddev, f.drawdown)) },
  ];
});
</script>
