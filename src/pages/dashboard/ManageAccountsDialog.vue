<template>
  <t-dialog v-model:visible="visible" header="管理账户" width="min(880px, 94vw)" :footer="false">
    <t-form :data="form" layout="inline" class="acct-form">
      <t-form-item label="名称">
        <t-input v-model="form.name" placeholder="如 打新账户" style="width: 170px" clearable />
      </t-form-item>
      <t-form-item label="类型">
        <t-radio-group v-model="form.kind" variant="default-filled" :disabled="!!editingId">
          <t-radio-button value="stock">股票</t-radio-button>
          <t-radio-button value="etf">ETF</t-radio-button>
          <t-radio-button value="fund">公募基金</t-radio-button>
        </t-radio-group>
      </t-form-item>
      <t-form-item label="费率">
        <t-input-number
          v-model="form.feePct"
          :min="0"
          :max="5"
          :decimal-places="3"
          suffix="%"
          placeholder="默认"
          style="width: 140px"
        />
      </t-form-item>
      <t-form-item>
        <t-space :size="8">
          <t-button theme="primary" @click="onSubmit">{{ editingId ? '保存修改' : '新建账户' }}</t-button>
          <t-button v-if="editingId" variant="outline" @click="resetForm">取消</t-button>
        </t-space>
      </t-form-item>
    </t-form>
    <p class="acct-hint">
      类型建好后不能改 —— 它决定三件事：报价来源（行情/净值）、能不能小数、有没有 5 元最低佣金。 股票与 ETF 看行情、整手
      100；公募基金看每日净值、份额可小数、收申购费。要换类型就新建一个账户，再把持仓挪过去。
    </p>

    <t-table :data="rows" :columns="cols" row-key="id" size="small" style="margin-top: 12px">
      <template #kind="{ row }">
        <t-tag size="small" variant="light" :theme="kindTheme(row.kind)">{{ kindLabel(row.kind) }}</t-tag>
      </template>
      <template #fee="{ row }">{{ (row.feeRate * 100).toFixed(3) }}%</template>
      <template #cash="{ row }">{{ row.cash.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) }}</template>
      <template #status="{ row }">
        <t-tag size="small" variant="light" :theme="row.archived ? 'default' : 'success'">
          {{ row.archived ? '已归档' : '使用中' }}
        </t-tag>
      </template>
      <template #op="{ row }">
        <t-space :size="12">
          <t-link theme="primary" @click="edit(row)">编辑</t-link>
          <t-popconfirm
            v-if="!row.archived"
            content="归档后从账户列表收起，持仓、账本、现金全部保留。"
            @confirm="setArchived(row.id, true)"
          >
            <t-link theme="warning">归档</t-link>
          </t-popconfirm>
          <t-link v-else theme="primary" @click="setArchived(row.id, false)">恢复</t-link>
        </t-space>
      </template>
    </t-table>
    <p class="acct-hint">账户不能删除：账本记的是钱，删了就找不回。不需要的账户归档即可，历史照旧可查。</p>

    <div class="backup-block">
      <div class="backup-title">备份与恢复</div>
      <div class="backup-row">
        <span class="backup-label">云同步</span>
        <span class="backup-val">{{ lastSyncText }}</span>
        <t-button size="small" variant="outline" :loading="syncing" @click="syncNow">立即同步</t-button>
      </div>
      <div class="backup-row">
        <span class="backup-label">本地快照</span>
        <t-space :size="8">
          <t-button size="small" variant="outline" @click="exportSnap">导出快照</t-button>
          <t-button size="small" variant="outline" @click="fileInput?.click()">导入快照</t-button>
        </t-space>
        <input
          ref="fileInput"
          type="file"
          accept=".json,application/json"
          style="display: none"
          @change="onFileChange"
        />
      </div>
      <p class="backup-hint">
        数据自动同步到服务器；快照是独立副本，不依赖服务器。建议每周导出一份存到网盘或本地。导入会覆盖当前浏览器数据。
      </p>
    </div>
  </t-dialog>
</template>
<script setup lang="ts">
import { DialogPlugin, MessagePlugin } from 'tdesign-vue-next';
import { computed, reactive, ref } from 'vue';

import { useInvestStore } from '@/store';
import type { AccountId, AccountKind } from '@/types/invest';
import { rateOf } from '@/utils/accounts';
import { hydrateFromCloud } from '@/utils/cloud-sync';
import { formatCN } from '@/utils/date';

const visible = defineModel<boolean>({ default: false });
const invest = useInvestStore();

