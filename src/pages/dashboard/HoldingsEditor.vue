<template>
  <t-dialog v-model:visible="visible" header="编辑持仓" width="min(960px, 94vw)" :footer="false">
    <t-form :data="form" layout="inline" class="editor-form">
      <t-form-item name="account" label="账户">
        <t-select v-model="form.account" :options="accountOpts" style="width: 104px" />
      </t-form-item>
      <t-form-item name="code" label="代码">
        <t-input v-model="form.code" placeholder="510300 / 600519" style="width: 170px" clearable @blur="lookupCode" />
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
        <t-input-number v-model="form.quantity" :min="0" :decimal-places="0" style="width: 150px" />
      </t-form-item>
      <t-form-item name="cost" label="成本">
        <t-input-number v-model="form.cost" :min="0" :decimal-places="4" style="width: 150px" />
      </t-form-item>
      <t-form-item :label="`股票现金 ¥${invest.cash.stock.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`">
        <t-input-number
          :value="invest.cash.stock"
          :min="0"
          :decimal-places="0"
          style="width: 220px"
          @change="(v) => invest.setCash('stock', Number(v) || 0)"
        />
      </t-form-item>
      <t-form-item :label="`ETF 现金 ¥${invest.cash.etf.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`">
        <t-input-number
          :value="invest.cash.etf"
          :min="0"
          :decimal-places="0"
          style="width: 220px"
          @change="(v) => invest.setCash('etf', Number(v) || 0)"
        />
      </t-form-item>
      <t-form-item>
        <t-button theme="primary" :loading="saving" @click="onSubmit">保存</t-button>
      </t-form-item>
    </t-form>
    <div class="table-wrap">
      <t-table :data="rows" :columns="cols" row-key="rowKey" size="small" style="margin-top: 16px">
        <template #account="{ row }">{{ row.account === 'stock' ? '股票' : 'ETF' }}</template>
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
import { fetchQuotes, normalizeCode } from '@/utils/quote';

const visible = defineModel<boolean>({ default: false });
const invest = useInvestStore();
const saving = ref(false);

const form = reactive({
  account: 'etf' as AccountId,
  code: '',
  quantity: 0,
  cost: 0,
});

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
    const map = await fetchQuotes([code]);
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

const accountOpts = [
  { label: '股票', value: 'stock' },
  { label: 'ETF', value: 'etf' },
];

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
    const map = await fetchQuotes([code]);
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
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
}

.code-preview-tip {
  margin-top: 4px;
}
</style>
