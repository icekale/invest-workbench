<template>
  <t-space direction="vertical" :size="16" style="width: 100%" class="recommend-page">
    <funds-nav />

    <!-- 顶部概览统计 -->
    <div class="picks-strip">
      <div class="picks-strip__item">
        <span class="picks-strip__label">全市场公募样本</span>
        <span class="picks-strip__val">{{ funds.length || 7249 }} <small>只</small></span>
      </div>
      <div class="picks-strip__divider" />
      <div class="picks-strip__item">
        <span class="picks-strip__label">核心精选入池</span>
        <span class="picks-strip__val highlight">{{ recommendedFunds.length }} <small>只</small></span>
      </div>
      <div class="picks-strip__divider" />
      <div class="picks-strip__item">
        <span class="picks-strip__label">精选标准</span>
        <span class="picks-strip__val text-desc">机构持仓≥50% · 规模>10亿 · 收益>|回撤|</span>
      </div>
      <div class="picks-strip__divider" />
      <div class="picks-strip__item">
        <span class="picks-strip__label">智选策略组合</span>
        <span class="picks-strip__val">4 <small>套大类方案</small></span>
      </div>
    </div>

    <t-alert v-if="error" theme="warning" :message="error" />

    <!-- 智选策略配置方案 -->
    <t-card title="智选策略配置方案" subtitle="按风险等级与资金性质精选标的，支持穿透查看底层基金">
      <template #actions>
        <t-button size="small" variant="text" theme="primary" @click="router.push('/funds/portfolios')">
          前往组合调优 →
        </t-button>
      </template>
      <t-row :gutter="[16, 16]">
        <t-col v-for="p in smartPortfolios" :key="p.id" :xs="12" :sm="6" :xl="3">
          <div class="portfolio-card">
            <div class="card-hd">
              <span class="portfolio-name">{{ p.name }}</span>
              <t-tag size="small" :theme="riskTheme(p.risk)" variant="light">{{ p.risk }}风险</t-tag>
            </div>
            <p class="portfolio-blurb">{{ p.blurb }}</p>
            <div class="fund-list">
              <div v-for="f in p.funds" :key="f.code" class="fund-row" @click="router.push(`/funds/detail/${f.code}`)">
                <div class="fund-info">
                  <div class="fund-name-line">
                    <span class="fund-name">{{ f.name || f.code }}</span>
                    <t-tag v-if="f.type" size="small" variant="outline" class="fund-type-tag">{{ f.type }}</t-tag>
                  </div>
                  <div class="fund-sub-line">
                    <span class="fund-code">{{ f.code }}</span>
                    <span v-if="f.nav != null" class="fund-nav">净值 {{ f.nav.toFixed(4) }}</span>
                    <span v-if="f.year != null" :class="f.year >= 0 ? 'gain-text' : 'loss-text'" class="fund-year">
                      1年 {{ f.year >= 0 ? '+' : '' }}{{ f.year.toFixed(2) }}%
                    </span>
                  </div>
                </div>
                <div class="fund-action">
                  <span class="fund-weight">{{ Math.round(f.weight * 100) }}%</span>
                </div>
              </div>
            </div>
          </div>
        </t-col>
      </t-row>
    </t-card>

    <!-- 优质精选核心池表格 -->
    <t-card title="优质精选核心池" subtitle="五星评级 · 机构重仓 · 严格风控校验 · 点击任一行可查看基金穿透分析">
      <template #actions>
        <t-space :size="8">
          <t-radio-group v-model="tab" variant="default-filled">
            <t-radio-button value="全部">全部 ({{ recommendedFunds.length }})</t-radio-button>
            <t-radio-button v-for="t in tabs" :key="t" :value="t"> {{ t }} ({{ getCountByType(t) }}) </t-radio-button>
          </t-radio-group>
        </t-space>
      </template>

      <div class="table-wrap">
        <t-table
          :data="rows"
          :columns="cols"
          row-key="code"
          hover
          :loading="loading"
          :pagination="pagination"
          :on-row-click="({ row }) => router.push(`/funds/detail/${row.code}`)"
          @page-change="onPageChange"
        >
          <template #name="{ row }">
            <div class="fund-cell-name">
              <strong>{{ row.name }}</strong>
              <t-tag size="small" variant="outline" style="margin-left: 6px">{{ row.type }}</t-tag>
            </div>
          </template>
          <template #code="{ row }">
            <span class="tabular-nums code-text">{{ row.code }}</span>
          </template>
          <template #yield="{ row }">
            <span
              class="tabular-nums font-bold"
              :class="row.yield > 0 ? 'gain-text' : row.yield < 0 ? 'loss-text' : ''"
            >
              {{ row.yield > 0 ? '+' : '' }}{{ row.yield.toFixed(2) }}%
            </span>
          </template>
          <template #vix="{ row }">
            <span class="tabular-nums">{{ row.vix.toFixed(2) }}</span>
          </template>
          <template #loss="{ row }">
            <span class="tabular-nums loss-text font-bold">{{ row.loss.toFixed(2) }}%</span>
          </template>
          <template #rating="{ row }">
            <t-tag size="small" theme="warning" variant="light"> ★ {{ row.rating || '五星' }} </t-tag>
          </template>
          <template #scale="{ row }">
            <span class="tabular-nums">{{ row.scale ? row.scale.toFixed(1) : '—' }}</span>
          </template>
          <template #op="{ row }">
            <t-link theme="primary" hover="color" @click.stop="router.push(`/funds/detail/${row.code}`)">
              穿透分析 →
            </t-link>
          </template>
        </t-table>
      </div>
    </t-card>
  </t-space>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { smartPortfolios } from '@/mock/invest';
