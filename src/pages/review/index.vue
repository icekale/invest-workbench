<template>
  <t-space direction="vertical" :size="16" style="width: 100%">
    <t-row :gutter="[16, 16]">
      <t-col :xs="12" :xl="6">
        <t-card title="股票账户">
          <div class="kpi-num num-hero">{{ money(stock.mv) }}</div>
          <div class="kpi-foot">
            <span class="pnl-span" :style="{ color: pnlColor(stock.pnl) }">
              盈亏 {{ signed(stock.pnl) }}<template v-if="stock.pnlPct != null"> ({{ pct(stock.pnlPct) }})</template>
            </span>
          </div>
          <div class="cash-row">
            <span class="cash-label"
              >现金 <b class="cash-amt">{{ money(invest.cash.stock) }}</b></span
            >
            <t-input-number
              :value="invest.cash.stock"
              :min="0"
              :step="10000"
              :decimal-places="0"
              theme="column"
              size="small"
              class="cash-stepper"
              @change="(v) => invest.setCash('stock', Number(v) || 0)"
            />
          </div>
        </t-card>
      </t-col>
      <t-col :xs="12" :xl="6">
        <t-card title="ETF 账户">
          <div class="kpi-num num-hero">{{ money(etf.mv) }}</div>
          <div class="kpi-foot">
            <span class="pnl-span" :style="{ color: pnlColor(etf.pnl) }">
              盈亏 {{ signed(etf.pnl) }}<template v-if="etf.pnlPct != null"> ({{ pct(etf.pnlPct) }})</template>
            </span>
          </div>
          <div class="cash-row">
            <span class="cash-label"
              >现金 <b class="cash-amt">{{ money(invest.cash.etf) }}</b></span
            >
            <t-input-number
              :value="invest.cash.etf"
              :min="0"
              :step="10000"
              :decimal-places="0"
              theme="column"
              size="small"
              class="cash-stepper"
              @change="(v) => invest.setCash('etf', Number(v) || 0)"
            />
          </div>
        </t-card>
      </t-col>
    </t-row>

    <!-- 投资组合全貌 -->
    <t-card title="投资组合持仓">
      <div class="hold-toolbar">
        <t-radio-group v-model="accountView" variant="default-filled" size="small">
          <t-radio-button value="stock">股票账户</t-radio-button>
          <t-radio-button value="etf">ETF 账户</t-radio-button>
        </t-radio-group>
        <t-radio-group v-model="holdView" variant="default-filled" size="small">
          <t-radio-button value="list">明细</t-radio-button>
          <t-radio-button value="weight">持仓占比</t-radio-button>
        </t-radio-group>
      </div>
      <t-empty v-if="!activeRows.length" description="暂无持仓数据" />
      <div v-else-if="holdView === 'weight'" class="weight-view">
        <div class="weight-stack" role="img" :aria-label="`${accountLabel}持仓占比`">
          <span
            v-for="a in allocItems"
            :key="a.name"
            class="weight-seg"
            :style="{ width: `${(a.pct * 100).toFixed(2)}%`, background: colorOf(a.name) }"
            :title="`${a.name} ${(a.pct * 100).toFixed(1)}%`"
          />
        </div>
        <div class="weight-rows">
          <div v-for="a in allocItems" :key="a.name" class="weight-row">
            <span class="dot" :style="{ background: colorOf(a.name) }" />
            <span class="w-name">{{ a.name }}</span>
            <div class="w-bar">
              <i :style="{ width: `${(a.pct * 100).toFixed(2)}%`, background: colorOf(a.name) }" />
            </div>
            <span class="w-pct">{{ (a.pct * 100).toFixed(1) }}%</span>
          </div>
        </div>
      </div>
      <div v-else class="table-wrap">
        <t-table :data="activeRows" :columns="cols" row-key="code" size="small" hover>
          <template #name="{ row }">
            <t-space align="center" :size="8">
              <span class="stock-name">{{ row.name }}</span>
              <t-tag size="small" variant="light">{{ shortCode(row.code) }}</t-tag>
            </t-space>
          </template>
          <template #quantity="{ row }">{{ row.quantity?.toLocaleString('zh-CN') }}</template>
          <template #cost="{ row }">¥{{ row.cost?.toFixed(2) }}</template>
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

    <transaction-ledger :account="accountView" />

    <t-card v-if="invest.todos.length" title="待办">
      <t-table :data="invest.todos" :columns="todoCols" row-key="id" size="small" hover>
        <template #name="{ row }">
          <span class="todo-name">{{ row.name }}</span>
          <span class="todo-code">{{ row.code || '—' }}</span>
        </template>
        <template #side="{ row }">
          <t-tag size="small" :theme="row.side === 'buy' ? 'danger' : 'success'" variant="light">
            {{ row.side === 'buy' ? '买' : '卖' }}
          </t-tag>
        </template>
        <template #quantity="{ row }">{{ Number(row.quantity).toLocaleString() }}</template>
        <template #status="{ row }">
          <t-tag size="small" :theme="row.status === 'open' ? 'warning' : 'success'" variant="outline">
            {{ row.status === 'open' ? '待执行' : '已完成' }}
          </t-tag>
        </template>
        <template #op="{ row }">
          <t-space :size="8">
            <t-link theme="primary" hover="color" @click="toggleTodo(row.id, row.status)">
              {{ row.status === 'open' ? '完成' : '重开' }}
            </t-link>
            <t-popconfirm content="删除待办？" @confirm="invest.removeTodo(row.id)">
              <t-link theme="danger" hover="color">删除</t-link>
            </t-popconfirm>
          </t-space>
        </template>
      </t-table>
    </t-card>

    <!-- 下半部分：投资论点与复盘日志 -->
    <t-row :gutter="[16, 16]">
      <!-- 投资论点 -->
      <t-col :xs="12" :xl="6">
        <t-card title="投资论点">
          <template #actions>
            <t-button size="small" theme="primary" @click="thOpen = true">记论点</t-button>
          </template>
          <div class="thesis-header-actions">
            <t-radio-group v-model="filter" variant="default-filled">
              <t-radio-button value="all">全部 ({{ invest.theses.length }})</t-radio-button>
              <t-radio-button value="valid">运行中</t-radio-button>
              <t-radio-button value="watch">待复核</t-radio-button>
              <t-radio-button value="invalid">已作废</t-radio-button>
            </t-radio-group>
          </div>

          <t-empty v-if="!theses.length" description="暂无该分类下的投资论点" style="padding: 24px 0" />
          <t-list v-else split>
            <t-list-item v-for="t in theses" :key="t.id">
              <div class="thesis-item">
                <div class="thesis-body">
                  <div class="thesis-title-line">
                    <strong>{{ t.title }}</strong>
                    <t-tag v-if="t.code" size="small" variant="light">{{ shortCode(t.code) }}</t-tag>
                  </div>
                  <p class="thesis-desc">{{ t.body }}</p>
                </div>
                <div class="thesis-ctrls">
                  <t-select
                    :value="t.status"
                    :options="statusOpts"
                    size="small"
                    style="width: 96px"
                    @change="(v) => invest.setThesisStatus(t.id, String(v) as ThesisStatus)"
                  />
                  <t-popconfirm content="确定删除此条投资论点？" @confirm="invest.removeThesis(t.id)">
                    <t-button size="small" variant="text" theme="danger">删除</t-button>
                  </t-popconfirm>
                </div>
              </div>
            </t-list-item>
          </t-list>
        </t-card>
      </t-col>

      <!-- 复盘日志 -->
      <t-col :xs="12" :xl="6">
        <t-card title="复盘日志">
          <template #actions>
            <span class="card-cap">目标每周 ≥3 篇</span>
          </template>
          <div class="journal-progress">
            <div class="journal-progress-label">
              <span>本周达成度</span>
              <strong>{{ weekLogs }} / 3 次</strong>
            </div>
            <t-progress :percentage="habitPct" :color="habitPct >= 100 ? 'var(--guanlan-accent)' : undefined" />
          </div>

          <!-- 日志列表 -->
          <t-empty v-if="!invest.journal.length" description="还没有写过复盘日志" style="padding: 16px 0" />
          <div v-else class="table-wrap" style="max-height: 280px; overflow-y: auto">
            <t-table :data="invest.journal" :columns="logCols" row-key="id" size="small">
              <template #op="{ row }">
                <t-popconfirm content="删除这条日志？" @confirm="invest.removeJournal(row.id)">
                  <t-link theme="danger" hover="color">删</t-link>
                </t-popconfirm>
              </template>
            </t-table>
          </div>

          <!-- 写一条 -->
          <div class="journal-form-card">
            <div class="journal-form-title">记一条决策或反思</div>
            <t-form class="journal-form" @submit.prevent="saveLog">
              <t-form-item label="主题" style="margin-bottom: 8px">
                <t-input v-model="topic" placeholder="例：减仓高估值成长，加仓红利底仓" @enter="saveLog" />
              </t-form-item>
              <t-form-item label="结论" style="margin-bottom: 8px">
                <t-input v-model="conclusion" placeholder="例：严守纪律，不追高" @enter="saveLog" />
              </t-form-item>
              <div class="journal-form-btn">
                <t-button theme="primary" :disabled="!topic.trim()" @click="saveLog">写一条</t-button>
              </div>
            </t-form>
          </div>
        </t-card>
      </t-col>
    </t-row>

    <!-- 记录论点弹窗 -->
    <t-dialog
      v-model:visible="thOpen"
      header="记录投资论点"
      width="min(560px, 94vw)"
      :confirm-btn="{ content: '保存论点', theme: 'primary' }"
      :on-confirm="saveThesis"
    >
      <t-form style="margin-top: 12px">
        <t-form-item label="论点核心">
          <t-input v-model="th.title" placeholder="例：长江电力：确定性充沛的长期自由现金流" @enter="saveThesis" />
        </t-form-item>
        <t-form-item label="关联标的">
          <t-input v-model="th.code" placeholder="sh600900 / 510300（可选）" @enter="saveThesis" />
        </t-form-item>
        <t-form-item label="核心论点">
          <t-textarea
            v-model="th.body"
            :autosize="{ minRows: 4, maxRows: 8 }"
            placeholder="写下买入的逻辑前提、估值底线、关键催化剂与卖出条件..."
          />
        </t-form-item>
      </t-form>
    </t-dialog>
  </t-space>
