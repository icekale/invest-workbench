<template>
  <t-dialog v-model:visible="visible" header="编辑持仓" width="min(960px, 94vw)" :footer="false">
    <t-form :data="form" layout="inline" class="editor-form">
      <t-form-item name="account" label="账户">
        <t-select v-model="form.account" :options="accountOpts" />
      </t-form-item>
      <t-form-item name="code" label="代码">
        <t-input v-model="form.code" placeholder="510300 / 600519" clearable @blur="lookupCode" />
        <div v-if="previewInfo.name" class="code-preview-tip">
          <t-tag size="small" theme="primary" variant="light">
            {{ previewInfo.name }} · ¥{{ previewInfo.price.toFixed(3) }}
          </t-tag>
        </div>
        <div v-else-if="previewInfo.loading" class="code-preview-tip">
          <t-tag size="small" theme="default" variant="light">查询中...</t-tag>
        </div>
      </t-form-item>
      <t-form-item name="quantity" label="数量">
        <t-input-number v-model="form.quantity" :min="0" :decimal-places="0" />
      </t-form-item>
      <t-form-item name="cost" label="成本">
        <t-input-number v-model="form.cost" :min="0" :decimal-places="4" />
      </t-form-item>
      <!-- 标签只放静态文字。金额本来就绑在输入框上（:value="cashOf"),
           写进标签会让标签宽度跟着钱数变长，行与行的控件必然对不齐。 -->
      <t-form-item v-for="acc in invest.activeAccounts" :key="acc.id" :label="`${acc.name}现金`">
        <t-input-number
          :value="cashOf(acc.id)"
          :min="0"
          :decimal-places="0"
          @change="(v) => invest.setCash(acc.id, Number(v) || 0)"
        />
      </t-form-item>
      <t-form-item>
        <t-button theme="primary" :loading="saving" @click="onSubmit">保存</t-button>
      </t-form-item>
    </t-form>
    <div class="table-wrap">
      <t-table :data="rows" :columns="cols" row-key="rowKey" size="small" style="margin-top: 16px">
        <template #account="{ row }">{{ invest.accountName(row.account) }}</template>
        <template #op="{ row }">
          <t-space>
            <t-link theme="primary" @click="fill(row)">改</t-link>
            <t-popconfirm content="删除这行？" @confirm="remove(row)">
              <t-link theme="danger">删</t-link>
            </t-popconfirm>
          </t-space>
        </template>
      </t-table>
    </div>
  </t-dialog>
</template>
<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next';
import { computed, reactive, ref, watch } from 'vue';

import { useInvestStore } from '@/store';
import type { AccountId, Holding } from '@/types/invest';
import { fetchAnyQuotes, normalizeCode } from '@/utils/quote';

const visible = defineModel<boolean>({ default: false });
const invest = useInvestStore();
const saving = ref(false);

const form = reactive({
  account: '' as AccountId,
  code: '',
  quantity: 0,
  cost: 0,
});

// 新持仓默认落到第一个账户。等注册表从云端/备份恢复后，若当前选择已不存在，跟着修正
const cashOf = (id: AccountId) => invest.cash[id] ?? 0;
watch(
  () => invest.activeAccounts,
  (list) => {
    if (!list.some((a) => a.id === form.account)) form.account = list[0]?.id ?? 'stock';
  },
  { immediate: true },
);

const previewInfo = reactive({
  name: '',
  price: 0,
  loading: false,
});

let lookupTimer: number | null = null;
watch(
  () => form.code,
  (val) => {
    if (lookupTimer) clearTimeout(lookupTimer);
    const raw = val.trim();
    if (raw.length >= 6) {
      lookupTimer = window.setTimeout(lookupCode, 400);
    } else {
      previewInfo.name = '';
      previewInfo.price = 0;
    }
  },
);

async function lookupCode() {
  const code = normalizeCode(form.code);
  if (!code) return;
  previewInfo.loading = true;
  try {
    const map = await fetchAnyQuotes([code]);
    const q = map.get(code);
    if (q) {
      previewInfo.name = q.name;
      previewInfo.price = q.price;
      if (!form.cost) {
        form.cost = q.price;
      }
    } else {
      previewInfo.name = '';
    }
  } catch {
    previewInfo.name = '';
  } finally {
    previewInfo.loading = false;
  }
}

