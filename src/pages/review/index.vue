<template>
  <t-space direction="vertical" :size="16" style="width: 100%">
    <span style="color: var(--td-text-color-secondary)">组合、论文和日志放在一起，方便回头看决策有没有被执行。</span>
    <t-row :gutter="[16, 16]">
      <t-col :xs="12" :xl="4">
        <t-card title="稳健复利组合" subtitle="股票账户">
          <t-statistic title="市值" :value="stock.mv ?? 0" :precision="2" />
          <p style="color: var(--td-text-color-secondary); margin-top: 8px">
            盈亏 {{ signed(stock.pnl) }} · 健康 {{ stockHealth.total }}
          </p>
        </t-card>
      </t-col>
      <t-col :xs="12" :xl="4">
        <t-card title="宽基 + 红利底仓" subtitle="ETF 账户">
          <t-statistic title="市值" :value="etf.mv ?? 0" :precision="2" />
          <p style="color: var(--td-text-color-secondary); margin-top: 8px">
            盈亏 {{ signed(etf.pnl) }} · 健康 {{ etfHealth.total }}
          </p>
        </t-card>
      </t-col>
      <t-col :xs="12" :xl="4">
        <t-card title="下一批机会" subtitle="机会池">
          <t-statistic title="条数" :value="invest.opportunities.length" />
          <p style="color: var(--td-text-color-secondary); margin-top: 8px">均分 {{ avgScore }}</p>
        </t-card>
      </t-col>
    </t-row>

    <t-card title="投资组合">
      <t-table :data="rows" :columns="cols" row-key="code">
        <template #mv="{ row }">{{ money(row.marketValue) }}</template>
        <template #pnl="{ row }">
          <span :style="{ color: pnlColor(row.pnl) }">{{ pct(row.pnlPct) }}</span>
        </template>
      </t-table>
    </t-card>

    <t-row :gutter="[16, 16]">
      <t-col :xs="12" :xl="6">
        <t-card title="投资论文">
          <template #actions>
            <t-button size="small" variant="outline" @click="thOpen = true">写论文</t-button>
          </template>
          <t-radio-group v-model="filter" variant="default-filled" style="margin-bottom: 12px">
            <t-radio-button value="all">全部</t-radio-button>
            <t-radio-button value="valid">运行中</t-radio-button>
            <t-radio-button value="watch">待更新</t-radio-button>
            <t-radio-button value="invalid">已作废</t-radio-button>
          </t-radio-group>
          <t-list split>
            <t-list-item v-for="t in theses" :key="t.id">
              <t-list-item-meta :title="t.title" :description="t.body" />
              <template #action>
                <t-space>
                  <t-tag size="small" variant="light">{{ statusLabel[t.status] }}</t-tag>
                  <t-select
                    :value="t.status"
                    :options="statusOpts"
                    size="small"
                    style="width: 96px"
                    @change="(v) => invest.setThesisStatus(t.id, String(v) as ThesisStatus)"
                  />
                </t-space>
              </template>
            </t-list-item>
          </t-list>
        </t-card>
      </t-col>
      <t-col :xs="12" :xl="6">
        <t-card title="复盘日志">
          <t-table :data="invest.journal" :columns="logCols" row-key="id" />
          <t-progress :percentage="habitPct" style="margin-top: 12px">
            <template #label>本周 {{ weekLogs }}/3</template>
          </t-progress>
          <t-form style="margin-top: 12px">
            <t-form-item label="主题">
              <t-input v-model="topic" />
            </t-form-item>
            <t-form-item label="结论">
              <t-input v-model="conclusion" />
            </t-form-item>
            <t-form-item>
              <t-button theme="primary" @click="saveLog">写一条</t-button>
            </t-form-item>
          </t-form>
        </t-card>
      </t-col>
    </t-row>

    <t-dialog v-model:visible="thOpen" header="写论文" :on-confirm="saveThesis">
      <t-form>
        <t-form-item label="标题">
          <t-input v-model="th.title" />
        </t-form-item>
        <t-form-item label="代码">
          <t-input v-model="th.code" placeholder="sz000001" />
        </t-form-item>
        <t-form-item label="正文">
          <t-textarea v-model="th.body" />
        </t-form-item>
      </t-form>
    </t-dialog>
  </t-space>
