<template>
  <t-space direction="vertical" :size="16" style="width: 100%">
    <div class="hold-toolbar">
      <t-radio-group v-model="accountView" variant="default-filled" size="small">
        <t-radio-button value="stock">股票账户</t-radio-button>
        <t-radio-button value="etf">ETF 账户</t-radio-button>
      </t-radio-group>
    </div>

    <!-- 顶部台账统计 KPI -->
    <t-row :gutter="[16, 16]">
      <t-col :xs="6" :sm="6" :xl="3">
        <t-card :bordered="false" class="ledger-kpi-card">
          <div class="kpi-label">累计买入额</div>
          <div class="kpi-value num-hero">{{ money(summary.totalBuyAmount) }}</div>
          <div class="kpi-tip">建仓与加仓成本总和</div>
        </t-card>
      </t-col>
      <t-col :xs="6" :sm="6" :xl="3">
        <t-card :bordered="false" class="ledger-kpi-card">
          <div class="kpi-label">累计卖出额</div>
          <div class="kpi-value num-hero">{{ money(summary.totalSellAmount) }}</div>
          <div class="kpi-tip">已落袋回收资金</div>
        </t-card>
      </t-col>
      <t-col :xs="6" :sm="6" :xl="3">
        <t-card :bordered="false" class="ledger-kpi-card">
          <div class="kpi-label">已实现盈亏</div>
          <div class="kpi-value num-hero" :style="{ color: pnlColor(summary.realizedPnL) }">
            {{ signed(summary.realizedPnL) }}
          </div>
          <div class="kpi-tip">佣金与税费 ¥{{ summary.totalFee.toFixed(2) }}</div>
        </t-card>
      </t-col>
      <t-col :xs="6" :sm="6" :xl="3">
        <t-card :bordered="false" class="ledger-kpi-card">
          <div class="kpi-label">区间换手率</div>
          <div class="kpi-value num-hero">{{ (summary.turnoverRate * 100).toFixed(1) }}%</div>
          <div class="kpi-tip">
            <t-tag size="small" variant="light" :theme="turnoverTag.theme">{{ turnoverTag.text }}</t-tag>
            共 {{ summary.tradeCount }} 笔流水
          </div>
        </t-card>
      </t-col>
    </t-row>

    <!-- 当前持仓 -->
    <t-card :title="`${accountLabel}持仓`">
      <template #actions>
        <span class="card-cap">现金 {{ money(activeCash) }} · 仓位 {{ posLabel }}</span>
      </template>
      <t-empty v-if="!activeRows.length" description="该账户暂无持仓，可用模拟下单或补录流水建仓" />
      <div v-else class="table-wrap">
        <t-table :data="activeRows" :columns="holdingCols" row-key="code" size="small" hover>
          <template #name="{ row }">
            <span class="symbol-name">{{ row.name }}</span>
            <span class="symbol-code">{{ shortCode(row.code) }}</span>
          </template>
          <template #quantity="{ row }">{{ Number(row.quantity).toLocaleString('zh-CN') }}</template>
          <template #cost="{ row }">¥{{ Number(row.cost).toFixed(2) }}</template>
          <template #last="{ row }">{{ row.last == null ? '—' : `¥${Number(row.last).toFixed(2)}` }}</template>
          <template #mv="{ row }">{{ money(row.marketValue) }}</template>
          <template #weight="{ row }">{{ weightOf(row.marketValue) }}</template>
          <template #pnl="{ row }">
            <div class="pnl-cell" :style="{ color: pnlColor(row.pnl) }">
              <span>{{ signed(row.pnl) }}</span>
              <span v-if="row.pnlPct != null" class="pnl-pct">({{ pct(row.pnlPct) }})</span>
            </div>
          </template>
          <template #op="{ row }">
            <t-space :size="4">
              <t-link theme="danger" hover="color" @click="tradeRow(row, 'buy')">买</t-link>
              <t-link theme="success" hover="color" @click="tradeRow(row, 'sell')">卖</t-link>
            </t-space>
          </template>
        </t-table>
      </div>
    </t-card>

    <!-- 台账管理与操作卡片 -->
    <t-card title="成交明细与台账管理">
      <template #actions>
        <t-space :size="8">
          <t-button size="small" theme="primary" @click="invest.openTradeModal({ account: accountView })">
            <template #icon><t-icon name="swap" /></template>
            模拟下单交易
          </t-button>
          <t-button size="small" theme="default" variant="outline" @click="openAddDialog">
            <template #icon><t-icon name="add" /></template>
            补录历史流水
          </t-button>
          <t-button size="small" theme="default" variant="outline" @click="importOpen = true">
            <template #icon><t-icon name="upload" /></template>
            导入对账单
          </t-button>
          <t-popconfirm
            content="确定根据上述所有成交流水，重新推算并覆盖当前持仓成本与数量吗？"
            @confirm="handleApplyHoldings"
          >
            <t-button size="small" theme="warning" variant="outline">
              <template #icon><t-icon name="refresh" /></template>
              自动重算持仓
            </t-button>
          </t-popconfirm>
        </t-space>
      </template>

      <!-- 筛选栏 -->
      <div class="filter-bar">
        <t-space :size="12" align="center" style="flex-wrap: wrap">
          <t-radio-group v-model="sideFilter" variant="default-filled" size="small">
            <t-radio-button value="all">全部方向</t-radio-button>
            <t-radio-button value="buy">买入</t-radio-button>
            <t-radio-button value="sell">卖出</t-radio-button>
          </t-radio-group>
          <t-input v-model="keyword" placeholder="搜索标的名称/代码..." size="small" clearable style="width: 180px">
            <template #prefix-icon><t-icon name="search" /></template>
          </t-input>
        </t-space>
      </div>

      <!-- 流水表格 -->
      <div class="table-wrap">
        <t-table
          :data="filteredTransactions"
          :columns="columns"
          row-key="id"
          size="small"
          hover
          :pagination="{ pageSize: 10, total: filteredTransactions.length }"
        >
          <template #side="{ row }">
            <t-tag size="small" :theme="row.side === 'buy' ? 'danger' : 'success'" variant="light">
              {{ row.side === 'buy' ? '买入' : '卖出' }}
            </t-tag>
          </template>
          <template #name="{ row }">
            <span class="symbol-name">{{ row.name }}</span>
            <span class="symbol-code">{{ shortCode(row.code) }}</span>
          </template>
          <template #price="{ row }">¥{{ Number(row.price).toFixed(2) }}</template>
          <template #quantity="{ row }">{{ Number(row.quantity).toLocaleString('zh-CN') }}</template>
          <template #amount="{ row }">{{ money(row.amount) }}</template>
          <template #fee="{ row }">¥{{ Number(row.fee || 0).toFixed(2) }}</template>
          <template #op="{ row }">
            <t-popconfirm content="确定删除此条流水？" @confirm="invest.removeTransaction(row.id)">
              <t-link theme="danger" hover="color">删除</t-link>
            </t-popconfirm>
          </template>
        </t-table>
      </div>
    </t-card>

    <!-- 单笔记账弹窗 -->
    <t-dialog
      v-model:visible="addOpen"
      header="录入成交流水"
      width="min(500px, 94vw)"
      :confirm-btn="{ content: '保存流水', theme: 'primary' }"
      :on-confirm="saveSingleTransaction"
    >
      <t-form :data="formData" label-width="80px" style="margin-top: 12px">
        <t-form-item label="交易日期">
          <t-input v-model="formData.date" placeholder="YYYY-MM-DD" />
        </t-form-item>
        <t-form-item label="归属账户">
          <t-radio-group v-model="formData.account">
            <t-radio value="stock">股票账户</t-radio>
            <t-radio value="etf">ETF 账户</t-radio>
          </t-radio-group>
        </t-form-item>
        <t-form-item label="买卖方向">
          <t-radio-group v-model="formData.side">
            <t-radio value="buy">买入</t-radio>
            <t-radio value="sell">卖出</t-radio>
          </t-radio-group>
        </t-form-item>
        <t-form-item label="标的代码">
          <t-input v-model="formData.code" placeholder="如 sh600519 或 510300" @change="autoFillName" />
        </t-form-item>
        <t-form-item label="标的名称">
          <t-input v-model="formData.name" placeholder="如 贵州茅台 / 300ETF" />
        </t-form-item>
        <t-form-item label="成交单价">
          <t-input-number v-model="formData.price" :min="0.001" :decimal-places="3" style="width: 100%" />
        </t-form-item>
        <t-form-item label="成交数量">
          <t-input-number v-model="formData.quantity" :min="1" :step="100" style="width: 100%" />
        </t-form-item>
        <t-form-item label="佣金税费">
          <t-input-number v-model="formData.fee" :min="0" :decimal-places="2" style="width: 100%" />
        </t-form-item>
        <t-form-item label="交易备注">
          <t-input v-model="formData.note" placeholder="如 逢低分批建仓 / 止盈减仓" />
        </t-form-item>
      </t-form>
    </t-dialog>

    <!-- 导入对账单弹窗 -->
    <t-dialog
      v-model:visible="importOpen"
      header="批量导入成交对账单"
      width="min(680px, 94vw)"
      :confirm-btn="{ content: '解析并导入', theme: 'primary' }"
      :on-confirm="handleBatchImport"
    >
      <div class="import-dialog-body">
        <t-alert
          theme="info"
          message="支持粘贴 CSV、Excel 表格复制数据。格式规范：日期, 账户(股票/ETF), 代码, 名称, 方向(买入/卖出), 单价, 数量, 手续费(可选)"
          style="margin-bottom: 12px"
        />
        <div class="import-actions">
          <t-button size="small" variant="text" theme="primary" @click="loadSampleCsv">填入示例数据</t-button>
          <t-checkbox v-model="syncHoldingsOnImport">导入后立即自动重算并同步当前持仓</t-checkbox>
        </div>
        <t-textarea
          v-model="importText"
          :autosize="{ minRows: 8, maxRows: 14 }"
          placeholder="在此粘贴成交记录文本或 CSV 内容..."
          style="margin-top: 8px; font-family: var(--td-font-family-mono); font-size: 12px"
        />
        <div v-if="parseResult.errors.length" class="import-errors">
          <div class="error-title">解析提示：</div>
          <div v-for="(err, idx) in parseResult.errors" :key="idx" class="error-item">{{ err }}</div>
        </div>
      </div>
    </t-dialog>
  </t-space>
