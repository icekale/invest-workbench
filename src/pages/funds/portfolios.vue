<template>
  <t-space direction="vertical" :size="16" style="width: 100%">
    <funds-nav />
    <t-alert v-if="error" theme="warning" :message="error" />
    <t-card title="智能组合" :subtitle="`${profile.label} · ${profile.risk}`">
      <div>可承受最大回撤 {{ maxLoss }}%</div>
      <t-slider v-model="maxLoss" :min="1" :max="20" :step="1" style="max-width: 480px; margin: 12px 0" />
      <t-loading :loading="loading">
        <t-row :gutter="16">
          <t-col :span="6">
            <h4>持仓（等权）</h4>
            <t-list split>
              <t-list-item v-for="f in holdings" :key="f.code" @click="router.push(`/funds/detail/${f.code}`)">
                {{ f.name }}
                <template #action>{{ f.yield.toFixed(1) }}% / {{ f.loss.toFixed(1) }}%</template>
              </t-list-item>
            </t-list>
          </t-col>
          <t-col :span="6">
            <h4>备选</h4>
            <t-list split>
              <t-list-item v-for="f in backup" :key="f.code" @click="router.push(`/funds/detail/${f.code}`)">
                {{ f.name }}
                <template #action>{{ f.loss.toFixed(1) }}%</template>
              </t-list-item>
            </t-list>
          </t-col>
        </t-row>
      </t-loading>
    </t-card>
  </t-space>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import type { SampleFund } from '@/utils/fund-model';
import { loadSample, matchPortfolio, riskProfile } from '@/utils/fund-model';

import FundsNav from './FundsNav.vue';

defineOptions({ name: 'FundsPortfolios' });

const router = useRouter();
const loading = ref(false);
const error = ref('');
const funds = ref<SampleFund[]>([]);
const maxLoss = ref(5);
const matched = computed(() => matchPortfolio(funds.value, maxLoss.value));
const holdings = computed(() => matched.value.slice(0, 5));
const backup = computed(() => matched.value.slice(5, 15));
const profile = computed(() => riskProfile(maxLoss.value));

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
