<template>
  <t-space class="page" direction="vertical" :size="16" style="width: 100%">
    <!-- 基金导航栏 -->
    <funds-nav />

    <!-- 顶栏概览条 -->
    <div class="overview-strip">
      <div class="overview-strip__item">
        <span class="overview-strip__label">机会池标的</span>
        <span class="overview-strip__val">{{ invest.opportunities.length }} <small>只跟踪</small></span>
      </div>
      <div class="overview-strip__divider" />
      <div class="overview-strip__item">
        <span class="overview-strip__label">待办交易</span>
        <span class="overview-strip__val">{{ openTodos.length }} <small>项待执行</small></span>
      </div>
      <div class="overview-strip__divider" />
      <div class="overview-strip__item">
        <span class="overview-strip__label">全市场扫描</span>
        <span class="overview-strip__val">{{ rank.length || '80+' }} <small>只公募样本</small></span>
      </div>
    </div>

    <!-- 机会池 -->
    <t-card title="机会池 · 赔率与论点跟踪">
      <template #actions>
        <t-space :size="8">
          <span class="sub-action-text">跟踪中 {{ invest.opportunities.length }} 只</span>
          <t-button size="small" theme="primary" @click="oppOpen = true">新增机会</t-button>
        </t-space>
      </template>

      <div v-if="invest.opportunities.length" class="opp-grid">
        <div v-for="o in invest.opportunities" :key="o.id" class="opp-card">
          <div class="opp-card__header">
            <div class="opp-card__title-row">
              <t-tag
                size="small"
                variant="light"
                :theme="invest.accountKind(o.account) === 'etf' ? 'primary' : 'warning'"
              >
                {{ invest.accountName(o.account) }}
              </t-tag>
              <span class="opp-card__name">{{ o.name }}</span>
            </div>
            <div class="opp-card__score-badge">
              <t-tag size="small" :theme="scoreBadgeTheme(o.score)" variant="light">
                {{ scoreBadgeLabel(o.score) }} {{ o.score }}分
              </t-tag>
            </div>
          </div>

          <div class="opp-card__thesis">
            <span class="thesis-quote-mark">“</span>
            {{ o.thesis }}
          </div>

          <div class="opp-card__progress">
            <t-progress :percentage="o.score" :color="o.score >= 80 ? '#b8433e' : '#3569bb'" :label="false" />
          </div>

          <div class="opp-card__footer">
            <span class="opp-card__note">{{ o.note || '暂无跟踪备注' }}</span>
            <t-space :size="8">
              <t-link
                theme="primary"
                hover="color"
                @click="
                  invest.openTradeModal({
                    account: o.account,
                    side: 'buy',
                    name: o.name,
                    note: o.thesis,
                  })
                "
              >
                模拟建仓
              </t-link>
              <t-popconfirm content="确定将该机会生成一条买入待办？" @confirm="convertOppToTodo(o)">
                <t-link theme="default" hover="color">转为待办</t-link>
              </t-popconfirm>
              <t-popconfirm content="确定从机会池移除？" @confirm="deleteOpp(o.id)">
                <t-link theme="danger" hover="color">删除</t-link>
              </t-popconfirm>
            </t-space>
          </div>
        </div>
      </div>
      <t-empty v-else description="机会池暂无标的，点击右上角「新增机会」加入跟踪" style="padding: 32px 0" />
    </t-card>

    <!-- 全市场基金排行 -->
    <t-card title="全市场基金排行" subtitle="基于东方财富接口实时排行 · 按近1年收益排序">
      <template #actions>
        <t-space class="card-action rank-tools" break-line :size="8">
          <t-input v-model="q" placeholder="代码回车看详情" style="width: 170px" clearable @enter="goDetail(q)" />
          <t-button size="small" variant="outline" :loading="screenLoading" @click="screenTriple">三轴精选</t-button>
          <t-button size="small" theme="primary" :disabled="picked.length < 2" @click="goCompare">
            对比 ({{ picked.length }})
          </t-button>
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
          max-height="380"
          :on-row-click="({ row }) => goDetail(row.code)"
        >
          <template #pick="{ row }">
            <t-checkbox :checked="picked.includes(row.code)" @click.stop @change="togglePick(row.code)" />
          </template>
          <template #name="{ row }">
            <span class="fund-link-name">{{ row.name }}</span>
          </template>
          <template #code="{ row }">
            <span class="code-font">{{ row.code }}</span>
          </template>
          <template #type="{ row }">
            <t-tag size="small" variant="light">{{ row.type }}</t-tag>
          </template>
          <template #year="{ row }">
            <span :class="pctClass(row.year)" class="pct-val">{{ fmtPctWithSign(row.year) }}</span>
          </template>
          <template #ytd="{ row }">
            <span :class="pctClass(row.ytd)" class="pct-val">{{ fmtPctWithSign(row.ytd) }}</span>
          </template>
          <template #week="{ row }">
            <span :class="pctClass(row.week)" class="pct-val">{{ fmtPctWithSign(row.week) }}</span>
          </template>
          <template #op="{ row }">
            <t-link theme="primary" hover="color" @click.stop="goDetail(row.code)">详情</t-link>
          </template>
        </t-table>
      </div>
    </t-card>

    <!-- 三轴精选结果 -->
    <t-card v-if="screened.length" title="三轴精选" subtitle="前12只补齐波动与最大回撤后，按研选分重排，不单看绝对收益">
      <div class="table-wrap">
        <t-table
          :data="screened"
          :columns="screenCols"
          row-key="code"
          hover
          :on-row-click="({ row }) => goDetail(row.code)"
        >
          <template #name="{ row }">
            <span class="fund-link-name">{{ row.name }}</span>
          </template>
          <template #code="{ row }">
            <span class="code-font">{{ row.code }}</span>
          </template>
          <template #year="{ row }">
            <span :class="pctClass(row.year)">{{ fmtPctWithSign(row.year) }}</span>
          </template>
          <template #stddev="{ row }">
            <span class="tabular-font">{{ row.stddev == null ? '—' : row.stddev.toFixed(2) }}</span>
          </template>
          <template #drawdown="{ row }">
            <span class="loss-text tabular-font">{{ row.drawdown == null ? '—' : fmtPct(row.drawdown) }}</span>
          </template>
          <template #score="{ row }">
            <t-tag size="small" theme="primary" variant="light" class="tabular-font">
              {{ researchScore(row.year, row.stddev, row.drawdown) ?? '—' }}
            </t-tag>
          </template>
          <template #note="{ row }">
            <t-tag size="small" variant="outline">{{ riskNote(row.stddev, row.drawdown) }}</t-tag>
          </template>
          <template #op="{ row }">
            <t-link theme="primary" hover="color" @click.stop="goDetail(row.code)">详情</t-link>
          </template>
        </t-table>
      </div>
    </t-card>

    <!-- 策略组合与大类配置 -->
    <t-row :gutter="[16, 16]">
      <t-col v-if="picks.length" :xs="12" :span="6">
        <t-card title="研选组合" subtitle="精选前 4 只等权配置 (各 25%)">
          <template #actions>
            <t-tag size="small" theme="primary" variant="light">动态研选</t-tag>
          </template>
          <p class="portfolio-blurb">兼顾高收益、控波动与回撤不失控，构建多资产平衡组合。</p>
          <t-list size="small" :split="true" class="portfolio-holdings-list">
            <t-list-item v-for="f in picks" :key="f.code" class="portfolio-hold-item" @click="goDetail(f.code)">
              <div class="hold-row-enhanced">
                <div class="hold-info">
                  <div class="hold-top-line">
                    <span class="hold-name-text">{{ f.name }}</span>
                    <t-tag size="small" variant="outline" class="hold-tag">{{ f.type }}</t-tag>
                  </div>
                  <div class="hold-sub-line">
                    <span class="hold-code-text">{{ f.code }}</span>
                    <span v-if="f.nav != null" class="hold-stat-nav">净值 {{ f.nav.toFixed(4) }}</span>
                    <span v-if="f.year != null" :class="pctClass(f.year)" class="hold-stat-year">
                      近1年 {{ fmtPctWithSign(f.year) }}
                    </span>
                  </div>
                </div>
                <div class="hold-action-side">
                  <span class="hold-weight-pill">25%</span>
                  <t-link theme="primary" hover="color" size="small" @click.stop="goDetail(f.code)"> 详情 </t-link>
                </div>
              </div>
            </t-list-item>
          </t-list>
          <div style="margin-top: 12px; text-align: right">
            <t-button size="small" variant="text" theme="primary" @click="router.push('/funds/portfolios')">
              策略调优 →
            </t-button>
          </div>
        </t-card>
      </t-col>

      <t-col v-for="p in smartPortfolios" :key="p.id" :xs="12" :span="6">
        <t-card :title="p.name">
          <template #actions>
            <t-tag size="small" :theme="riskTheme(p.risk)" variant="light">{{ p.risk }}风险</t-tag>
          </template>
          <p class="portfolio-blurb">{{ p.blurb }}</p>
          <t-list size="small" :split="true" class="portfolio-holdings-list">
            <t-list-item v-for="f in p.funds" :key="f.code" class="portfolio-hold-item" @click="goDetail(f.code)">
              <div class="hold-row-enhanced">
                <div class="hold-info">
                  <div class="hold-top-line">
                    <span class="hold-name-text">{{ f.name || fundName(f.code) }}</span>
                    <t-tag v-if="f.type" size="small" variant="outline" class="hold-tag">{{ f.type }}</t-tag>
                  </div>
                  <div class="hold-sub-line">
                    <span class="hold-code-text">{{ f.code }}</span>
                    <span v-if="f.nav != null" class="hold-stat-nav">净值 {{ f.nav.toFixed(4) }}</span>
                    <span v-if="f.year != null" :class="pctClass(f.year)" class="hold-stat-year">
                      近1年 {{ fmtPctWithSign(f.year) }}
                    </span>
                  </div>
                </div>
                <div class="hold-action-side">
                  <span class="hold-weight-pill">{{ Math.round(f.weight * 100) }}%</span>
                  <t-link theme="primary" hover="color" size="small" @click.stop="goDetail(f.code)"> 详情 </t-link>
                </div>
              </div>
            </t-list-item>
          </t-list>
          <div style="margin-top: 12px; text-align: right">
            <t-button size="small" variant="text" theme="primary" @click="router.push('/funds/portfolios')">
              配置微调 →
            </t-button>
          </div>
        </t-card>
      </t-col>
    </t-row>

    <!-- 新增机会弹窗 -->
    <t-dialog v-model:visible="oppOpen" header="新增机会标的" :on-confirm="saveOpp">
      <t-form label-align="top">
        <t-form-item label="标的名称">
          <t-input v-model="opp.name" placeholder="例如：中证红利低波 ETF / 腾讯控股" />
        </t-form-item>
        <t-form-item label="所属账户">
          <t-radio-group v-model="opp.account">
            <t-radio v-for="a in invest.activeAccounts" :key="a.id" :value="a.id">{{ a.name }}</t-radio>
          </t-radio-group>
        </t-form-item>
        <t-form-item label="核心投资论点 (Thesis)">
          <t-textarea
            v-model="opp.thesis"
            placeholder="为什么关注该标的？赔率与催化剂是什么？"
            :autosize="{ minRows: 2, maxRows: 4 }"
          />
        </t-form-item>
        <t-form-item label="研选评分 (0 - 100)">
          <t-input-number v-model="opp.score" :min="0" :max="100" :step="5" style="width: 100%" />
        </t-form-item>
        <t-form-item label="跟踪备注">
          <t-input v-model="opp.note" placeholder="例如：等回调至 20 日线再建仓" />
        </t-form-item>
      </t-form>
    </t-dialog>
  </t-space>
