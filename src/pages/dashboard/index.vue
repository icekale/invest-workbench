<template>
  <t-space direction="vertical" :size="16" style="width: 100%">
    <div class="dash-action-bar">
      <span class="dash-slogan">今天先管理风险，再寻找值得下注的赔率。</span>
      <div class="dash-btn-group">
        <t-button variant="outline" size="small" :loading="invest.quoteLoading" @click="refresh()">
          <template #icon><t-icon name="refresh" /></template>
          刷新行情
        </t-button>
        <t-button variant="outline" size="small" @click="exportSnap">
          <template #icon><t-icon name="download" /></template>
          导出快照
        </t-button>
        <t-button variant="outline" size="small" @click="triggerImport">
          <template #icon><t-icon name="upload" /></template>
          导入快照
        </t-button>
        <t-button variant="outline" size="small" @click="router.push('/review')">
          <template #icon><t-icon name="chart" /></template>
          记录复盘
        </t-button>
        <t-button theme="primary" size="small" @click="editOpen = true">
          <template #icon><t-icon name="edit" /></template>
          编辑持仓
        </t-button>
      </div>
    </div>
    <t-alert v-if="closed" theme="warning" message="今日休市，展示最近交易日收盘价" />
    <t-tabs v-model="tab" @change="onTab">
      <t-tab-panel value="stock" label="股票账户">
        <account-panel title="股票账户" :rows="invest.stockRows" :cash="invest.cash.stock" @edit="editOpen = true" />
      </t-tab-panel>
      <t-tab-panel value="etf" label="ETF 账户">
        <account-panel title="ETF 账户" :rows="invest.etfRows" :cash="invest.cash.etf" @edit="editOpen = true" />
      </t-tab-panel>
    </t-tabs>
    <holdings-editor v-model:visible="editOpen" />
    <input
      ref="fileInputRef"
      type="file"
      accept=".json,application/json"
      style="display: none"
      @change="handleFileChange"
    />
  </t-space>
</template>
<script setup lang="ts">
import { DialogPlugin, MessagePlugin } from 'tdesign-vue-next';
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
  await refresh(true);
  const now = new Date();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(now);
  try {
    const days = await fetchTradeMonth(now.getFullYear(), now.getMonth() + 1);
    closed.value = days.length > 0 && !days.some((d) => d.date === today && d.open);
  } catch {
    closed.value = false;
  }
  timer = window.setInterval(() => {
    if (document.visibilityState === 'visible') refresh(true);
  }, 60_000);
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

const fileInputRef = ref<HTMLInputElement | null>(null);

function triggerImport() {
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
    fileInputRef.value.click();
  }
}

function handleFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      if (!data || typeof data !== 'object' || !Array.isArray(data.holdings) || !data.cash) {
        MessagePlugin.error('快照文件解析失败：缺少持仓或资金字段');
        return;
      }
      const dialog = DialogPlugin.confirm({
        header: '确认导入并恢复快照？',
        body: `检测到快照包含 ${data.holdings.length} 条持仓、${data.transactions?.length || 0} 笔交易记录。导入将覆盖当前浏览器数据，确认执行？`,
        confirmBtn: '确认恢复',
        cancelBtn: '取消',
        onConfirm: () => {
          const res = invest.restoreSnapshot(data);
          if (res.success) {
            MessagePlugin.success(
              `已成功恢复快照：${res.counts?.holdings ?? 0} 只持仓、${res.counts?.transactions ?? 0} 笔交易流水`,
            );
          } else {
            MessagePlugin.error(res.message);
          }
          dialog.destroy();
        },
      });
    } catch {
      MessagePlugin.error('无法解析该快照文件，请确保其为有效的 JSON 格式');
    }
  };
  reader.readAsText(file);
}
</script>
<style scoped>
.dash-action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.dash-slogan {
  font-size: 13px;
  color: var(--td-text-color-secondary);
}

.dash-btn-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

@media (width <= 767px) {
  .dash-action-bar {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .dash-btn-group {
    width: 100%;
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 4px;
    -webkit-overflow-scrolling: touch;

    :deep(.t-button) {
      flex-shrink: 0;
    }
  }
}
</style>
