<template>
  <div class="invest-page">
    <h1 class="invest-title">持有与复盘</h1>
    <p class="invest-sub">组合贡献、持仓论文、复盘日志。</p>

    <section class="invest-card" style="margin-bottom: 12px">
      <div class="invest-muted">投资组合</div>
      <p>
        股票 {{ money(stockMv) }} · ETF {{ money(etfMv) }}
        <span v-if="stockMv != null && etfMv != null && stockMv + etfMv > 0">
          （{{ pct(stockMv / (stockMv + etfMv)) }} / {{ pct(etfMv / (stockMv + etfMv)) }}）
        </span>
      </p>
      <t-table :data="invest.enriched" :columns="pnlCols" row-key="code" size="small">
        <template #pnl="{ row }">
          <span :class="pnlClass(row.pnl)">{{ money(row.pnl) }}</span>
        </template>
      </t-table>
    </section>

    <section class="invest-card" style="margin-bottom: 12px">
      <div class="invest-muted">论文追踪</div>
      <div v-for="th in invest.theses" :key="th.id" style="margin-top: 12px">
        <strong>{{ th.title }}</strong>
        <span class="invest-muted"> {{ th.code }}</span>
        <p class="invest-sub">{{ th.body }}</p>
        <t-select
          :value="th.status"
          :options="statusOpts"
          style="width: 140px"
          @change="(v) => invest.setThesisStatus(th.id, String(v) as 'valid' | 'watch' | 'invalid')"
        />
      </div>
    </section>

    <section class="invest-card">
      <div class="invest-muted">复盘日志</div>
      <t-textarea v-model="draft" placeholder="记下今天的判断" />
      <t-button style="margin: 8px 0" @click="saveJournal">记下</t-button>
      <p v-if="!invest.journal.length" class="invest-muted">还没有复盘记录</p>
      <p v-for="j in invest.journal" :key="j.id" class="invest-sub">{{ j.date }} — {{ j.body }}</p>
    </section>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';

import { useInvestStore } from '@/store';

defineOptions({ name: 'ReviewIndex' });

const invest = useInvestStore();
const draft = ref('');

const money = (n: number | null) => (n == null ? '—' : n.toLocaleString('zh-CN', { maximumFractionDigits: 0 }));
const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
const pnlClass = (n: number | null) => (n == null ? '' : n >= 0 ? 'invest-up' : 'invest-down');

const sumMv = (account: 'stock' | 'etf') => {
  const rows = invest.enriched.filter((r) => r.account === account);
  if (rows.every((r) => r.marketValue == null)) return null;
  return rows.reduce((s, r) => s + (r.marketValue ?? 0), 0);
};
const stockMv = computed(() => sumMv('stock'));
const etfMv = computed(() => sumMv('etf'));

const pnlCols = [
  { colKey: 'name', title: '名称' },
  { colKey: 'account', title: '账户' },
  { colKey: 'pnl', title: '盈亏贡献' },
];

const statusOpts = [
  { label: '成立', value: 'valid' },
  { label: '观察', value: 'watch' },
  { label: '证伪', value: 'invalid' },
];

function saveJournal() {
  const body = draft.value.trim();
  if (!body) return;
  invest.addJournal(body);
  draft.value = '';
}
</script>
