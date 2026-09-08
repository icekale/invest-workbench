<template>
  <header class="login-header">
    <guanlan-logo theme="dark" :mark-size="32" />
  </header>
</template>
<script setup lang="ts">
import GuanlanLogo from '@/components/GuanlanLogo.vue';
</script>
<style lang="less" scoped>
.login-header {
  padding: 0 var(--td-comp-paddingLR-xl);
  display: flex;
  align-items: center;
  backdrop-filter: blur(10px);
  height: var(--td-comp-size-xxxl);
}
</style>