import type { SampleFund } from '@/utils/fund-model';
import { FUND_TYPES, isRecommend, loadSample } from '@/utils/fund-model';

import FundsNav from './FundsNav.vue';

defineOptions({ name: 'FundsRecommend' });

const router = useRouter();
const loading = ref(false);
const error = ref('');
const funds = ref<SampleFund[]>([]);
const tab = ref('全部');
const tabs = FUND_TYPES.filter((t) => t !== 'QDII');

const pagination = reactive({
  defaultCurrent: 1,
  defaultPageSize: 15,
  total: 0,
  showJumper: true,
});

const recommendedFunds = computed(() => funds.value.filter(isRecommend));

const filteredFunds = computed(() => {
  if (tab.value === '全部') {
    return recommendedFunds.value;
  }
  return recommendedFunds.value.filter((f) => f.type === tab.value);
});

const rows = computed(() => {
  const start = (pagination.defaultCurrent - 1) * pagination.defaultPageSize;
  const end = start + pagination.defaultPageSize;
  return filteredFunds.value.slice(start, end);
});

function getCountByType(type: string) {
  return recommendedFunds.value.filter((f) => f.type === type).length;
}

function onPageChange(pageInfo: { current: number; pageSize: number }) {
  pagination.defaultCurrent = pageInfo.current;
  pagination.defaultPageSize = pageInfo.pageSize;
}

const cols = [
  { colKey: 'name', title: '基金名称与分类', minWidth: 200 },
  { colKey: 'code', title: '代码', width: 90 },
  { colKey: 'yield', title: '近1年收益率', width: 120, sorter: (a: any, b: any) => a.yield - b.yield },
  { colKey: 'vix', title: '波动率(STDDEV)', width: 120, sorter: (a: any, b: any) => a.vix - b.vix },
  { colKey: 'loss', title: '最大回撤', width: 110, sorter: (a: any, b: any) => a.loss - b.loss },
  { colKey: 'rating', title: '研选评级', width: 100 },
  { colKey: 'scale', title: '规模(亿元)', width: 100 },
  { colKey: 'op', title: '操作', width: 100 },
];

