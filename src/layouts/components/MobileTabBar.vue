<template>
  <nav class="guanlan-tabbar" aria-label="主导航">
    <router-link
      v-for="item in tabs"
      :key="item.path"
      :to="item.path"
      class="guanlan-tabbar-item"
      :class="{ 'is-active': route.path.startsWith(item.match) }"
    >
      <component :is="item.icon" class="guanlan-tabbar-icon" />
      <span>{{ item.label }}</span>
    </router-link>
  </nav>
</template>
<script setup lang="ts">
import { ChartIcon, EditIcon, PreciseMonitorIcon, SearchIcon } from 'tdesign-icons-vue-next';
import { useRoute } from 'vue-router';

const route = useRoute();

const tabs = [
  { path: '/dashboard/index', match: '/dashboard', label: '仓位', icon: PreciseMonitorIcon },
  { path: '/funds/index', match: '/funds', label: '研究', icon: SearchIcon },
  { path: '/review/index', match: '/review', label: '复盘', icon: ChartIcon },
  { path: '/plan/index', match: '/plan', label: '账户', icon: EditIcon },
];
</script>
