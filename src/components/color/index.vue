<template>
  <div :style="style" class="color-container" />
</template>
<script setup lang="ts">
import { computed } from 'vue';

const { value } = defineProps({
  value: {
    type: String,
    default: '',
  },
});

const panelColor = 'conic-gradient(from 90deg at 50% 50%, #b8433e, #dfb56d, #16815f, #0d706d, #3569bb, #b8433e)';

const style = computed(() => {
  return {
    background: value || panelColor,
  };
});
</script>
<style lang="less" scoped>
.color-container {
  width: 24px;
  height: 24px;
  border-radius: var(--td-radius-circle);
  display: inline-block;
}
</style>