</template>
<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { smartPortfolios } from '@/mock/invest';
import { useInvestStore } from '@/store';
import type { AccountId, Opportunity } from '@/types/invest';
import { kindOf } from '@/utils/accounts';
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
const openTodos = computed(() => invest.todos.filter((x) => x.status === 'open'));
const oppOpen = ref(false);
const opp = reactive({
  name: '',
  account: 'etf' as AccountId,
  thesis: '',
  score: 70,
  note: '',
});

/** 机会池默认落基金桶；没有或已归档就落第一个在用的桶。 */
function defaultAccount(): AccountId {
  const list = invest.activeAccounts;
  return list.find((a) => a.kind === 'etf')?.id ?? list[0]?.id ?? 'stock';
}

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
  { colKey: 'pick', title: '对比', width: 48 },
  { colKey: 'name', title: '基金名称', minWidth: 170 },
  { colKey: 'code', title: '代码', width: 90 },
  { colKey: 'type', title: '类型', width: 95 },
  { colKey: 'year', title: '近1年', width: 100 },
  { colKey: 'ytd', title: '今年来', width: 95 },
  { colKey: 'week', title: '近一周', width: 95 },
  { colKey: 'op', title: '操作', width: 65 },
];

const screenCols = [
  { colKey: 'name', title: '基金名称', minWidth: 150 },
  { colKey: 'code', title: '代码', width: 90 },
  { colKey: 'year', title: '年化收益', width: 95 },
  { colKey: 'stddev', title: '年化波动', width: 90 },
  { colKey: 'drawdown', title: '最大回撤', width: 95 },
  { colKey: 'score', title: '研选分', width: 80 },
  { colKey: 'note', title: '波动/回撤诊断', width: 120 },
  { colKey: 'op', title: '操作', width: 70 },
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

function fmtPctWithSign(n: number | null): string {
  if (n == null) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function pctClass(n: number | null): string {
  if (n == null || n === 0) return 'text-muted';
  return n > 0 ? 'gain-text' : 'loss-text';
}

function scoreBadgeTheme(score: number): 'danger' | 'primary' | 'default' {
  if (score >= 80) return 'danger';
  if (score >= 60) return 'primary';
  return 'default';
}

function scoreBadgeLabel(score: number): string {
  if (score >= 80) return '高景气';
  if (score >= 60) return '重点关注';
  return '中性跟踪';
}

function riskTheme(risk: string): 'danger' | 'warning' | 'success' | 'default' {
  if (risk.includes('高')) return 'danger';
  if (risk.includes('中')) return 'warning';
  if (risk.includes('低')) return 'success';
  return 'default';
}

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
  invest.addOpportunity({
    name: opp.name.trim(),
    // 表单里选的桶可能已被归档，落库前对回注册表
    account: invest.activeAccounts.some((a) => a.id === opp.account) ? opp.account : defaultAccount(),
    thesis: opp.thesis.trim(),
    score: opp.score,
    note: opp.note.trim(),
  });
  oppOpen.value = false;
  opp.name = '';
  opp.thesis = '';
  opp.note = '';
  MessagePlugin.success('已加入机会池');
  return true;
}

function deleteOpp(id: string) {
  invest.removeOpportunity(id);
  MessagePlugin.success('已从机会池移除');
}

function convertOppToTodo(o: Opportunity) {
  const match = o.name.match(/\d{6}/);
  const kind = kindOf(invest.accounts, o.account);
  /*
   * 机会池里的名字常常不带代码，得给个占位。占位物按账户性质给：
   * 股票桶给一只沪市股票、ETF 桶给一只场内 ETF，用户改掉就是。
   */
  const raw = match ? match[0] : kind === 'stock' ? '600519' : '510300';
  invest.addTodo({
    account: o.account,
    code: raw,
    name: o.name,
    side: 'buy',
    quantity: kind === 'etf' ? 1000 : 100,
    reason: `[机会池导入] ${o.thesis}`,
  });
  MessagePlugin.success(`已将「${o.name}」转为买入待办`);
}
</script>
<style scoped>
.page {
  min-width: 0;
  max-width: 100%;
  overflow-x: hidden;
}

/* 顶栏概览条 */
.overview-strip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  padding: 12px 18px;
  background: var(--td-bg-color-container);
  border-radius: 8px;
  border: 1px solid var(--guanlan-line, #e2ebf0);
}

.overview-strip__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.overview-strip__label {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.overview-strip__val {
  font-size: 16px;
  font-weight: 600;
  color: var(--td-text-color-primary);
  font-variant-numeric: tabular-nums;

  small {
    font-size: 12px;
    font-weight: normal;
    color: var(--td-text-color-placeholder);
    margin-left: 2px;
  }
}

.overview-strip__divider {
  width: 1px;
  height: 24px;
  background-color: var(--td-component-stroke);
}

.sub-action-text {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.table-wrap {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
}

.code-font {
  font-family: var(--td-font-family-mono, monospace);
  font-size: 12px;
}

.tabular-font {
  font-variant-numeric: tabular-nums;
}

.fund-link-name {
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s ease;

  &:hover {
    color: var(--td-brand-color);
  }
}

.gain-text {
  color: var(--guanlan-gain, #b8433e);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}

.loss-text {
  color: var(--guanlan-loss, #16815f);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}

.text-muted {
  color: var(--td-text-color-secondary);
  font-variant-numeric: tabular-nums;
}

/* 宏观 */
.macro-weather-bar {
  display: grid;
  grid-template-columns: 1.5fr auto 1.5fr;
  gap: 12px;
  align-items: center;
  padding: 10px 14px;
  background: var(--td-bg-color-container-hover, #f8fafc);
  border: 1px solid var(--td-component-stroke, #e2e8f0);
  border-radius: 6px;
  margin-bottom: 12px;
  font-size: 13px;

  @media (width <= 767px) {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .weather-col {
    min-width: 0;
  }

  .weather-label {
    font-size: 11px;
    color: var(--td-text-color-secondary);
    margin-bottom: 2px;
  }

  .weather-val {
    font-size: 13px;
    font-weight: 600;
    color: var(--td-text-color-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    strong {
      color: var(--td-brand-color, #0d706d);
      font-variant-numeric: tabular-nums;
    }
  }
}

.macro-indicators-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 16px;

  @media (width <= 1024px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (width <= 480px) {
    grid-template-columns: 1fr;
  }

  .ind-pill {
    min-width: 0;
    padding: 10px 12px;
    background: var(--td-bg-color-secondarycontainer, #f8fafc);
    border: 1px solid var(--td-component-stroke, #e2e8f0);
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    transition: border-color 0.2s;

    &:hover {
      border-color: var(--td-brand-color, #0d706d);
    }
  }

  .ind-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;

    .ind-name {
      font-size: 11px;
      color: var(--td-text-color-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .ind-val {
    font-size: 16px;
    font-weight: 700;
    color: var(--td-text-color-primary);
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
    margin-top: 2px;
  }

  .ind-hint {
    font-size: 11px;
    color: var(--td-text-color-placeholder);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }
}

.macro-filter-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  gap: 12px;
  flex-wrap: wrap;

  .macro-count-hint {
    font-size: 12px;
    color: var(--td-text-color-placeholder);
  }
}

.macro-time-badge {
  font-size: 11px;
  color: var(--td-text-color-placeholder);
  font-variant-numeric: tabular-nums;
}

.macro-action-box {
  margin-top: 8px;
  padding: 6px 10px;
  background: var(--td-brand-color-light, rgb(13 112 109 / 6%));
  border-left: 2px solid var(--td-brand-color, #0d706d);
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.5;
  display: flex;
  gap: 6px;
  align-items: baseline;

  .action-box-title {
    font-weight: 600;
    color: var(--td-brand-color, #0d706d);
    white-space: nowrap;
  }

  .action-box-text {
    color: var(--td-text-color-primary);
  }
}

.macro-ft {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.macro-subtabs-nav {
  margin: 12px 0 14px;
  border-bottom: 1px solid var(--td-component-stroke, #e2e8f0);

  :deep(.t-tabs__nav-item) {
    font-size: 13px;
    font-weight: 500;
  }
}

.macro-section-sub {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

/* 重点会议日程 */
.macro-events-panel {
  min-width: 0;

  .events-filter-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 12px;

    .events-filter-left {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .major-filter-toggle {
      display: inline-flex;
      align-items: center;
      padding: 1px 8px;
      border-radius: 4px;
      background: var(--td-bg-color-secondarycontainer, #f8fafc);
      border: 1px solid var(--td-component-stroke, #e2e8f0);
      transition: all 0.2s ease;

      .major-toggle-text {
        font-size: 12px;
        font-weight: 500;
        color: var(--td-text-color-secondary);
        display: inline-flex;
        align-items: center;
        gap: 3px;
        user-select: none;
      }

      .major-flame {
        font-size: 12px;
        filter: saturate(1.2);
      }

      &.is-active {
        background: rgb(184 67 62 / 8%);
        border-color: rgb(184 67 62 / 30%);

        .major-toggle-text {
          color: var(--guanlan-gain, #b8433e);
          font-weight: 600;
        }
      }
    }

    .events-sub-desc {
      font-size: 12px;
      color: var(--td-text-color-secondary);
    }
  }

  .events-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .event-card {
    padding: 12px 14px;
    background: var(--td-bg-color-container);
    border: 1px solid var(--td-component-stroke, #e2e8f0);
    border-radius: 6px;
    transition: all 0.2s ease;

    &:hover {
      border-color: var(--td-brand-color, #0d706d);
      box-shadow: 0 2px 8px rgb(0 0 0 / 4%);
    }
  }

  .event-card-top {
    display: flex;
    gap: 14px;
    align-items: flex-start;

    @media (width <= 640px) {
      flex-direction: column;
      gap: 8px;
    }
  }

  .event-date-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 64px;
    padding: 6px 8px;
    background: var(--td-bg-color-secondarycontainer, #f8fafc);
    border: 1px solid var(--td-component-stroke, #e2e8f0);
    border-radius: 6px;

    @media (width <= 640px) {
      flex-direction: row;
      gap: 8px;
      width: 100%;
      justify-content: flex-start;
    }

    .event-date-main {
      font-size: 15px;
      font-weight: 700;
      color: var(--td-text-color-primary);
      font-variant-numeric: tabular-nums;
    }

    .event-countdown-badge {
      font-size: 11px;
      font-weight: 500;
      margin-top: 2px;
      padding: 1px 6px;
      border-radius: 3px;

      &.countdown-urgent {
        background: rgb(184 67 62 / 10%);
        color: var(--guanlan-gain, #b8433e);
      }

      &.countdown-future {
        background: var(--td-brand-color-light, rgb(13 112 109 / 8%));
        color: var(--td-brand-color, #0d706d);
      }

      &.countdown-past {
        background: var(--td-bg-color-component, #edf2f7);
        color: var(--td-text-color-placeholder);
      }
    }
  }

  .event-main-col {
    flex: 1;
    min-width: 0;
  }

  .event-headline {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .event-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  .event-impact-text {
    font-size: 13px;
    color: var(--td-text-color-secondary);
    line-height: 1.55;
  }

  .event-beneficiaries-bar {
    margin-top: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;

    .bar-label {
      font-size: 11px;
      color: var(--td-text-color-placeholder);
      white-space: nowrap;
    }

    .beneficiary-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .beneficiary-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      background: var(--td-brand-color-light, rgb(13 112 109 / 8%));
      color: var(--td-brand-color, #0d706d);
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background: var(--td-brand-color, #0d706d);
        color: #fff;
      }
    }
  }

  .event-action-box {
    margin-top: 8px;
  }

  .event-footer-bar {
    margin-top: 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
}

/* 重点产业与催化 */
.industry-focus-panel {
  min-width: 0;

  .industry-filter-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    flex-wrap: wrap;

    .industry-filter-left {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .ind-sub-desc {
      font-size: 12px;
      color: var(--td-text-color-secondary);
    }
  }

  .industry-cards-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .ind-card {
    padding: 14px;
    background: var(--td-bg-color-container);
    border: 1px solid var(--td-component-stroke, #e2e8f0);
    border-radius: 6px;
    transition: all 0.2s ease;

    &:hover {
      border-color: var(--td-brand-color, #0d706d);
      box-shadow: 0 2px 8px rgb(0 0 0 / 4%);
    }
  }

  .ind-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }

  .ind-title-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;

    .ind-name {
      font-size: 15px;
      font-weight: 700;
      color: var(--td-text-color-primary);
    }

    .ind-chg-pill {
      font-size: 12px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 4px;

      &.is-up {
        background: rgb(184 67 62 / 10%);
        color: var(--guanlan-gain, #b8433e);
      }

      &.is-down {
        background: rgb(22 129 95 / 10%);
        color: var(--guanlan-loss, #16815f);
      }
    }

    .ind-limit-tag {
      font-weight: 600;
      letter-spacing: 0.2px;
    }

    .ind-source-tag {
      font-size: 11px;
      color: var(--td-text-color-placeholder);
      border-color: var(--td-component-stroke);
    }
  }

  .ind-heat-badge {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 12px;

    .heat-lbl {
      color: var(--td-text-color-secondary);
      font-size: 11px;
    }

    .heat-num {
      font-size: 16px;
      font-weight: 700;
    }

    .heat-trend {
      font-size: 11px;
      font-weight: 600;

      &.trend-up {
        color: var(--guanlan-gain, #b8433e);
      }

      &.trend-stable {
        color: var(--td-text-color-secondary);
      }

      &.trend-down {
        color: var(--guanlan-loss, #16815f);
      }
    }
  }

  .ind-catalyst-block,
  .ind-tactic-block {
    margin-top: 6px;
    font-size: 12.5px;
    line-height: 1.55;
    color: var(--td-text-color-primary);
    display: flex;
    gap: 4px;
    align-items: baseline;

    .ind-block-lbl {
      font-weight: 600;
      white-space: nowrap;
      color: var(--td-text-color-secondary);
    }

    .ind-block-text {
      color: var(--td-text-color-primary);
    }
  }

  .ind-catalyst-block {
    .ind-block-lbl {
      color: var(--guanlan-warning, #b8782d);
    }
  }

  .ind-tactic-block {
    .ind-block-lbl {
      color: var(--td-brand-color, #0d706d);
    }
  }

  .ind-targets-bar {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px dashed var(--td-component-stroke, #e2e8f0);
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;

    .targets-caption {
      font-size: 11px;
      color: var(--td-text-color-secondary);
      white-space: nowrap;
    }

    .targets-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .target-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 8px;
      background: var(--td-bg-color-secondarycontainer, #f8fafc);
      border: 1px solid var(--td-component-stroke, #e2e8f0);
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s ease;

      .tgt-name {
        font-weight: 500;
        color: var(--td-text-color-primary);
      }

      .tgt-chg {
        font-size: 11px;
        font-weight: 600;

        &.is-up {
          color: var(--guanlan-gain, #b8433e);
        }

        &.is-down {
          color: var(--guanlan-loss, #16815f);
        }
      }

      .tgt-type-badge {
        font-size: 10px;
        padding: 0 4px;
        background: var(--td-bg-color-component, #e2e8f0);
        color: var(--td-text-color-secondary);
        border-radius: 2px;
      }

      .tgt-trade-icon {
        color: var(--td-brand-color, #0d706d);
        opacity: 0.7;
      }

      &:hover {
        border-color: var(--td-brand-color, #0d706d);
        background: var(--td-brand-color-light, rgb(13 112 109 / 8%));

        .tgt-trade-icon {
          opacity: 1;
        }
      }
    }
  }

  .ind-card-footer {
    margin-top: 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;

    .ind-update-time {
      font-size: 11px;
      color: var(--td-text-color-placeholder);

      .color-gain {
        color: var(--guanlan-gain, #b8433e);
        font-weight: 600;
      }

      .color-loss {
        color: var(--guanlan-loss, #16815f);
        font-weight: 600;
      }
    }
  }
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

.macro-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--td-text-color-primary);
}

.macro-bd {
  margin: 6px 0 0;
  color: var(--td-text-color-secondary);
  font-size: 14px;
  line-height: 1.6;
}

/* 待办列表 */
.todo-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.todo-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--td-component-stroke);

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
}

.todo-left {
  flex: 1;
  min-width: 0;
}

.todo-headline {
  display: flex;
  align-items: center;
  gap: 8px;
}

.todo-target {
  font-weight: 600;
  font-size: 14px;
  color: var(--td-text-color-primary);
}

.todo-qty {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  font-variant-numeric: tabular-nums;
}

.todo-reason {
  margin-top: 4px;
  font-size: 14px;
  color: var(--td-text-color-secondary);
  line-height: 1.4;
}

/* 机会池卡片网格 */
.opp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.opp-card {
  padding: 14px;
  background: var(--td-bg-color-secondarycontainer);
  border: 1px solid var(--td-component-stroke);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;

  &:hover {
    box-shadow: 0 4px 12px rgb(0 0 0 / 5%);
  }
}

.opp-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.opp-card__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.opp-card__name {
  font-weight: 600;
  font-size: 14px;
  color: var(--td-text-color-primary);
}

.opp-card__thesis {
  font-size: 14px;
  color: var(--td-text-color-primary);
  line-height: 1.5;
  background: var(--td-bg-color-container);
  padding: 8px 10px;
  border-radius: var(--td-radius-small, 6px);
  position: relative;
}

.thesis-quote-mark {
  color: var(--guanlan-gold, #dfb56d);
  font-weight: bold;
}

.opp-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 6px;
  font-size: 12px;
}

.opp-card__note {
  color: var(--td-text-color-placeholder);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 150px;
}

/* 组合 */
.portfolio-blurb {
  margin-bottom: 12px;
  font-size: 14px;
  color: var(--td-text-color-secondary);
  line-height: 1.5;
}

.pct-val {
  display: inline-block;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.portfolio-holdings-list {
  :deep(.t-list-item) {
    padding: 8px 6px;
    cursor: pointer;
    transition: background-color 0.15s ease;
    border-radius: 6px;

    &:hover {
      background-color: var(--td-bg-color-container-hover, rgb(0 0 0 / 3%));

      .hold-name-text {
        color: var(--td-brand-color, #0d706d);
      }
    }
  }
}

.hold-row-enhanced {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 12px;

  .hold-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
    flex: 1;

    .hold-top-line {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;

      .hold-name-text {
        font-size: 13px;
        font-weight: 600;
        color: var(--td-text-color-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: color 0.15s ease;
      }

      .hold-tag {
        flex-shrink: 0;
        font-size: 10px;
        padding: 0 4px;
        height: 18px;
        line-height: 16px;
      }
    }

    .hold-sub-line {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      color: var(--td-text-color-secondary);
      font-variant-numeric: tabular-nums;
      flex-wrap: nowrap;

      .hold-code-text {
        font-family: var(--td-font-family-mono, monospace);
        color: var(--td-text-color-placeholder);
      }

      .hold-stat-nav {
        color: var(--td-text-color-secondary);
      }

      .hold-stat-year {
        font-weight: 500;
      }
    }
  }

  .hold-action-side {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;

    .hold-weight-pill {
      font-size: 12px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 10px;
      background: var(--td-bg-color-secondarycontainer, #f3f5f8);
      color: var(--td-text-color-primary);
      font-family: var(--td-font-family-mono, monospace);
      font-variant-numeric: tabular-nums;
    }
  }
}

.hold-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.hold-name {
  font-size: 14px;
  color: var(--td-text-color-primary);
}

.hold-w {
  font-variant-numeric: tabular-nums;
  font-size: 14px;
  font-weight: 500;
  color: var(--td-text-color-secondary);
}

@media (width <= 767px) {
  .overview-strip {
    gap: 12px;
  }

  .overview-strip__divider {
    display: none;
  }

  .overview-strip__item {
    flex: 1 1 40%;
  }

  .opp-grid {
    grid-template-columns: 1fr;
  }
}
</style>
