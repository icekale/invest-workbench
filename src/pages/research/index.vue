<template>
  <t-space class="page" direction="vertical" :size="16" style="width: 100%">
    <macro-compass />
    <valuation-radar />
    <etf-radar />
    <research-desk />
  </t-space>
</template>
<script setup lang="ts">
import './research.less';

import EtfRadar from './EtfRadar.vue';
import MacroCompass from './MacroCompass.vue';
import ResearchDesk from './ResearchDesk.vue';
import ValuationRadar from './ValuationRadar.vue';

defineOptions({ name: 'ResearchIndex' });
</script>