</template>
<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next';
import { computed, reactive, ref } from 'vue';

import { useInvestStore } from '@/store';
import type { AccountId, TradeSide } from '@/types/invest';
import { summarize } from '@/utils/book';
import { todayCN } from '@/utils/date';
import { calculateLedger, parseTransactionsCsv } from '@/utils/ledger';

defineOptions({ name: 'TransactionLedger' });

const invest = useInvestStore();

const accountView = ref<AccountId>('stock');
const sideFilter = ref<'all' | TradeSide>('all');
const keyword = ref('');

const addOpen = ref(false);
const importOpen = ref(false);
const importText = ref('');
const syncHoldingsOnImport = ref(true);

const parseResult = reactive<{ errors: string[] }>({ errors: [] });

const formData = reactive({
  date: todayCN(),
  account: 'stock' as AccountId,
  code: '',
  name: '',
  side: 'buy' as TradeSide,
  price: 10,
  quantity: 100,
  fee: 5,
  note: '',
});

const activeRows = computed(() => (accountView.value === 'etf' ? invest.etfRows : invest.stockRows));
const activeCash = computed(() => (accountView.value === 'etf' ? invest.cash.etf : invest.cash.stock));
const accountLabel = computed(() => (accountView.value === 'etf' ? 'ETF 账户' : '股票账户'));
const book = computed(() => summarize(activeRows.value, activeCash.value));
const posLabel = computed(() => (book.value.pos == null ? '—' : `${(book.value.pos * 100).toFixed(1)}%`));
const bookTotal = computed(() => {
  const mv = activeRows.value.reduce((s, r) => s + (r.marketValue ?? 0), 0);
  return mv + Math.max(0, activeCash.value);
});
const accountTx = computed(() => invest.transactions.filter((tx) => tx.account === accountView.value));
const summary = computed(() => {
  const mv = activeRows.value.reduce((s, r) => s + (r.marketValue ?? r.cost * r.quantity), 0);
  return calculateLedger(accountTx.value, mv);
});

