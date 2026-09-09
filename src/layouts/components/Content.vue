<template>
  <div v-if="!isRefreshing">
    <router-view v-if="!isFramePage" v-slot="{ Component }">
      <keep-alive :include="ALIVE" :max="10">
        <component :is="Component" />
      </keep-alive>
    </router-view>
    <frame-page v-else />
  </div>

  <t-loading v-else />
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import FramePage from '@/layouts/frame/index.vue';
import { useTabsRouterStore } from '@/store';

const ALIVE = [
  'DashboardIndex',
  'ResearchIndex',
  'ReviewIndex',
  'PlanIndex',
  'FundsRecommend',
  'FundsDatabase',
  'FundsPortfolios',
  'FundsResearch',
  'FundsCompare',
];

const isRefreshing = computed(() => useTabsRouterStore().refreshing);
const route = useRoute();
const isFramePage = computed(() => !!route.meta?.frameSrc);
</script>