function riskTheme(risk: string): 'default' | 'success' | 'warning' | 'danger' {
  if (risk === '低') return 'success';
  if (risk === '中低') return 'default';
  if (risk === '中') return 'warning';
  return 'danger';
}

onMounted(async () => {
  loading.value = true;
  try {
    funds.value = await loadSample();
    pagination.total = recommendedFunds.value.length;
  } catch (e) {
    error.value = e instanceof Error ? e.message : '样本加载失败';
  } finally {
    loading.value = false;
  }
});
</script>
<style scoped lang="less">
.recommend-page {
  padding-bottom: 32px;
}

/* 顶部概览条 */
.picks-strip {
  display: flex;
  align-items: center;
  background: var(--td-bg-color-container);
  border-radius: 10px;
  padding: 12px 20px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 4%);
  gap: 16px;
  overflow-x: auto;
  white-space: nowrap;

  &__item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__label {
    font-size: 11px;
    color: var(--td-text-color-secondary);
  }

  &__val {
    font-size: 16px;
    font-weight: 700;
    color: var(--td-text-color-primary);
    font-family: var(--td-font-family-mono, monospace);
    font-variant-numeric: tabular-nums;

    small {
      font-size: 11px;
      font-weight: 400;
      color: var(--td-text-color-secondary);
      margin-left: 2px;
    }

    &.highlight {
      color: var(--td-brand-color, #0d706d);
    }

    &.text-desc {
      font-size: 12px;
      font-weight: 500;
      font-family: inherit;
      color: var(--td-text-color-secondary);
    }
  }

  &__divider {
    width: 1px;
    height: 24px;
    background: var(--td-border-level-1-color);
    flex-shrink: 0;
  }
}

/* 策略卡片 */
.portfolio-card {
  background: var(--td-bg-color-secondarycontainer, #f8fafb);
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 8px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  height: 100%;

  .card-hd {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;

    .portfolio-name {
      font-size: 14px;
      font-weight: 700;
      color: var(--td-text-color-primary);
    }
  }

  .portfolio-blurb {
    font-size: 11px;
    color: var(--td-text-color-secondary);
    line-height: 1.4;
    margin: 0 0 10px;
  }

  .fund-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: auto;

    .fund-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--td-bg-color-container);
      border: 1px solid var(--td-border-level-1-color);
      border-radius: 6px;
      padding: 6px 8px;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        border-color: var(--td-brand-color, #0d706d);
        background: #f0f7f6;
      }

      .fund-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        flex: 1;

        .fund-name-line {
          display: flex;
          align-items: center;
          gap: 6px;

          .fund-name {
            font-size: 12px;
            font-weight: 600;
            color: var(--td-text-color-primary);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .fund-type-tag {
            font-size: 10px;
            padding: 0 4px;
            height: 16px;
            line-height: 14px;
          }
        }

        .fund-sub-line {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          font-family: var(--td-font-family-mono, monospace);

          .fund-code {
            color: var(--td-text-color-placeholder);
          }

          .fund-nav {
            color: var(--td-text-color-secondary);
          }
        }
      }

      .fund-action {
        margin-left: 8px;
        flex-shrink: 0;

        .fund-weight {
          font-size: 12px;
          font-weight: 700;
          font-family: var(--td-font-family-mono, monospace);
          color: var(--td-brand-color, #0d706d);
          background: rgb(13 112 109 / 8%);
          padding: 2px 6px;
          border-radius: 4px;
        }
      }
    }
  }
}

.table-wrap {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
}

.fund-cell-name {
  display: flex;
  align-items: center;
}

.code-text {
  font-family: var(--td-font-family-mono, monospace);
  color: var(--td-text-color-placeholder);
}

.font-bold {
  font-weight: 700;
}

.gain-text {
  color: var(--guanlan-gain, #b8433e);
}

.loss-text {
  color: var(--guanlan-loss, #16815f);
}
</style>