const turnoverTag = computed(() => {
  const rate = summary.value.turnoverRate;
  if (rate < 0.2) return { theme: 'default' as const, text: '低频长期定投' };
  if (rate <= 0.8) return { theme: 'primary' as const, text: '稳健平衡调仓' };
  return { theme: 'warning' as const, text: '高频活跃轮动' };
});

const filteredTransactions = computed(() => {
  return accountTx.value.filter((tx) => {
    if (sideFilter.value !== 'all' && tx.side !== sideFilter.value) return false;
    if (keyword.value.trim()) {
      const q = keyword.value.trim().toLowerCase();
      return tx.name.toLowerCase().includes(q) || tx.code.toLowerCase().includes(q);
    }
    return true;
  });
});

const holdingCols = [
  { colKey: 'name', title: '名称 / 代码' },
  { colKey: 'quantity', title: '持仓量', width: 90 },
  { colKey: 'cost', title: '成本', width: 90 },
  { colKey: 'last', title: '现价', width: 90 },
  { colKey: 'mv', title: '市值', width: 110 },
  { colKey: 'weight', title: '占比', width: 72 },
  { colKey: 'pnl', title: '浮动盈亏', width: 130 },
  { colKey: 'op', title: '交易', width: 72 },
];

const columns = [
  { colKey: 'date', title: '成交日期', width: 105 },
  { colKey: 'side', title: '方向', width: 70 },
  { colKey: 'name', title: '标的', minWidth: 120 },
  { colKey: 'price', title: '单价', width: 95 },
  { colKey: 'quantity', title: '数量', width: 95 },
  { colKey: 'amount', title: '成交额', width: 110 },
  { colKey: 'fee', title: '费用', width: 80 },
  { colKey: 'note', title: '备注', ellipsis: true },
  { colKey: 'op', title: '操作', width: 60 },
];

