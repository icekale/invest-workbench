<template>
  <t-space class="page" direction="vertical" :size="16" style="width: 100%">
    <funds-nav />
    <span style="color: var(--td-text-color-secondary)"
      >先看环境，再把值得跟踪的赔率放进机会池。全样本三轴见方法论 / 优质精选 / 智能组合。</span
    >
    <t-row :gutter="[16, 16]">
      <t-col :xs="12" :xl="7">
        <t-card title="每日宏观">
          <t-radio-group v-model="macroFilter" variant="default-filled" style="margin-bottom: 12px">
            <t-radio-button value="all">全部</t-radio-button>
            <t-radio-button value="增长">增长</t-radio-button>
            <t-radio-button value="流动性">流动性</t-radio-button>
            <t-radio-button value="政策">政策</t-radio-button>
          </t-radio-group>
          <t-timeline mode="same">
            <t-timeline-item v-for="m in macros" :key="m.id" :dot-color="toneColor[m.tone]">
              <div class="macro">
                <div class="macro-hd">
                  <strong>{{ m.title }}</strong>
                  <t-tag size="small" variant="light">{{ m.topic }}</t-tag>
                  <t-tag size="small" variant="outline">{{ m.account }}</t-tag>
                </div>
                <p class="macro-bd">{{ m.body }}</p>
              </div>
            </t-timeline-item>
          </t-timeline>
        </t-card>
      </t-col>
      <t-col :xs="12" :xl="5">
        <t-card title="决策清单">
          <t-list split>
            <t-list-item v-for="t in invest.todos.filter((x) => x.status === 'open')" :key="t.id">
              <div class="todo-row">
                <div class="todo-copy">{{ t.name }} · {{ t.reason }}</div>
                <t-button size="small" variant="text" theme="primary" @click="invest.setTodoStatus(t.id, 'done')">
                  完成
                </t-button>
              </div>
            </t-list-item>
          </t-list>
        </t-card>
      </t-col>
    </t-row>

    <t-card title="机会池">
      <template #actions>
        <t-button class="card-action" size="small" theme="primary" @click="oppOpen = true">新增机会</t-button>
      </template>
      <t-list split>
        <t-list-item v-for="o in invest.opportunities" :key="o.id">
          <div class="opp-row">
            <t-list-item-meta :title="`${o.name} · ${o.account === 'etf' ? 'ETF' : '股票'}`" :description="o.thesis" />
            <div class="opp-score">
              <span>评分 {{ o.score }}</span>
              <t-progress :percentage="o.score" :label="false" />
              <span class="opp-note">{{ o.note }}</span>
            </div>
          </div>
        </t-list-item>
      </t-list>
    </t-card>

    <t-card title="东财排行" subtitle="按近1年收益；点行看三轴（收益/波动/回撤）">
      <template #actions>
        <t-space class="card-action rank-tools" break-line>
          <t-input v-model="q" placeholder="代码回车看详情" @enter="goDetail(q)" />
          <t-button size="small" variant="outline" :loading="screenLoading" @click="screenTriple">三轴精选</t-button>
          <t-button size="small" theme="primary" :disabled="picked.length < 2" @click="goCompare"
            >对比 {{ picked.length }}</t-button
          >
        </t-space>
      </template>
      <t-radio-group v-model="typeFilter" variant="default-filled" style="margin-bottom: 12px">
        <t-radio-button v-for="t in typeFilters" :key="t" :value="t">{{ t }}</t-radio-button>
      </t-radio-group>
      <div class="table-wrap">
        <t-table
          :data="filteredRank"
          :columns="rankCols"
          row-key="code"
          :loading="rankLoading"
          hover
          max-height="360"
          :on-row-click="({ row }) => goDetail(row.code)"
        >
          <template #pick="{ row }">
            <t-checkbox :checked="picked.includes(row.code)" @click.stop @change="togglePick(row.code)" />
          </template>
          <template #year="{ row }">{{ fmtPct(row.year) }}</template>
          <template #ytd="{ row }">{{ fmtPct(row.ytd) }}</template>
          <template #week="{ row }">{{ fmtPct(row.week) }}</template>
        </t-table>
      </div>
    </t-card>

    <t-card v-if="screened.length" title="三轴精选" subtitle="前12只补波动/回撤后按研选分重排，不单看收益">
      <div class="table-wrap">
        <t-table
          :data="screened"
          :columns="screenCols"
          row-key="code"
          hover
          :on-row-click="({ row }) => goDetail(row.code)"
        >
          <template #year="{ row }">{{ fmtPct(row.year) }}</template>
          <template #stddev="{ row }">{{ row.stddev == null ? '—' : row.stddev.toFixed(2) }}</template>
          <template #drawdown="{ row }">{{ fmtPct(row.drawdown) }}</template>
          <template #score="{ row }">{{ researchScore(row.year, row.stddev, row.drawdown) ?? '—' }}</template>
          <template #note="{ row }">{{ riskNote(row.stddev, row.drawdown) }}</template>
        </t-table>
      </div>
    </t-card>

    <t-row :gutter="[16, 16]">
      <t-col v-if="picks.length" :xs="12" :span="6">
        <t-card title="研选组合" subtitle="精选前4只等权">
          <p>高收益、控波动、回撤不失控。</p>
          <t-list size="small">
            <t-list-item v-for="f in picks" :key="f.code">
              <div class="hold-row">
                <span class="hold-name">{{ f.name }}</span>
                <span class="hold-w">25%</span>
              </div>
            </t-list-item>
          </t-list>
        </t-card>
      </t-col>
      <t-col v-for="p in smartPortfolios" :key="p.id" :xs="12" :span="6">
        <t-card :title="p.name" :subtitle="`风险 ${p.risk}`">
          <p>{{ p.blurb }}</p>
          <t-list size="small">
            <t-list-item v-for="f in p.funds" :key="f.code">
              <div class="hold-row">
                <span class="hold-name">{{ fundName(f.code) }}</span>
                <span class="hold-w">{{ Math.round(f.weight * 100) }}%</span>
              </div>
            </t-list-item>
          </t-list>
        </t-card>
      </t-col>
    </t-row>

    <t-dialog v-model:visible="oppOpen" header="新增机会" :on-confirm="saveOpp">
      <t-form>
        <t-form-item label="名称">
          <t-input v-model="opp.name" />
        </t-form-item>
        <t-form-item label="账户">
          <t-radio-group v-model="opp.account">
            <t-radio value="stock">股票</t-radio>
            <t-radio value="etf">ETF</t-radio>
          </t-radio-group>
        </t-form-item>
        <t-form-item label="论点">
          <t-input v-model="opp.thesis" />
        </t-form-item>
        <t-form-item label="评分">
          <t-input-number v-model="opp.score" :min="0" :max="100" />
        </t-form-item>
        <t-form-item label="备注">
          <t-input v-model="opp.note" />
        </t-form-item>
      </t-form>
    </t-dialog>
  </t-space>
