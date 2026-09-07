<template>
  <div class="invest-page">
    <t-button variant="text" @click="router.push('/funds/index')">返回列表</t-button>
    <h1 class="invest-title">基金对比</h1>
    <p v-if="rows.length < 2" class="invest-sub">请至少选择两只基金</p>
    <t-table v-else :data="table" :columns="columns" row-key="metric" size="small" />
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { funds } from '@/mock/invest';

defineOptions({ name: 'FundsCompare' });

const route = useRoute();
const router = useRouter();

const rows = computed(() => {
  const codes = String(route.query.codes || '')
    .split(',')
    .filter(Boolean);
  return funds.filter((f) => codes.includes(f.code));
});

const columns = computed(() => [
  { colKey: 'metric', title: '指标', width: 100 },
  ...rows.value.map((f) => ({ colKey: f.code, title: f.name })),
]);

const table = computed(() => {
  const list = rows.value;
  const cell = (pick: (f: (typeof list)[0]) => string | number) =>
    Object.fromEntries(list.map((f) => [f.code, pick(f)]));
  return [
    { metric: '代码', ...cell((f) => f.code) },
    { metric: '经理', ...cell((f) => f.manager) },
    { metric: '类型', ...cell((f) => f.type) },
    { metric: '收益%', ...cell((f) => f.yield) },
    { metric: '波动', ...cell((f) => f.vix) },
    { metric: '回撤%', ...cell((f) => f.loss) },
    { metric: '评分', ...cell((f) => f.score) },
    { metric: '星级', ...cell((f) => f.star) },
  ];
});
</script>
