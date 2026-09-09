<template>
  <div>
    <template v-if="setting.layout.value === 'side'">
      <t-layout key="side" :class="mainLayoutCls">
        <t-aside><layout-side-nav /></t-aside>
        <t-layout>
          <t-header><layout-header /></t-header>
          <t-content><layout-content /></t-content>
        </t-layout>
      </t-layout>
    </template>

    <template v-else>
      <t-layout key="no-side">
        <t-header><layout-header /> </t-header>
        <t-layout :class="mainLayoutCls">
          <layout-side-nav />
          <layout-content />
        </t-layout>
      </t-layout>
    </template>
    <div v-show="settingStore.mobileNavOpen" class="guanlan-nav-mask" @click="settingStore.mobileNavOpen = false" />
    <mobile-tab-bar />
    <setting-com />
  </div>
</template>
<script setup lang="ts">
import '@/style/layout.less';

import { storeToRefs } from 'pinia';
import { computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';

import { prefix } from '@/config/global';
import { useInvestStore, useSettingStore, useTabsRouterStore } from '@/store';
import { bindCloudSync } from '@/utils/cloud-sync';
import { settleConflictsIfNeeded } from '@/utils/sync-ui';

import LayoutContent from './components/LayoutContent.vue';
import LayoutHeader from './components/LayoutHeader.vue';
import LayoutSideNav from './components/LayoutSideNav.vue';
import MobileTabBar from './components/MobileTabBar.vue';
import SettingCom from './setting.vue';

const route = useRoute();
const settingStore = useSettingStore();
const tabsRouterStore = useTabsRouterStore();
const setting = storeToRefs(settingStore);

const mainLayoutCls = computed(() => [
  {
    't-layout--with-sider': settingStore.showSidebar,
  },
]);

const appendNewRoute = () => {
  const {
    path,
    query,
    meta: { title },
    name,
  } = route;
  const titleObj = typeof title === 'string' ? { zh_CN: title, en_US: title } : title;
  tabsRouterStore.appendTabRouterList({ path, query, title: titleObj, name, isAlive: true, meta: route.meta });
};

const onEsc = (e: KeyboardEvent) => {
  if (e.key === 'Escape') settingStore.mobileNavOpen = false;
};

onMounted(() => {
  appendNewRoute();
  window.addEventListener('keydown', onEsc);
  void bindCloudSync(useInvestStore()).then(() => settleConflictsIfNeeded());
});

onUnmounted(() => {
  window.removeEventListener('keydown', onEsc);
  document.body.style.overflow = '';
  document.documentElement.setAttribute('data-mobile-nav', '');
});

watch(
  () => route.path,
  () => {
    appendNewRoute();
    settingStore.mobileNavOpen = false;
    document.querySelector(`.${prefix}-layout`)?.scrollTo({ top: 0, behavior: 'smooth' });
  },
);

watch(
  () => settingStore.mobileNavOpen,
  (open) => {
    document.documentElement.setAttribute('data-mobile-nav', open ? 'open' : '');
    document.body.style.overflow = open ? 'hidden' : '';
  },
);
</script>
<style lang="less" scoped></style>
