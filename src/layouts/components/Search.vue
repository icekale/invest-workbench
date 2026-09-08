<template>
  <div class="header-menu-search">
    <t-input v-model="searchData" class="header-search" :placeholder="t('layout.searchPlaceholder')" @enter="go">
      <template #prefix-icon>
        <t-icon class="icon" name="search" size="16" />
      </template>
    </t-input>
  </div>
</template>
<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { t } from '@/locales';

defineProps({
  layout: {
    type: String,
    default: '',
  },
});

const router = useRouter();
const searchData = ref('');

function go() {
  const q = searchData.value.trim();
  if (!q) return;
  if (/^\d{6}$/.test(q)) {
    router.push(`/funds/detail/${q}`);
    searchData.value = '';
    return;
  }
  MessagePlugin.info('输入 6 位基金代码回车看详情');
  router.push({ path: '/funds/index', query: { q } });
}
</script>
<style lang="less" scoped>
.header-menu-search {
  display: flex;
  margin-left: 16px;

  @media (width <= 767px) {
    display: none;
  }

  .t-icon {
    color: var(--td-text-color-primary) !important;
  }

  .header-search {
    width: 200px;

    :deep(.t-input) {
      border: none;
      outline: none;
      box-shadow: none;
      background: var(--td-bg-color-secondarycontainer);

      .t-input__inner {
        background: none;
      }
    }
  }
}
</style>
