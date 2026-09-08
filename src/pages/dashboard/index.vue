<template>
  <t-space direction="vertical" :size="16" style="width: 100%">
    <t-space align="center" break-line>
      <span style="color: var(--td-text-color-secondary)">今天先管理风险，再寻找值得下注的赔率。</span>
      <t-space break-line>
        <t-button variant="outline" :loading="invest.quoteLoading" @click="refresh()">刷新行情</t-button>
        <t-button variant="outline" @click="exportSnap">导出快照</t-button>
        <t-button variant="outline" @click="router.push('/funds')">记录一条</t-button>
        <t-button theme="primary" @click="editOpen = true">编辑持仓</t-button>
      </t-space>
    </t-space>
    <t-alert v-if="closed" theme="warning" message="今日休市，展示最近交易日收盘价" />
    <t-tabs v-model="tab" @change="onTab">
      <t-tab-panel value="stock" label="股票账户">
        <account-panel title="股票账户" :rows="invest.stockRows" :cash="invest.cash.stock" />
      </t-tab-panel>
      <t-tab-panel value="etf" label="ETF 账户">
        <account-panel title="ETF 账户" :rows="invest.etfRows" :cash="invest.cash.etf" />
      </t-tab-panel>
    </t-tabs>
    <holdings-editor v-model:visible="editOpen" />
  </t-space>
</template>
<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next';
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { useInvestStore } from '@/store';
import { fetchTradeMonth } from '@/utils/backup';

import AccountPanel from './AccountPanel.vue';
import HoldingsEditor from './HoldingsEditor.vue';

defineOptions({ name: 'DashboardIndex' });

const invest = useInvestStore();
const router = useRouter();
const tab = ref(new URLSearchParams(window.location.search).get('tab') === 'etf' ? 'etf' : 'stock');
const editOpen = ref(false);
const closed = ref(false);
let timer = 0;

onMounted(async () => {
  await refresh();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  try {
    const days = await fetchTradeMonth(now.getFullYear(), now.getMonth() + 1);
    closed.value = days.length > 0 && !days.some((d) => d.date === today && d.open);
  } catch {
    closed.value = false;
  }
  timer = window.setInterval(refresh, 60_000, true);
});
onUnmounted(() => clearInterval(timer));

async function refresh(silent = false) {
  await invest.refreshQuotes();
  if (silent) return;
  MessagePlugin.success(
    invest.quoteAt ? `行情已更新 ${new Date(invest.quoteAt).toTimeString().slice(0, 5)}` : '行情已刷新',
  );
}

function onTab(value: string | number) {
  MessagePlugin.info(`已切换到${value === 'etf' ? 'ETF' : '股票'}账户`);
}

function exportSnap() {
  const blob = new Blob([JSON.stringify(invest.snapshot(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `invest-snapshot-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  MessagePlugin.success('快照已下载');
}
</script>
