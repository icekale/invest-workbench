<template>
  <div class="invest-page">
    <h1 class="invest-title">投资驾驶舱</h1>
    <p class="invest-sub">
      股票与 ETF 同一套指标。现价来自腾讯行情。
      <t-button size="small" variant="outline" :loading="invest.quoteLoading" @click="invest.refreshQuotes()">
        刷新行情
      </t-button>
      <span v-if="invest.quoteError" class="invest-muted"> {{ invest.quoteError }}</span>
    </p>

    <div class="invest-card" style="margin-bottom: 12px">
      <div class="invest-grid-2">
        <div>
          <div class="invest-muted">两账户成本</div>
          <div class="invest-kpi">{{ money(totalCost) }}</div>
        </div>
        <div>
          <div class="invest-muted">两账户市值</div>
          <div class="invest-kpi">{{ money(totalMv) }}</div>
        </div>
        <div>
          <div class="invest-muted">浮动盈亏</div>
          <div class="invest-kpi" :class="pnlClass(totalPnl)">{{ money(totalPnl) }}</div>
        </div>
      </div>
    </div>

    <div class="invest-grid-2" style="margin-bottom: 12px">
      <account-panel title="股票账户" :rows="invest.stockRows" />
      <account-panel title="ETF 账户" :rows="invest.etfRows" />
    </div>

    <div class="invest-grid-2">
      <section class="invest-card">
        <div class="invest-muted">每日宏观</div>
        <div v-for="code in indexes" :key="code" style="margin-top: 8px">
          <strong>{{ invest.quotes[code]?.name || code }}</strong>
          <span :class="pnlClass(invest.quotes[code]?.changePct ?? null)">
            {{ invest.quotes[code] ? invest.quotes[code].price : '—' }}
            {{ invest.quotes[code] ? `${invest.quotes[code].changePct}%` : '' }}
          </span>
        </div>
        <p v-for="n in macroNotes" :key="n.id" class="invest-sub">{{ n.date }} · {{ n.title }} — {{ n.body }}</p>
      </section>
      <section class="invest-card">
        <div class="invest-muted">机会池</div>
        <t-table :data="opportunity" :columns="opCols" row-key="code" size="small" hover @row-click="goFund" />
      </section>
    </div>
  </div>
</template>
<script setup lang="ts">
import type { TableRowData } from 'tdesign-vue-next';
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';

import { indexes, macroNotes, opportunity } from '@/mock/invest';
import { useInvestStore } from '@/store';

import AccountPanel from './AccountPanel.vue';

defineOptions({ name: 'DashboardIndex' });

const invest = useInvestStore();
const router = useRouter();
onMounted(() => invest.refreshQuotes());

const money = (n: number | null) => (n == null ? '—' : n.toLocaleString('zh-CN', { maximumFractionDigits: 0 }));
const pnlClass = (n: number | null) => (n == null ? '' : n >= 0 ? 'invest-up' : 'invest-down');

const totalCost = computed(() => invest.enriched.reduce((s, r) => s + r.cost * r.quantity, 0));
const totalMv = computed(() =>
  invest.enriched.every((r) => r.marketValue == null)
    ? null
    : invest.enriched.reduce((s, r) => s + (r.marketValue ?? 0), 0),
);
const totalPnl = computed(() => (totalMv.value == null ? null : totalMv.value - totalCost.value));

const opCols = [
  { colKey: 'name', title: '基金' },
  { colKey: 'yield', title: '收益' },
  { colKey: 'vix', title: '波动' },
  { colKey: 'loss', title: '回撤' },
];

function goFund({ row }: { row: TableRowData }) {
  if (typeof row.code === 'string') router.push(`/funds/detail/${row.code}`);
}
</script>
