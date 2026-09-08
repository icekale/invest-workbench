<template>
  <t-space direction="vertical" :size="16" style="width: 100%">
    <funds-nav />
    <t-alert v-if="error" theme="warning" :message="error" />
    <t-card title="优质精选" subtitle="机构持仓≥50%或指数型 · 五星 · 规模>10亿 · 收益> |回撤| · 可买">
      <t-radio-group v-model="tab" variant="default-filled" style="margin-bottom: 12px">
        <t-radio-button v-for="t in tabs" :key="t" :value="t">{{ t }}</t-radio-button>
      </t-radio-group>
      <div class="table-wrap">
        <t-table
          :data="rows"
          :columns="cols"
          row-key="code"
          hover
          :loading="loading"
          :on-row-click="({ row }) => router.push(`/funds/detail/${row.code}`)"
        >
          <template #yield="{ row }">{{ row.yield.toFixed(2) }}%</template>
          <template #vix="{ row }">{{ row.vix.toFixed(2) }}</template>
          <template #loss="{ row }">{{ row.loss.toFixed(2) }}%</template>
        </t-table>
      </div>
    </t-card>
  </t-space>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import type { SampleFund } from '@/utils/fund-model';
import { FUND_TYPES, isRecommend, loadSample } from '@/utils/fund-model';

import FundsNav from './FundsNav.vue';

defineOptions({ name: 'FundsRecommend' });

const router = useRouter();
const loading = ref(false);
const error = ref('');
const funds = ref<SampleFund[]>([]);
const tab = ref('混合型');
const tabs = FUND_TYPES.filter((t) => t !== 'QDII');
const rows = computed(() => funds.value.filter(isRecommend).filter((f) => f.type === tab.value));
const cols = [
  { colKey: 'name', title: '名称' },
  { colKey: 'code', title: '代码', width: 88 },
  { colKey: 'yield', title: 'Yield', width: 96 },
  { colKey: 'vix', title: 'Vix', width: 80 },
  { colKey: 'loss', title: 'Loss', width: 96 },
  { colKey: 'rating', title: '评级', width: 72 },
  { colKey: 'scale', title: '规模亿', width: 88 },
];

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
<style scoped>
.table-wrap {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
}
</style>