</template>
<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next';
import { computed, onMounted, reactive, ref, watch } from 'vue';

import TransactionLedger from '@/pages/plan/components/TransactionLedger.vue';
import { useInvestStore } from '@/store';
import type { ThesisStatus, TodoStatus, TradeSide } from '@/types/invest';
import { allocation, summarize } from '@/utils/book';
import { bareCode, fetchSwL1 } from '@/utils/sw-industry';

defineOptions({ name: 'ReviewIndex' });

const invest = useInvestStore();
const filter = ref<'all' | ThesisStatus>('all');
const accountView = ref<'stock' | 'etf'>('stock');
const holdView = ref<'list' | 'weight'>('list');
const topic = ref('');
const conclusion = ref('');
const thOpen = ref(false);
const th = reactive({ title: '', code: '', body: '' });

const swL1 = ref<Record<string, string>>({});

async function loadSwL1() {
  const codes = invest.holdings.filter((h) => h.account === 'stock').map((h) => h.code);
  if (!codes.length) {
    swL1.value = {};
    return;
  }
  try {
    swL1.value = await fetchSwL1(codes);
  } catch {
    /* 上游失败时仍用 tag */
  }
}

onMounted(() => {
  invest.refreshQuotes();
  void loadSwL1();
});
watch(
  () =>
    invest.holdings
      .filter((h) => h.account === 'stock')
      .map((h) => h.code)
      .join(','),
  () => void loadSwL1(),
);