</template>
<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { macroBriefs, smartPortfolios } from '@/mock/invest';
import { useInvestStore } from '@/store';
import type { AccountId } from '@/types/invest';
import type { FundDetail, FundRank } from '@/utils/fund';
import { fetchFundDetails, fetchFundRank, fmtPct, researchScore, riskNote, typeBucket } from '@/utils/fund';

import FundsNav from './FundsNav.vue';

defineOptions({ name: 'FundsIndex' });

const router = useRouter();
const route = useRoute();
const invest = useInvestStore();
const rank = ref<FundRank[]>([]);
const rankLoading = ref(false);
const screenLoading = ref(false);
const screened = ref<FundDetail[]>([]);
const picked = ref<string[]>([]);
const q = ref(String(route.query.q ?? ''));
const typeFilter = ref('全部');
const typeFilters = ['全部', '股票', '混合', '债券', '指数', 'QDII'];
const macroFilter = ref('all');
const oppOpen = ref(false);
const opp = reactive({ name: '', account: 'etf' as AccountId, thesis: '', score: 70, note: '' });

const toneColor: Record<string, string> = { 偏多: 'green', 中性: 'blue', 偏空: 'red' };
const macros = computed(() =>
  macroFilter.value === 'all' ? macroBriefs : macroBriefs.filter((m) => m.topic === macroFilter.value),
);
const fundName = (code: string) => rank.value.find((f) => f.code === code)?.name || code;
const filteredRank = computed(() => {
  const typeRows =
    typeFilter.value === '全部' ? rank.value : rank.value.filter((f) => typeBucket(f.type) === typeFilter.value);
  const k = q.value.trim();
  if (!k || /^\d{6}$/.test(k)) return typeRows;
  return typeRows.filter((f) => `${f.code}${f.name}`.includes(k));
});
const picks = computed(() => screened.value.slice(0, 4));

