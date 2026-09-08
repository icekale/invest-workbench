<template>
  <t-dialog v-model:visible="visible" header="编辑持仓" width="960" :footer="false">
    <t-form :data="form" layout="inline">
      <t-form-item name="account" label="账户">
        <t-select v-model="form.account" :options="accountOpts" style="width: 104px" />
      </t-form-item>
      <t-form-item name="code" label="代码">
        <t-input v-model="form.code" placeholder="510300 / sz000001" style="width: 170px" />
      </t-form-item>
      <t-form-item name="quantity" label="数量">
        <t-input-number v-model="form.quantity" :min="0" :decimal-places="0" style="width: 150px" />
      </t-form-item>
      <t-form-item name="cost" label="成本">
        <t-input-number v-model="form.cost" :min="0" :decimal-places="4" style="width: 150px" />
      </t-form-item>
      <t-form-item label="股票现金">
        <t-input-number
          :value="invest.cash.stock"
          :min="0"
          :decimal-places="0"
          style="width: 150px"
          @change="(v) => invest.setCash('stock', Number(v) || 0)"
        />
      </t-form-item>
      <t-form-item label="ETF 现金">
        <t-input-number
          :value="invest.cash.etf"
          :min="0"
          :decimal-places="0"
          style="width: 150px"
          @change="(v) => invest.setCash('etf', Number(v) || 0)"
        />
      </t-form-item>
      <t-form-item>
        <t-button theme="primary" :loading="saving" @click="onSubmit">保存</t-button>
      </t-form-item>
    </t-form>
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
  </t-dialog>
</template>
<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next';
import { computed, reactive, ref } from 'vue';

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
    await invest.refreshQuotes();
    MessagePlugin.success(`已保存 ${q.name}`);
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : '保存失败');
  } finally {
    saving.value = false;
  }
}
</script>