// 只能记到在用账户上；归档账户仍会被填回（fill）以支持迁移
const accountOpts = computed(() => invest.activeAccounts.map((a) => ({ label: a.name, value: a.id })));

const cols = [
  { colKey: 'account', title: '账户', width: 80 },
  { colKey: 'code', title: '代码', width: 120 },
  { colKey: 'name', title: '名称' },
  { colKey: 'quantity', title: '数量', width: 100 },
  { colKey: 'cost', title: '成本', width: 100 },
  { colKey: 'op', title: '操作', width: 100 },
];

const rows = computed(() => invest.holdings.map((h) => ({ ...h, rowKey: `${h.account}-${h.code}` })));

function fill(row: Holding) {
  form.account = row.account;
  form.code = row.code;
  form.quantity = row.quantity;
  form.cost = row.cost;
  previewInfo.name = row.name;
  const q = invest.quotes[row.code];
  previewInfo.price = q?.price ?? row.cost;
}

function remove(row: Holding) {
  invest.removeHolding(row.account, row.code);
  invest.refreshQuotes();
}

async function onSubmit() {
  const code = normalizeCode(form.code);
  if (!code || form.quantity <= 0 || form.cost <= 0) {
    MessagePlugin.warning('代码、数量、成本都要填');
    return;
  }
  saving.value = true;
  try {
    const map = await fetchAnyQuotes([code]);
    const q = map.get(code);
    if (!q) {
      MessagePlugin.error('腾讯行情查不到这个代码');
      return;
    }
    const prev = invest.holdings.find((h) => h.account === form.account && h.code === code);
    invest.upsertHolding({
      account: form.account,
      code,
      name: q.name,
      quantity: form.quantity,
      cost: form.cost,
      health: prev?.health ?? 'healthy',
      action: prev?.action ?? 'hold',
      thesisId: prev?.thesisId ?? '',
    });
    form.code = '';
    form.quantity = 0;
    form.cost = 0;
    previewInfo.name = '';
    previewInfo.price = 0;
    await invest.refreshQuotes();
    MessagePlugin.success(`已保存 ${q.name}`);
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : '保存失败');
  } finally {
    saving.value = false;
  }
}
</script>
<style scoped>
.table-wrap {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
}

.editor-form {
  /* 表单项的内容是「活的」（账户名、钱数都在变），而 TDesign 的 inline 布局是按内容撑宽的：
     每行第一项多宽，后面的控件就右移多少 —— 行与行永远对不齐。
     改成定宽网格：列宽由网格决定，与内容无关，列才对得上。 */
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: 12px 16px;
  align-items: center;
}

.editor-form :deep(.t-form__item) {
  display: flex;
  align-items: center;
  min-width: 0;
  margin: 0;
}

/* TDesign 把标签宽写成行内 style="width:100px"，而「公募基金账户现金」实测要 120px，
   多出来的字直接压到输入框上 —— 必须 !important 才盖得住行内样式。
   128px = 默认账户名里最长那个（7 字）+ 8px 余量；更长的自定义名截断，不撑破布局。 */
.editor-form :deep(.t-form__label) {
  flex: 0 0 128px !important;
  width: 128px !important;
  padding-right: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 控件左移量也是行内 style="margin-left:100px"，同样得 !important 压掉，控件才贴住标签列 */
.editor-form :deep(.t-form__controls) {
  flex: 1 1 auto;
  min-width: 0;
  margin-left: 0 !important;
}

.editor-form :deep(.t-form__controls-content) {
  width: 100%;
}

/* 控件原本行内各定各的宽（130/150/170/200），列宽参差；统一吃满控件列 */
.editor-form :deep(.t-input-number),
.editor-form :deep(.t-input),
.editor-form :deep(.t-select) {
  width: 100% !important;
}

.code-preview-tip {
  margin-top: 4px;
}
</style>