const money = (n: number | null) => (n == null ? '—' : `¥${n.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`);
const signed = (n: number | null) =>
  n == null ? '—' : `${n >= 0 ? '+' : '-'}¥${Math.abs(n).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
const pct = (n: number | null) => (n == null ? '—' : `${n > 0 ? '+' : ''}${(n * 100).toFixed(2)}%`);
const pnlColor = (n: number | null) => {
  if (n == null || n === 0) return 'var(--guanlan-muted)';
  return n > 0 ? 'var(--guanlan-red)' : 'var(--guanlan-green)';
};
const shortCode = (c: string) => c.replace(/^(sh|sz|bj)/i, '');
function weightOf(mv: number | null) {
  if (mv == null || !bookTotal.value) return '—';
  return `${((mv / bookTotal.value) * 100).toFixed(1)}%`;
}

function tradeRow(row: { code: string; name: string; last: number | null; quantity: number }, side: TradeSide) {
  invest.openTradeModal({
    account: accountView.value,
    side,
    code: row.code,
    name: row.name,
    price: row.last || 0,
    quantity: side === 'sell' ? Math.min(100, row.quantity) : 100,
  });
}

function openAddDialog() {
  formData.date = todayCN();
  formData.account = accountView.value;
  formData.code = '';
  formData.name = '';
  formData.price = 10;
  formData.quantity = 100;
  formData.fee = 5;
  formData.note = '';
  addOpen.value = true;
}

function autoFillName() {
  if (!formData.code) return;
  const holding = invest.holdings.find((h) => h.code.includes(formData.code) || formData.code.includes(h.code));
  if (holding) {
    formData.name = holding.name;
    formData.account = holding.account;
  }
}

function saveSingleTransaction() {
  if (!formData.code.trim()) {
    MessagePlugin.warning('请填写标的代码');
    return false;
  }
  let code = formData.code.trim().toLowerCase();
  if (!code.startsWith('sh') && !code.startsWith('sz') && !code.startsWith('bj')) {
    if (code.startsWith('6') || code.startsWith('5')) code = `sh${code}`;
    else if (code.startsWith('0') || code.startsWith('3') || code.startsWith('1')) code = `sz${code}`;
  }

  invest.addTransaction({
    date: formData.date,
    account: formData.account,
    code,
    name: formData.name.trim() || code,
    side: formData.side,
    price: formData.price,
    quantity: formData.quantity,
    fee: formData.fee,
    note: formData.note.trim(),
  });

  addOpen.value = false;
  MessagePlugin.success('已记录成交流水');
  return true;
}

function loadSampleCsv() {
  importText.value = `日期,账户,代码,名称,买卖,成交价,成交量,手续费,备注