/* 备份与恢复 */
const syncing = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const lastSyncText = computed(() => {
  const ts = invest.prefs.lastCloudSyncAt;
  if (!ts) return '尚未同步';
  return `上次同步 ${formatCN(ts)} ${new Date(ts).toTimeString().slice(0, 5)}`;
});

async function syncNow() {
  syncing.value = true;
  try {
    const action = await hydrateFromCloud(invest);
    if (action === 'pull') MessagePlugin.success('已从云端恢复最新数据');
    else if (action === 'push') MessagePlugin.success('本地数据已推送到云端');
    else if (action === 'noop') MessagePlugin.info('云端与本地数据一致');
    else MessagePlugin.error('同步服务未连接');
  } finally {
    syncing.value = false;
  }
}

function exportSnap() {
  const blob = new Blob([JSON.stringify(invest.snapshot(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `invest-snapshot-${formatCN(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  invest.setPref('lastBackupAt', Date.now());
  MessagePlugin.success('快照已下载');
}

function onFileChange(e: Event) {
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
        body: `检测到快照包含 ${data.holdings.length} 条持仓、${data.transactions?.length || 0} 笔交易记录。导入将覆盖当前数据，确认执行？`,
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

const editingId = ref<AccountId | null>(null);
// t-input-number 的 v-model 不接受 null：留空用 undefined
const form = reactive({ name: '', kind: 'stock' as AccountKind, feePct: undefined as number | undefined });

const cols = [
  { colKey: 'name', title: '名称', minWidth: 130 },
  { colKey: 'kind', title: '类型', width: 80 },
  { colKey: 'fee', title: '费率', width: 90 },
  { colKey: 'cash', title: '现金', width: 110, align: 'right' as const },
  { colKey: 'holds', title: '持仓', width: 70, align: 'right' as const },
  { colKey: 'status', title: '状态', width: 88 },
  { colKey: 'op', title: '操作', width: 150 },
];

const rows = computed(() =>
  invest.accounts.map((a) => ({
    ...a,
    // 没自设费率时把按类型算出来的默认值显示出来，否则这一列全是空的
    feeRate: rateOf(invest.accounts, a.id),
    cash: invest.cash[a.id] ?? 0,
    holds: invest.holdings.filter((h) => h.account === a.id).length,
  })),
);

function resetForm() {
  editingId.value = null;
  form.name = '';
  form.kind = 'stock';
  form.feePct = undefined;
}

/* 三种性质三种口径：股票看行情整手、ETF 也是行情但有印花税差异、公募基金看每日净值。 */
const KIND_LABEL: Record<AccountKind, string> = { stock: '股票', etf: 'ETF', fund: '公募基金' };
const KIND_THEME: Record<AccountKind, 'default' | 'primary' | 'success'> = {
  stock: 'default',
  etf: 'primary',
  fund: 'success',
};

function kindLabel(kind: AccountKind): string {
  return KIND_LABEL[kind] ?? kind;
}

function kindTheme(kind: AccountKind) {
  return KIND_THEME[kind] ?? 'default';
}

function edit(row: (typeof rows.value)[number]) {
  editingId.value = row.id;
  form.name = row.name;
  form.kind = row.kind;
  form.feePct = row.feeRate * 100;
}

function onSubmit() {
  const name = form.name.trim();
  if (!name) {
    MessagePlugin.warning('账户名不能为空');
    return;
  }
  // 留空就交给 kind 的默认费率；填 0 是「这个账户免佣」，是有效输入
  const rate = form.feePct == null ? undefined : Math.max(0, Number((form.feePct / 100).toFixed(8)));
  try {
    if (editingId.value) {
      invest.renameAccount(editingId.value, name);
      invest.setAccountFee(editingId.value, rate);
      MessagePlugin.success(`已更新「${name}」`);
    } else {
      invest.addAccount({ name, kind: form.kind, feeRate: rate });
      MessagePlugin.success(`已新建「${name}」`);
    }
    resetForm();
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : '保存失败');
  }
}

function setArchived(id: AccountId, archived: boolean) {
  invest.archiveAccount(id, archived);
  if (editingId.value === id) resetForm();
}
</script>
<style scoped>
.acct-form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
}

.acct-hint {
  margin: 8px 0 0;
  color: var(--td-text-color-placeholder);
  font-size: 12px;
  line-height: 1.6;
}

.backup-block {
  margin-top: 16px;
  padding: 12px 14px;
  border: 1px dashed var(--td-component-stroke, #e2e8f0);
  border-radius: 8px;
}

.backup-title {
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.backup-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.backup-label {
  flex: 0 0 4.5em;
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.backup-val {
  flex: 1;
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.backup-hint {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--td-text-color-placeholder);
}
</style>