const rankCols = [
  { colKey: 'pick', title: '对比', width: 56 },
  { colKey: 'name', title: '名称' },
  { colKey: 'code', title: '代码', width: 88 },
  { colKey: 'type', title: '类型', width: 120 },
  { colKey: 'year', title: '近1年', width: 96 },
  { colKey: 'ytd', title: '今年来', width: 96 },
  { colKey: 'week', title: '近一周', width: 96 },
];
const screenCols = [
  { colKey: 'name', title: '名称' },
  { colKey: 'code', title: '代码', width: 88 },
  { colKey: 'year', title: 'Yield', width: 88 },
  { colKey: 'stddev', title: 'Vix', width: 80 },
  { colKey: 'drawdown', title: 'Loss', width: 88 },
  { colKey: 'score', title: '研选分', width: 80 },
  { colKey: 'note', title: '回撤/波动' },
];

onMounted(async () => {
  rankLoading.value = true;
  try {
    rank.value = await fetchFundRank();
  } catch (e) {
    MessagePlugin.warning(e instanceof Error ? e.message : '排行加载失败');
  } finally {
    rankLoading.value = false;
  }
});

function goDetail(code: string) {
  const c = code.trim();
  if (!c) return;
  router.push(`/funds/detail/${c}`);
}

function togglePick(code: string) {
  const i = picked.value.indexOf(code);
  if (i >= 0) picked.value.splice(i, 1);
  else if (picked.value.length < 4) picked.value.push(code);
  else MessagePlugin.warning('最多对比 4 只');
}

function goCompare() {
  if (picked.value.length < 2) return;
  router.push({ path: '/funds/compare', query: { codes: picked.value.join(',') } });
}

async function screenTriple() {
  const codes = filteredRank.value.slice(0, 12).map((f) => f.code);
  if (!codes.length) return;
  screenLoading.value = true;
  try {
    const rows = await fetchFundDetails(codes);
    screened.value = rows
      .map((f) => ({ f, s: researchScore(f.year, f.stddev, f.drawdown) ?? -1 }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.f);
    if (!screened.value.length) MessagePlugin.warning('精选无数据');
  } catch (e) {
    MessagePlugin.warning(e instanceof Error ? e.message : '精选失败');
  } finally {
    screenLoading.value = false;
  }
}

function saveOpp() {
  if (!opp.name.trim() || !opp.thesis.trim()) {
    MessagePlugin.warning('名称和论点必填');
    return false;
  }
  invest.addOpportunity({ ...opp, name: opp.name.trim(), thesis: opp.thesis.trim(), note: opp.note.trim() });
  oppOpen.value = false;
  opp.name = '';
  opp.thesis = '';
  opp.note = '';
  MessagePlugin.success('已加入机会池');
  return true;
}
</script>
<style scoped>
.page {
  min-width: 0;
  max-width: 100%;
  overflow-x: hidden;
}

.table-wrap {
  max-width: 100%;
  overflow-x: auto;
}

.macro {
  min-width: 0;
}

.macro-hd {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.macro-hd strong {
  flex: 1 1 12em;
  min-width: 0;
  font-size: 15px;
  line-height: 1.4;
}

.macro-bd {
  margin: 6px 0 0;
  color: var(--td-text-color-secondary);
  line-height: 1.6;
}

:deep(.t-timeline-item__content) {
  min-width: 0;
}

:deep(.t-radio-group) {
  flex-wrap: wrap;
}

.opp-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.opp-score {
  width: 100%;
  max-width: 220px;
}

.opp-note {
  color: var(--td-text-color-secondary);
}

.rank-tools :deep(.t-input) {
  width: 160px;
  max-width: 100%;
}

.todo-row,
.hold-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  width: 100%;
}

.todo-copy,
.hold-name {
  min-width: 0;
  flex: 1;
  line-height: 22px;
  overflow-wrap: anywhere;
}

.hold-w {
  flex: 0 0 auto;
  color: var(--td-text-color-secondary);
  font-variant-numeric: tabular-nums;
}

@media (width <= 767px) {
  .todo-row {
    flex-direction: column;
    gap: 4px;
  }
}

@media (width >= 768px) {
  .opp-row {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
  }

  .opp-score {
    width: 160px;
  }
}

@media (width <= 640px) {
  .macro-hd strong {
    flex: 1 1 100%;
  }

  :deep(.t-list-item) {
    flex-wrap: wrap;
  }
}
</style>
