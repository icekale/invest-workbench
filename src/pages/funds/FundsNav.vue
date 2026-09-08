<template>
  <t-radio-group :value="route.path" variant="default-filled" @change="go">
    <t-radio-button value="/funds/index">研究首页</t-radio-button>
    <t-radio-button value="/funds/recommend">优质精选</t-radio-button>
    <t-radio-button value="/funds/database">基金数据</t-radio-button>
    <t-radio-button value="/funds/portfolios">智能组合</t-radio-button>
    <t-radio-button value="/funds/research">方法论</t-radio-button>
  </t-radio-group>
</template>
<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';

defineOptions({ name: 'FundsNav' });
const route = useRoute();
const router = useRouter();
function go(v: string | number | boolean) {
  router.push(String(v));
}
</script>
