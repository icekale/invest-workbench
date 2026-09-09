<template>
  <t-space direction="vertical" :size="16" style="width: 100%">
    <t-row :gutter="[16, 16]">
      <t-col :xs="12" :md="6">
        <div class="acct-tile">
          <div class="tile-head">
            <span class="dot stock" />
            <span>股票账户</span>
          </div>
          <div class="metric">
            <span>持仓市值</span>
            <b class="tabular-nums">¥{{ money(stock.mv) }}</b>
          </div>
          <div class="metric">
            <span>现金</span>
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
          <div class="metric total">
            <span>总资产</span>
            <b class="tabular-nums">¥{{ money((stock.mv || 0) + invest.cash.stock) }}</b>
          </div>
        </div>
      </t-col>
      <t-col :xs="12" :md="6">
        <div class="acct-tile">
          <div class="tile-head">
            <span class="dot etf" />
            <span>ETF 账户</span>
          </div>
          <div class="metric">
            <span>持仓市值</span>
            <b class="tabular-nums">¥{{ money(etf.mv) }}</b>
          </div>
          <div class="metric">
            <span>现金</span>
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
          <div class="metric total">
            <span>总资产</span>
            <b class="tabular-nums">¥{{ money((etf.mv || 0) + invest.cash.etf) }}</b>
          </div>
        </div>
      </t-col>
    </t-row>

    <transaction-ledger />

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
  </t-space>
</template>
<script setup lang="ts">
import type { PrimaryTableCol } from 'tdesign-vue-next';
import { computed, onMounted } from 'vue';

import { useInvestStore } from '@/store';
import type { TodoStatus } from '@/types/invest';
import { summarize } from '@/utils/book';

import TransactionLedger from './components/TransactionLedger.vue';

defineOptions({ name: 'PlanIndex' });

const invest = useInvestStore();
const stock = computed(() => summarize(invest.stockRows, invest.cash.stock));
const etf = computed(() => summarize(invest.etfRows, invest.cash.etf));
const money = (n: number | null) => (n == null ? '—' : n.toLocaleString('zh-CN', { maximumFractionDigits: 0 }));

const todoCols: PrimaryTableCol[] = [
  { colKey: 'name', title: '标的' },
  { colKey: 'side', title: '方向', width: 64 },
  { colKey: 'quantity', title: '数量', width: 90 },
  { colKey: 'reason', title: '原因' },
  { colKey: 'status', title: '状态', width: 88 },
  { colKey: 'op', title: '', width: 100 },
];

onMounted(() => invest.refreshQuotes());

function toggleTodo(id: string, status: TodoStatus) {
  invest.setTodoStatus(id, status === 'open' ? 'done' : 'open');
}
</script>
<style scoped lang="less">
.acct-tile {
  background: var(--td-bg-color-page, #f6f7f9);
  border: 1px solid var(--guanlan-line, #e6eaed);
  border-radius: 8px;
  padding: 14px 16px;
}

.tile-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-weight: 600;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;

  &.stock {
    background: #3569bb;
  }

  &.etf {
    background: var(--td-brand-color, #0d706d);
  }
}

.metric {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--td-text-color-secondary, #4f5d67);

  b {
    color: var(--td-text-color-primary, #14212b);
  }

  &.total {
    margin: 8px 0 0;
    padding-top: 8px;
    border-top: 1px dashed var(--guanlan-line, #e6eaed);

    b {
      font-size: 18px;
      color: var(--td-brand-color, #0d706d);
    }
  }
}

.cash-stepper {
  width: 140px;
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
</style>