</template>
<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next';
import { computed, onMounted, reactive, ref } from 'vue';

import { useInvestStore } from '@/store';
import type { ThesisStatus } from '@/types/invest';
import { healthScore, summarize } from '@/utils/book';

defineOptions({ name: 'ReviewIndex' });

const invest = useInvestStore();
const filter = ref<'all' | ThesisStatus>('all');
const topic = ref('');
const conclusion = ref('');
const thOpen = ref(false);
const th = reactive({ title: '', code: '', body: '' });

onMounted(() => {
  invest.refreshQuotes();
});

const stock = computed(() => summarize(invest.stockRows, invest.cash.stock));
const etf = computed(() => summarize(invest.etfRows, invest.cash.etf));
const stockHealth = computed(() => healthScore(invest.stockRows, invest.theses, invest.journal, invest.cash.stock));
const etfHealth = computed(() => healthScore(invest.etfRows, invest.theses, invest.journal, invest.cash.etf));
const avgScore = computed(() => {
  const list = invest.opportunities;
  if (!list.length) return 0;
  return Math.round(list.reduce((s, o) => s + o.score, 0) / list.length);
});
const theses = computed(() =>
  filter.value === 'all' ? invest.theses : invest.theses.filter((t) => t.status === filter.value),
);
const weekLogs = computed(() => {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  const key = start.toISOString().slice(0, 10);
  return invest.journal.filter((j) => j.date >= key).length;
});
const habitPct = computed(() => Math.min(100, Math.round((weekLogs.value / 3) * 100)));

const rows = computed(() => [...invest.stockRows, ...invest.etfRows]);
const money = (n: number | null) => (n == null ? '—' : n.toLocaleString('zh-CN', { maximumFractionDigits: 0 }));
const signed = (n: number | null) =>
  n == null ? '—' : `${n >= 0 ? '+' : '-'}${Math.abs(n).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
const pct = (n: number | null) => (n == null ? '—' : `${n > 0 ? '+' : ''}${(n * 100).toFixed(2)}%`);
const pnlColor = (n: number | null) => {
  if (n == null) return undefined;
  return n >= 0 ? 'var(--td-error-color)' : 'var(--td-success-color)';
};

const cols = [
  { colKey: 'name', title: '名称' },
  { colKey: 'code', title: '代码' },
  { colKey: 'quantity', title: '数量' },
  { colKey: 'cost', title: '成本' },
  { colKey: 'mv', title: '市值' },
  { colKey: 'pnl', title: '盈亏' },
];
const logCols = [
  { colKey: 'date', title: '日期', width: 120 },
  { colKey: 'topic', title: '主题' },
  { colKey: 'conclusion', title: '结论', width: 120 },
];
const statusLabel: Record<string, string> = { valid: '运行中', watch: '待更新', invalid: '已作废' };
const statusOpts = [
  { label: '运行中', value: 'valid' },
  { label: '待更新', value: 'watch' },
  { label: '已作废', value: 'invalid' },
];

function saveLog() {
  if (!topic.value.trim()) return;
  invest.addJournal(topic.value.trim(), conclusion.value.trim());
  topic.value = '';
  conclusion.value = '';
  MessagePlugin.success('已写入复盘');
}

function saveThesis() {
  if (!th.title.trim() || !th.body.trim()) {
    MessagePlugin.warning('标题和正文必填');
    return false;
  }
  invest.addThesis(th.title.trim(), th.code.trim(), th.body.trim());
  thOpen.value = false;
  th.title = '';
  th.code = '';
  th.body = '';
  MessagePlugin.success('已写入论文');
  return true;
}
</script>
