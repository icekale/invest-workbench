<template>
  <t-space direction="vertical" :size="16" style="width: 100%">
    <funds-nav />
    <t-alert v-if="error" theme="warning" :message="error" />
    <t-card title="基金数据" :subtitle="`全样本 ${funds.length} 只`">
      <t-space style="margin-bottom: 12px">
        <t-input v-model="q" placeholder="名称/代码" style="width: 200px" clearable />
        <t-select v-model="tab" :options="typeOpts" style="width: 140px" />
      </t-space>
      <t-table
        :data="paged"
        :columns="cols"
        row-key="code"
        hover
        :loading="loading"
        :pagination="pager"
        :on-row-click="({ row }) => router.push(`/funds/detail/${row.code}`)"
        @page-change="onPage"
      >
        <template #yield="{ row }">{{ row.yield.toFixed(2) }}%</template>
        <template #vix="{ row }">{{ row.vix.toFixed(2) }}</template>
        <template #loss="{ row }">{{ row.loss.toFixed(2) }}%</template>
      </t-table>
    </t-card>
  </t-space>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import type { SampleFund } from '@/utils/fund-model';
import { FUND_TYPES, loadSample } from '@/utils/fund-model';

import FundsNav from './FundsNav.vue';

defineOptions({ name: 'FundsDatabase' });

const router = useRouter();
const loading = ref(false);
const error = ref('');
const funds = ref<SampleFund[]>([]);
const q = ref('');
const tab = ref('全部');
const typeOpts = [{ label: '全部', value: '全部' }, ...FUND_TYPES.map((t) => ({ label: t, value: t }))];
const current = ref(1);
const pageSize = 20;
const filtered = computed(() => {
  const s = q.value.trim().toLowerCase();
  return funds.value.filter((f) => {
    if (tab.value !== '全部' && f.type !== tab.value) return false;
    if (!s) return true;
    return f.name.toLowerCase().includes(s) || f.code.includes(s);
  });
});
const paged = computed(() => filtered.value.slice((current.value - 1) * pageSize, current.value * pageSize));
const pager = computed(() => ({ current: current.value, pageSize, total: filtered.value.length, showJumper: true }));
function onPage(p: { current: number }) {
  current.value = p.current;
}
const cols = [
  { colKey: 'name', title: '名称' },
  { colKey: 'code', title: '代码', width: 88 },
  { colKey: 'type', title: '类型', width: 96 },
  { colKey: 'yield', title: 'Yield', width: 96 },
  { colKey: 'vix', title: 'Vix', width: 80 },
  { colKey: 'loss', title: 'Loss', width: 96 },
  { colKey: 'risk', title: '风险', width: 96 },
  { colKey: 'company', title: '公司' },
];

watch([q, tab], () => {
  current.value = 1;
});

onMounted(async () => {
  loading.value = true;
  try {
    funds.value = await loadSample();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '样本加载失败';
  } finally {
    loading.value = false;
  }
});
</script>
