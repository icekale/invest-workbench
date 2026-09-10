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
  </t-dialog>
</template>
<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next';
import { computed, reactive, ref } from 'vue';

import { useInvestStore } from '@/store';
import type { AccountId, AccountKind } from '@/types/invest';
import { rateOf } from '@/utils/accounts';

const visible = defineModel<boolean>({ default: false });
const invest = useInvestStore();

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
</style>
