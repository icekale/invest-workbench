<template>
  <div class="funds-nav-container">
    <div class="funds-nav-bar">
      <router-link
        v-for="(item, idx) in navItems"
        :key="item.path"
        :to="item.path"
        class="funds-nav-item"
        :class="{ 'is-active': isItemActive(item.path) }"
      >
        <span class="funds-nav-label">{{ item.title }}</span>
        <span v-if="idx < navItems.length - 1" class="funds-nav-divider">|</span>
      </router-link>
    </div>
  </div>
</template>
<script setup lang="ts">
import { useRoute } from 'vue-router';

defineOptions({ name: 'FundsNav' });

const route = useRoute();

const navItems = [
  { path: '/funds/recommend', title: '优质精选' },
  { path: '/funds/database', title: '基金数据' },
  { path: '/funds/portfolios', title: '策略组合' },
  { path: '/funds/research', title: '方法论' },
];

function isItemActive(path: string) {
  if (route.path === path) return true;
  if (path === '/funds/recommend' && (route.path === '/funds' || route.path === '/funds/index')) return true;
  return false;
}
</script>
<style scoped lang="less">
.funds-nav-container {
  background: var(--td-bg-color-container);
  border-radius: 8px;
  padding: 10px 18px;
  border: 1px solid var(--td-border-level-1-color);
  box-shadow: 0 1px 2px rgb(0 0 0 / 2%);
}

.funds-nav-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
}

.funds-nav-item {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
  font-size: 14px;
  color: var(--td-text-color-secondary);
  font-weight: 500;
  transition: all 0.15s ease;
  padding: 4px 6px;
  border-radius: 4px;

  &:hover {
    color: var(--td-brand-color, #0d706d);
  }

  &.is-active {
    color: var(--td-brand-color, #0d706d);
    font-weight: 700;

    .funds-nav-label {
      position: relative;

      &::after {
        content: '';
        position: absolute;
        bottom: -6px;
        left: 0;
        right: 0;
        height: 2px;
        background: var(--td-brand-color, #0d706d);
        border-radius: 2px;
      }
    }
  }

  .funds-nav-divider {
    margin-left: 14px;
    margin-right: 8px;
    color: var(--td-border-level-2-color, #dcdcdc);
    font-weight: 300;
    user-select: none;
  }
}
</style>