const stock = computed(() => summarize(invest.stockRows, invest.cash.stock));
const etf = computed(() => summarize(invest.etfRows, invest.cash.etf));
const theses = computed(() =>
  filter.value === 'all' ? invest.theses : invest.theses.filter((t) => t.status === filter.value),
);
const weekLogs = computed(() => {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  return invest.journal.filter((j) => j.date >= key).length;
});
const habitPct = computed(() => Math.min(100, Math.round((weekLogs.value / 3) * 100)));

const activeRows = computed(() => (accountView.value === 'etf' ? invest.etfRows : invest.stockRows));
const activeCash = computed(() => (accountView.value === 'etf' ? invest.cash.etf : invest.cash.stock));
const bookTotal = computed(() => {
  const mv = activeRows.value.reduce((s, r) => s + (r.marketValue ?? 0), 0);
  return mv + Math.max(0, activeCash.value);
});
const allocItems = computed(() =>
  allocation(activeRows.value, activeCash.value, [], (p) => {
    if (accountView.value === 'etf') return p.tag || p.name;
    return swL1.value[bareCode(p.code)] || p.tag || p.name;
  }),
);
const accountLabel = computed(() => (accountView.value === 'etf' ? 'ETF 账户' : '股票账户'));

const PALETTE = ['#0d706d', '#3569bb', '#b8782d', '#d05b55', '#16815f', '#7abbb6', '#dfb56d', '#5b7c99'];
function colorOf(name: string) {
  if (name === '现金') return '#93a3ad';
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
function weightOf(mv: number | null) {
  if (mv == null || !bookTotal.value) return '—';
  return `${((mv / bookTotal.value) * 100).toFixed(1)}%`;
}

const money = (n: number | null) => (n == null ? '—' : `¥${n.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`);
const signed = (n: number | null) =>
  n == null ? '—' : `${n >= 0 ? '+' : '-'}¥${Math.abs(n).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
const pct = (n: number | null) => (n == null ? '—' : `${n > 0 ? '+' : ''}${(n * 100).toFixed(2)}%`);
const pnlColor = (n: number | null) => {
  if (n == null || n === 0) return 'var(--guanlan-muted)';
  return n > 0 ? 'var(--guanlan-red)' : 'var(--guanlan-green)';
};
const shortCode = (c: string) => c.replace(/^(sh|sz|bj)/i, '');

const cols = [
  { colKey: 'name', title: '名称 / 代码' },
  { colKey: 'quantity', title: '持仓量', width: 100 },
  { colKey: 'cost', title: '持仓成本', width: 100 },
  { colKey: 'mv', title: '市值', width: 120 },
  { colKey: 'weight', title: '占比', width: 80 },
  { colKey: 'pnl', title: '浮动盈亏' },
  { colKey: 'op', title: '交易', width: 72 },
];
const todoCols = [
  { colKey: 'name', title: '标的' },
  { colKey: 'side', title: '方向', width: 64 },
  { colKey: 'quantity', title: '数量', width: 90 },
  { colKey: 'reason', title: '原因' },
  { colKey: 'status', title: '状态', width: 88 },
  { colKey: 'op', title: '', width: 100 },
];
const logCols = [
  { colKey: 'date', title: '日期', width: 100 },
  { colKey: 'topic', title: '主题' },
  { colKey: 'conclusion', title: '结论' },
  { colKey: 'op', title: '操作', width: 60 },
];
const statusOpts = [
  { label: '运行中', value: 'valid' },
  { label: '待更新', value: 'watch' },
  { label: '已作废', value: 'invalid' },
];

function saveLog() {
  if (!topic.value.trim()) {
    MessagePlugin.warning('请填写复盘主题');
    return;
  }
  invest.addJournal(topic.value.trim(), conclusion.value.trim());
  topic.value = '';
  conclusion.value = '';
  MessagePlugin.success('已写入复盘日志');
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

function toggleTodo(id: string, status: TodoStatus) {
  invest.setTodoStatus(id, status === 'open' ? 'done' : 'open');
}

function saveThesis() {
  if (!th.title.trim() || !th.body.trim()) {
    MessagePlugin.warning('标题和论点必填');
    return false;
  }
  invest.addThesis(th.title.trim(), th.code.trim(), th.body.trim());
  thOpen.value = false;
  th.title = '';
  th.code = '';
  th.body = '';
  MessagePlugin.success('已保存投资论点');
  return true;
}
</script>
<style scoped>
.table-wrap {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
}

.kpi-num {
  font-size: 24px;
  font-weight: 600;
  color: var(--guanlan-ink);
  line-height: 1.2;
}

.kpi-unit {
  font-size: 14px;
  font-weight: 400;
  color: var(--guanlan-muted);
}

.kpi-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--guanlan-muted);
}

.cash-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  font-size: 13px;
  color: var(--guanlan-muted);
}

.cash-label {
  min-width: 0;
  flex: 1;
}

.cash-amt {
  color: var(--guanlan-ink);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.cash-stepper {
  width: 176px;
  flex: 0 0 176px;
}

.cash-stepper :deep(.t-input__inner) {
  text-overflow: clip;
}

.todo-name {
  font-weight: 600;
  margin-right: 8px;
}

.todo-code {
  font-family: var(--td-font-family-mono);
  font-size: 12px;
  color: var(--td-text-color-secondary, #4f5d67);
}

.dot-split {
  color: var(--guanlan-line);
}

.health-span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.health-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
}

.health-dot--good {
  background: var(--guanlan-green);
}

.health-dot--warn {
  background: var(--guanlan-amber);
}

.health-dot--alert {
  background: var(--guanlan-red);
}

.stock-name {
  font-weight: 500;
  color: var(--guanlan-ink);
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

.card-cap {
  font-size: 12px;
  color: var(--guanlan-muted);
}

.hold-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.weight-view {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.weight-stack {
  display: flex;
  height: 12px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--guanlan-surface-soft);
}

.weight-seg {
  height: 100%;
  min-width: 2px;
}

.weight-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.weight-row {
  display: grid;
  grid-template-columns: 8px minmax(72px, 1.2fr) minmax(80px, 2fr) 56px;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.w-name {
  color: var(--guanlan-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.w-bar {
  height: 8px;
  border-radius: 4px;
  background: var(--guanlan-surface-soft);
  overflow: hidden;
}

.w-bar i {
  display: block;
  height: 100%;
  border-radius: 4px;
}

.w-pct {
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--guanlan-ink);
}

.thesis-header-actions {
  margin-bottom: 12px;
}

.thesis-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.thesis-body {
  flex: 1;
  min-width: 0;
}

.thesis-title-line {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--guanlan-ink);
}

.thesis-desc {
  margin: 6px 0 0;
  color: var(--guanlan-muted);
  font-size: 14px;
  line-height: 1.55;
}

.thesis-ctrls {
  display: flex;
  align-items: center;
  gap: 8px;
  align-self: flex-start;
}

.journal-progress {
  padding: 12px 14px;
  background: var(--guanlan-surface-soft);
  border-radius: 8px;
  margin-bottom: 14px;
}

.journal-progress-label {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--guanlan-muted);
  margin-bottom: 6px;
}

.journal-progress-label strong {
  color: var(--guanlan-ink);
}

.journal-form-card {
  margin-top: 16px;
  padding: 14px;
  background: var(--guanlan-surface-soft);
  border-radius: 8px;
  border: 1px solid var(--guanlan-line);
}

.journal-form-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--guanlan-ink);
  margin-bottom: 10px;
}

.journal-form-btn {
  display: flex;
  justify-content: flex-end;
}

@media (width >= 768px) {
  .thesis-item {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
  }
}
</style>
