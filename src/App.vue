<template>
  <t-config-provider :global-config="getComponentsLocale">
    <router-view :key="locale" :class="[mode]" />
    <trade-dialog v-if="route.path !== '/login'" />
  </t-config-provider>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import TradeDialog from '@/components/TradeDialog.vue';
import { useLocale } from '@/locales/useLocale';
import { useSettingStore } from '@/store';

const route = useRoute();
const store = useSettingStore();

const mode = computed(() => {
  return store.displayMode;
});

const { getComponentsLocale, locale } = useLocale();
</script>
