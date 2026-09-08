<template>
  <t-space direction="vertical" :size="16" style="width: 100%">
    <span style="color: var(--td-text-color-secondary)">组合、论文和日志放在一起，方便回头看决策有没有被执行。</span>

    <!-- 顶栏 KPI 卡片带 -->
    <t-row :gutter="[16, 16]">
      <t-col :xs="12" :xl="4">
        <t-card title="稳健复利组合" subtitle="股票账户">
          <div class="kpi-num num-hero">{{ money(stock.mv) }}</div>
          <div class="kpi-foot">
            <span class="pnl-span" :style="{ color: pnlColor(stock.pnl) }">
              盈亏 {{ signed(stock.pnl) }}<template v-if="stock.pnlPct != null"> ({{ pct(stock.pnlPct) }})</template>
            </span>
            <span class="dot-split">·</span>
            <span class="health-span">
              <span class="health-dot" :class="healthClass(stockHealth.total)" />
              健康 {{ stockHealth.total }}
            </span>
          </div>
        </t-card>
      </t-col>
      <t-col :xs="12" :xl="4">
        <t-card title="宽基 + 红利底仓" subtitle="ETF 账户">
          <div class="kpi-num num-hero">{{ money(etf.mv) }}</div>
          <div class="kpi-foot">
            <span class="pnl-span" :style="{ color: pnlColor(etf.pnl) }">
              盈亏 {{ signed(etf.pnl) }}<template v-if="etf.pnlPct != null"> ({{ pct(etf.pnlPct) }})</template>
            </span>
            <span class="dot-split">·</span>
            <span class="health-span">
              <span class="health-dot" :class="healthClass(etfHealth.total)" />
              健康 {{ etfHealth.total }}
            </span>
          </div>
        </t-card>
      </t-col>
      <t-col :xs="12" :xl="4">
        <t-card title="机会储备 & 复盘习惯" subtitle="执行闭环">
          <div class="kpi-num num-hero">{{ invest.opportunities.length }} <span class="kpi-unit">只机会</span></div>
          <div class="kpi-foot">
            <span>均分 {{ avgScore }}</span>
            <span class="dot-split">·</span>
            <span>本周复盘 {{ weekLogs }}/3</span>
          </div>
        </t-card>
      </t-col>
    </t-row>

    <!-- 投资组合全貌 -->
    <t-card title="投资组合持仓">
      <template #actions>
        <span class="card-cap">按账户聚合 · tabular 记账</span>
      </template>
      <t-empty v-if="!rows.length" description="暂无持仓数据" />
      <div v-else class="table-wrap">
        <t-table :data="rows" :columns="cols" row-key="code" size="small" hover>
          <template #name="{ row }">
            <t-space align="center" :size="8">
              <span class="stock-name">{{ row.name }}</span>
              <t-tag size="small" variant="light">{{ shortCode(row.code) }}</t-tag>
            </t-space>
          </template>
          <template #account="{ row }">
            <t-tag size="small" variant="outline" :theme="row.account === 'stock' ? 'primary' : 'default'">
              {{ row.account === 'stock' ? '股票' : 'ETF' }}
            </t-tag>
          </template>
          <template #quantity="{ row }">{{ row.quantity?.toLocaleString('zh-CN') }}</template>
          <template #cost="{ row }">¥{{ row.cost?.toFixed(2) }}</template>
          <template #mv="{ row }">{{ money(row.marketValue) }}</template>
          <template #pnl="{ row }">
            <div class="pnl-cell" :style="{ color: pnlColor(row.pnl) }">
              <span>{{ signed(row.pnl) }}</span>
              <span v-if="row.pnlPct != null" class="pnl-pct">({{ pct(row.pnlPct) }})</span>
            </div>
          </template>
        </t-table>
      </div>
    </t-card>

    <!-- 下半部分：投资论文与复盘日志 -->
    <t-row :gutter="[16, 16]">
      <!-- 投资论文 -->
      <t-col :xs="12" :xl="6">
        <t-card title="投资论文">
          <template #actions>
            <t-button size="small" theme="primary" @click="thOpen = true">写论文</t-button>
          </template>
          <div class="thesis-header-actions">
            <t-radio-group v-model="filter" variant="default-filled">
              <t-radio-button value="all">全部 ({{ invest.theses.length }})</t-radio-button>
              <t-radio-button value="valid">运行中</t-radio-button>
              <t-radio-button value="watch">待更新</t-radio-button>
              <t-radio-button value="invalid">已作废</t-radio-button>
            </t-radio-group>
          </div>

          <t-empty v-if="!theses.length" description="暂无该分类下的论文" style="padding: 24px 0" />
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
                  <t-popconfirm content="确定删除此篇论文？" @confirm="invest.removeThesis(t.id)">
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

    <!-- 写论文弹窗 -->
    <t-dialog
      v-model:visible="thOpen"
      header="撰写投资论文"
      width="min(560px, 94vw)"
      :confirm-btn="{ content: '保存论文', theme: 'primary' }"
      :on-confirm="saveThesis"
    >
      <t-form style="margin-top: 12px">
        <t-form-item label="论文标题">
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
const money = (n: number | null) => (n == null ? '—' : `¥${n.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`);
const signed = (n: number | null) =>
  n == null ? '—' : `${n >= 0 ? '+' : '-'}¥${Math.abs(n).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
const pct = (n: number | null) => (n == null ? '—' : `${n > 0 ? '+' : ''}${(n * 100).toFixed(2)}%`);
const pnlColor = (n: number | null) => {
  if (n == null || n === 0) return 'var(--guanlan-muted)';
  return n > 0 ? 'var(--guanlan-red)' : 'var(--guanlan-green)';
};
const shortCode = (c: string) => c.replace(/^(sh|sz|bj)/i, '');

const healthClass = (val: number) => {
  if (val >= 80) return 'health-dot--good';
  if (val >= 60) return 'health-dot--warn';
  return 'health-dot--alert';
};

const cols = [
  { colKey: 'name', title: '名称 / 代码' },
  { colKey: 'account', title: '账户', width: 80 },
  { colKey: 'quantity', title: '持仓量', width: 100 },
  { colKey: 'cost', title: '持仓成本', width: 100 },
  { colKey: 'mv', title: '市值', width: 120 },
  { colKey: 'pnl', title: '浮动盈亏' },
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
  MessagePlugin.success('已保存论文');
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
  font-size: 13px;
  color: var(--guanlan-muted);
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
  font-size: 13px;
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
  font-size: 13px;
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
