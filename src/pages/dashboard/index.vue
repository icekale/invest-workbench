<template>
  <t-space direction="vertical" :size="16" style="width: 100%">
    <div class="dash-action-bar">
      <div class="dash-btn-group">
        <t-button variant="outline" size="small" :loading="invest.quoteLoading" @click="refresh()">
          <template #icon><t-icon name="refresh" /></template>
          刷新行情
        </t-button>
        <t-button theme="primary" size="small" @click="invest.openTradeModal({ account: tab as AccountId })">
          <template #icon><t-icon name="swap" /></template>
          模拟下单
        </t-button>
        <t-dropdown trigger="click" :min-column-width="140">
          <t-button variant="outline" size="small">
            <template #icon><t-icon name="setting" /></template>
            账户管理
            <template #suffix><t-icon name="chevron-down" /></template>
          </t-button>
          <template #dropdown>
            <t-dropdown-item @click="editOpen = true"> <t-icon name="edit" />手工校准持仓 </t-dropdown-item>
            <t-dropdown-item @click="ocrOpen = true"> <t-icon name="scan" />截图导入持仓 </t-dropdown-item>
            <t-dropdown-item @click="exportSnap"> <t-icon name="download" />导出快照 </t-dropdown-item>
            <t-dropdown-item @click="triggerImport"> <t-icon name="upload" />导入快照 </t-dropdown-item>
            <t-dropdown-item divided @click="manageOpen = true"> <t-icon name="setting" />管理账户 </t-dropdown-item>
          </template>
        </t-dropdown>
      </div>
    </div>
    <t-alert v-if="closed" theme="warning" message="今日休市，展示最近交易日收盘价" />
    <t-tabs v-model="tab" @change="onTab">
      <t-tab-panel v-for="acc in invest.activeAccounts" :key="acc.id" :value="acc.id" :label="acc.name">
        <account-panel
          :account="acc.id"
          :title="acc.name"
          :rows="invest.rowsOf(acc.id)"
          :cash="invest.cash[acc.id] ?? 0"
          @edit="editOpen = true"
        />
      </t-tab-panel>
    </t-tabs>
    <holdings-editor v-model:visible="editOpen" />
    <import-holdings-ocr v-model:visible="ocrOpen" />
    <manage-accounts-dialog v-model:visible="manageOpen" />
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
import { onMounted, onUnmounted, ref, watch } from 'vue';

import { useInvestStore } from '@/store';
import type { AccountId } from '@/types/invest';
import { fetchTradeMonth } from '@/utils/backup';
import { bindCloudSync } from '@/utils/cloud-sync';

import AccountPanel from './AccountPanel.vue';
import HoldingsEditor from './HoldingsEditor.vue';
import ImportHoldingsOcr from './ImportHoldingsOcr.vue';
import ManageAccountsDialog from './ManageAccountsDialog.vue';

defineOptions({ name: 'DashboardIndex' });

const invest = useInvestStore();
// ?tab=<账户 id> 只在它确实是当前活跃账户时才认 —— 否则归档/改名过的旧链接会开出空白页
const wantedTab = new URLSearchParams(window.location.search).get('tab');
const tab = ref<AccountId>(
  invest.activeAccounts.some((a) => a.id === wantedTab)
    ? (wantedTab as AccountId)
    : (invest.activeAccounts[0]?.id ?? 'stock'),
);
watch(
  () => invest.activeAccounts.map((a) => a.id).join(','),
  () => {
    if (!invest.activeAccounts.some((a) => a.id === tab.value)) {
      tab.value = invest.activeAccounts[0]?.id ?? 'stock';
    }
  },
);
const editOpen = ref(false);
const ocrOpen = ref(false);
const manageOpen = ref(false);
const closed = ref(false);
let timer = 0;

onMounted(async () => {
  await refresh(true);
  await bindCloudSync(invest);
  remindBackupIfNeeded();
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

let backupReminded = false;
/** 云端 SQLite 同步失败时，超过 7 天未导出快照才提醒 */
function remindBackupIfNeeded() {
  if (backupReminded) return;
  if (invest.prefs.lastCloudSyncAt && Date.now() - invest.prefs.lastCloudSyncAt < 7 * 86400_000) return;
  const last = invest.prefs.lastBackupAt ?? 0;
  if (Date.now() - last < 7 * 86400_000) return;
  backupReminded = true;
  MessagePlugin.warning('云端同步暂不可用，且超过 7 天未导出快照。建议点击「导出快照」存档。', 6000);
}

async function refresh(silent = false) {
  await invest.refreshQuotes();
  if (silent) return;
  MessagePlugin.success(
    invest.quoteAt ? `行情已更新 ${new Date(invest.quoteAt).toTimeString().slice(0, 5)}` : '行情已刷新',
  );
}

function onTab(value: string | number) {
  MessagePlugin.info(`已切换到${invest.accountName(value as AccountId)}`);
}

function exportSnap() {
  const blob = new Blob([JSON.stringify(invest.snapshot(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `invest-snapshot-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  invest.setPref('lastBackupAt', Date.now());
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
<style scoped lang="less">
.dash-action-bar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 8px;
}

.dash-btn-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;

  :deep(.t-button) {
    flex-shrink: 0;
    white-space: nowrap;

    .t-button__text {
      white-space: nowrap;
    }
  }
}

@media (width <= 767px) {
  .dash-action-bar {
    justify-content: flex-start;
    gap: 8px;
    margin-bottom: 2px;
  }

  .dash-btn-group {
    width: 100%;
    flex-wrap: nowrap;
    overflow-x: auto;
    gap: 8px;
    padding: 2px 0 6px;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }

    :deep(.t-button) {
      flex-shrink: 0;
      white-space: nowrap;
      height: 32px;
      padding: 0 10px;
      font-size: 13px;

      .t-button__text {
        white-space: nowrap;
        font-size: 13px;
        line-height: 32px;
      }
    }
  }
}
</style>