2025-02-18,股票,sh600900,长江电力,买入,28.50,1000,5.00,防御性现金流
2025-02-20,ETF,sh510300,300ETF,买入,3.82,5000,3.50,定投执行
2025-02-24,股票,sh600519,贵州茅台,卖出,1720,10,12.00,阶段止盈`;
}

function handleBatchImport() {
  if (!importText.value.trim()) {
    MessagePlugin.warning('请输入或粘贴对账单内容');
    return false;
  }

  const res = parseTransactionsCsv(importText.value.trim());
  parseResult.errors = res.errors;

  if (!res.success) {
    MessagePlugin.error('解析失败，请检查数据格式');
    return false;
  }

  invest.importTransactions(res.rows, syncHoldingsOnImport.value);
  importOpen.value = false;
  importText.value = '';
  MessagePlugin.success(
    `成功导入 ${res.rows.length} 笔交易记录${syncHoldingsOnImport.value ? '，并已同步持仓成本' : ''}`,
  );
  return true;
}

function handleApplyHoldings() {
  invest.applyTransactionsToHoldings();
  MessagePlugin.success('已根据全部交易流水重新计算并同步持仓');
}
</script>
<style scoped>
.ledger-kpi-card {
  background: var(--guanlan-surface-soft);
  border-radius: 8px;
  padding: 14px 16px;
}

.kpi-label {
  font-size: 12px;
  color: var(--guanlan-muted);
  margin-bottom: 4px;
}

.kpi-value {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.25;
}

.kpi-tip {
  margin-top: 6px;
  font-size: 12px;
  color: var(--guanlan-muted);
  display: flex;
  align-items: center;
  gap: 6px;
}

.hold-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.card-cap {
  font-size: 12px;
  color: var(--guanlan-muted);
}

.pnl-cell {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
  font-variant-numeric: tabular-nums;
}

.pnl-pct {
  font-size: 12px;
  opacity: 0.85;
}

.filter-bar {
  margin-bottom: 14px;
}

.symbol-name {
  font-weight: 500;
  color: var(--guanlan-ink);
  margin-right: 6px;
}

.symbol-code {
  font-size: 12px;
  color: var(--guanlan-muted);
}

.table-wrap {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
}

.import-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
}

.import-errors {
  margin-top: 10px;
  padding: 8px 12px;
  background: var(--td-error-color-1);
  border-radius: var(--td-radius-small);
  font-size: 12px;
  color: var(--td-error-color);
}

.error-title {
  font-weight: 600;
  margin-bottom: 4px;
}
</style>
