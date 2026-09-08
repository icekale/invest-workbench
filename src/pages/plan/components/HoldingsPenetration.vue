<template>
  <div class="holdings-penetration">
    <!-- 头部：透视说明与标的选择器 -->
    <t-card class="penetration-header-card">
      <div class="header-main-row">
        <div class="header-title-group">
          <h3 class="header-title">🔍 ETF 与公募基金底层持仓穿透透视</h3>
          <p class="header-sub">穿透底层前十大重仓股票、行业集中度与风格漂移，识别“假分散、真集中”的隐形重叠风险</p>
        </div>
        <div class="header-quick-btns">
          <t-button size="small" theme="primary" variant="outline" @click="loadMyEtfHoldings">
            <template #icon><t-icon name="user" /></template>
            一键载入我的实盘 ETF 持仓
          </t-button>
        </div>
      </div>

      <t-divider style="margin: 12px 0 16px" />

      <!-- 标的组合选择池 -->
      <div class="fund-selection-area">
        <span class="selection-label">纳入穿透分析的标的池 (勾选并微调权重)：</span>
        <div class="fund-chips-grid">
          <div
            v-for="fund in availableFundsList"
            :key="fund.code"
            class="fund-chip"
            :class="{ 'is-selected': isFundSelected(fund.code) }"
            @click="toggleFund(fund.code)"
          >
            <div class="chip-top">
              <t-checkbox :checked="isFundSelected(fund.code)" @click.stop @change="() => toggleFund(fund.code)" />
              <strong class="fund-name">{{ fund.name }}</strong>
              <t-tag size="small" :theme="fund.type === 'ETF' ? 'primary' : 'warning'" variant="light">
                {{ fund.tag }}
              </t-tag>
            </div>
            <div class="chip-bottom" @click.stop>
              <span class="fund-code code-mono">{{ fund.code }}</span>
              <div v-if="isFundSelected(fund.code)" class="chip-weight-box">
                <span class="weight-label">权重:</span>
                <t-input-number
                  :value="Math.round(getFundWeight(fund.code) * 100)"
                  :min="1"
                  :max="100"
                  :step="5"
                  size="small"
                  style="width: 76px"
                  @change="(v) => setFundWeight(fund.code, Number(v))"
                />
                <span class="weight-unit">%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </t-card>

    <!-- 智能穿透诊断洞察 -->
    <div v-if="report.overlapInsights.length" class="penetration-insights-grid">
      <div
        v-for="(insight, idx) in report.overlapInsights"
        :key="idx"
        class="insight-card"
        :class="`insight-${insight.type}`"
      >
        <div class="insight-hd">
          <span class="insight-icon">{{
            insight.type === 'risk' ? '🚨' : insight.type === 'warning' ? '⚠️' : '🛡️'
          }}</span>
          <strong class="insight-title">{{ insight.title }}</strong>
        </div>
        <p class="insight-desc">{{ insight.desc }}</p>
      </div>
    </div>

    <!-- 穿透核心 KPI 看板 (集中度) -->
    <t-row :gutter="[14, 14]">
      <t-col :xs="12" :sm="6" :md="3">
        <div class="kpi-card">
          <span class="kpi-title">穿透涵盖底层股票</span>
          <strong class="kpi-num num-mono"
            >{{ report.consolidatedStocks.length }} <small>只核心个股/资产</small></strong
          >
          <span class="kpi-footer">覆盖两市及境外主流核心资产</span>
        </div>
      </t-col>
      <t-col :xs="12" :sm="6" :md="3">
        <div class="kpi-card">
          <span class="kpi-title">CR3 (前三大重仓集中度)</span>
          <strong class="kpi-num num-mono" :class="report.cr3 > 20 ? 'text-warn' : ''"
            >{{ report.cr3.toFixed(1) }}%</strong
          >
          <span class="kpi-footer"
            >前三:
            {{
              report.consolidatedStocks
                .slice(0, 3)
                .map((s) => s.name)
                .join('、')
            }}</span
          >
        </div>
      </t-col>
      <t-col :xs="12" :sm="6" :md="3">
        <div class="kpi-card">
          <span class="kpi-title">CR5 (前五大重仓集中度)</span>
          <strong class="kpi-num num-mono">{{ report.cr5.toFixed(1) }}%</strong>
          <span class="kpi-footer">前五大重仓穿透有效权重总和</span>
        </div>
      </t-col>
      <t-col :xs="12" :sm="6" :md="3">
        <div class="kpi-card">
          <span class="kpi-title">CR10 (前十大重仓集中度)</span>
          <strong class="kpi-num num-mono" :class="report.cr10 > 40 ? 'text-warn' : ''"
            >{{ report.cr10.toFixed(1) }}%</strong
          >
          <span class="kpi-footer">{{ report.cr10 > 40 ? '集中度偏高，防范单边波动' : '集中度适中，结构均衡' }}</span>
        </div>
      </t-col>
    </t-row>

    <!-- 主体分析：左侧底层穿透清单，右侧行业暴露与风格分布 -->
    <t-row :gutter="[14, 14]">
      <!-- 左侧：底层股票综合穿透清单 -->
      <t-col :xs="12" :lg="8">
        <t-card title="底层前十大重仓穿透与综合暴露 (Effective Weight)">
          <template #actions>
            <span class="card-action-hint">按组合内实际合并穿透占比降序排列</span>
          </template>
          <div class="table-wrap">
            <t-table
              :data="report.consolidatedStocks"
              :columns="stockColumns"
              row-key="code"
              size="small"
              hover
              class="guanlan-penetration-table"
            >
              <template #stockName="{ row }">
                <div class="stock-name-cell">
                  <div class="stock-title-line">
                    <strong class="stock-title">{{ row.name }}</strong>
                    <span class="stock-code code-mono">{{ row.code }}</span>
                  </div>
                  <div class="stock-tags">
                    <t-tag size="small" variant="light">{{ row.sector }}</t-tag>
                    <t-tag size="small" variant="outline">{{ row.marketCapStyle }}</t-tag>
                    <span v-if="row.pe" class="pe-hint num-mono">PE: {{ row.pe }}x</span>
                  </div>
                </div>
              </template>

              <template #effectiveWeight="{ row }">
                <div class="eff-weight-cell">
                  <div class="weight-val-row">
                    <strong class="eff-pct num-mono">{{ (row.totalEffectiveWeight * 100).toFixed(2) }}%</strong>
                  </div>
                  <t-progress
                    :percentage="Number((row.totalEffectiveWeight * 100 * 5).toFixed(0))"
                    :label="false"
                    size="small"
                    color="#0d706d"
                    style="width: 90px"
                  />
                </div>
              </template>

              <template #contributions="{ row }">
                <div class="contributions-cell">
                  <div v-for="c in row.contributions" :key="c.fundCode" class="contrib-item">
                    <span class="f-name">{{ c.fundName }}:</span>
                    <span class="f-val num-mono"
                      >{{ (c.stockWeightInFund * 100).toFixed(1) }}% × {{ (c.fundWeight * 100).toFixed(0) }}% =
                      <strong>{{ (c.effectiveWeight * 100).toFixed(2) }}%</strong></span
                    >
                  </div>
                </div>
              </template>
            </t-table>
          </div>
        </t-card>
      </t-col>

      <!-- 右侧：行业分布与风格透视 -->
      <t-col :xs="12" :lg="4">
        <t-space direction="vertical" :size="14" style="width: 100%">
          <!-- 行业穿透分布 -->
          <t-card title="行业穿透暴露占比">
            <div class="sector-list">
              <div v-for="sec in report.sectorDistribution" :key="sec.name" class="sector-item">
                <div class="sector-info">
                  <span class="sector-name">{{ sec.name }}</span>
                  <span class="sector-pct num-mono">{{ sec.value }}%</span>
                </div>
                <div class="sector-bar-track">
                  <div
                    class="sector-bar-fill"
                    :style="{ width: `${Math.min(100, sec.value * 2.5)}%`, backgroundColor: sec.color }"
                  />
                </div>
              </div>
            </div>
          </t-card>

          <!-- 风格九宫格分布 -->
          <t-card title="市值风格穿透分布">
            <div class="style-list">
              <div v-for="st in report.styleDistribution" :key="st.name" class="style-item">
                <span class="st-name">{{ st.name }}</span>
                <div class="st-bar-wrap">
                  <t-progress :percentage="Number(st.value)" size="small" color="#dfb56d" :label="false" />
                </div>
                <span class="st-val num-mono">{{ st.value }}%</span>
              </div>
            </div>
          </t-card>
        </t-space>
      </t-col>
    </t-row>

    <!-- 两两基金重合度透视分析器 (Pairwise Overlap) -->
    <t-card title="两两基金底层重合度对决 (Overlap Analyzer)" style="margin-top: 14px">
      <template #actions>
        <span class="card-action-hint">选择两只基金，即时对比共有持仓与重复暴露</span>
      </template>

      <div class="overlap-matcher-wrap">
        <div class="matcher-inputs">
          <div class="fund-picker-col">
            <span class="picker-label">基金 A:</span>
            <t-select v-model="compareFundA" style="width: 220px">
              <t-option v-for="f in availableFundsList" :key="f.code" :value="f.code" :label="f.name" />
            </t-select>
          </div>
          <span class="vs-badge">VS</span>
          <div class="fund-picker-col">
            <span class="picker-label">基金 B:</span>
            <t-select v-model="compareFundB" style="width: 220px">
              <t-option v-for="f in availableFundsList" :key="f.code" :value="f.code" :label="f.name" />
            </t-select>
          </div>
        </div>

        <div class="overlap-result-box">
          <div class="overlap-score-banner">
            <span class="score-label">底层持仓重叠度系数:</span>
            <strong class="score-val num-mono" :class="pairwiseOverlap.overlapPct > 50 ? 'text-warn' : 'text-good'">
              {{ pairwiseOverlap.overlapPct }}%
            </strong>
            <t-tag
              size="small"
              :theme="
                pairwiseOverlap.overlapPct > 50 ? 'danger' : pairwiseOverlap.overlapPct > 20 ? 'warning' : 'success'
              "
              variant="light"
            >
              {{
                pairwiseOverlap.overlapPct > 50
                  ? '高度重合 (警惕伪分散)'
                  : pairwiseOverlap.overlapPct > 20
                    ? '中度重叠'
                    : '极低重合 (优良对冲)'
              }}
            </t-tag>
          </div>

          <div v-if="pairwiseOverlap.sharedStocks.length" class="shared-stocks-table">
            <span class="shared-title">共有底层重仓股票 ({{ pairwiseOverlap.sharedStocks.length }} 只)：</span>
            <div class="shared-chips-row">
              <div v-for="s in pairwiseOverlap.sharedStocks" :key="s.code" class="shared-chip">
                <span class="s-name">{{ s.name }}</span>
                <span class="s-overlap num-mono">重合 {{ (s.minWeight * 100).toFixed(1) }}%</span>
                <small class="s-detail num-mono"
                  >(A: {{ (s.weightA * 100).toFixed(1) }}% | B: {{ (s.weightB * 100).toFixed(1) }}%)</small
                >
              </div>
            </div>
          </div>
          <div v-else class="empty-shared">
            <span>两标的底层持仓完全无重合 (0% 交叉)，具有天然的风险隔离与风格互补效果。</span>
          </div>
        </div>
      </div>
    </t-card>
  </div>
</template>
<script setup lang="ts">
import type { PrimaryTableCol } from 'tdesign-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';
import { computed, reactive, ref } from 'vue';

import { useInvestStore } from '@/store';
import { calculateMultiFundPenetration, calculatePairwiseOverlap, FUND_CONSTITUENTS_DB } from '@/utils/penetration';

defineOptions({ name: 'HoldingsPenetration' });

const invest = useInvestStore();

const availableFundsList = computed(() => Object.values(FUND_CONSTITUENTS_DB));

// 默认选中的基金池与权重映射
const selectedFundsWeights = reactive<Record<string, number>>({
  sh560510: 0.35, // A500
  sh512890: 0.25, // 红利低波
  sh588000: 0.2, // 科创50
  sh511090: 0.2, // 30年国债
});

function isFundSelected(code: string): boolean {
  return code in selectedFundsWeights;
}

function getFundWeight(code: string): number {
  return selectedFundsWeights[code] || 0;
}

function setFundWeight(code: string, pctVal: number) {
  selectedFundsWeights[code] = Math.max(1, Math.min(100, pctVal)) / 100;
}

function toggleFund(code: string) {
  if (code in selectedFundsWeights) {
    if (Object.keys(selectedFundsWeights).length <= 1) {
      MessagePlugin.warning('至少保留 1 只分析标的');
      return;
    }
    delete selectedFundsWeights[code];
  } else {
    selectedFundsWeights[code] = 0.2; // 默认 20%
  }
}

// 一键载入用户当前实操的 ETF 仓位
function loadMyEtfHoldings() {
  const etfHoldings = invest.holdings.filter((h) => h.account === 'etf');
  if (!etfHoldings.length) {
    MessagePlugin.warning('当前无 ETF 持仓');
    return;
  }

  for (const k of Object.keys(selectedFundsWeights)) {
    delete selectedFundsWeights[k];
  }

  const totalMV = etfHoldings.reduce((sum, h) => {
    const q = invest.quotes[h.code];
    return sum + (h.quantity || 0) * (q?.price || h.cost || 1);
  }, 0);

  for (const h of etfHoldings) {
    if (FUND_CONSTITUENTS_DB[h.code]) {
      const q = invest.quotes[h.code];
      const mv = (h.quantity || 0) * (q?.price || h.cost || 1);
      selectedFundsWeights[h.code] = totalMV > 0 ? mv / totalMV : 0.2;
    }
  }

  MessagePlugin.success('已自动根据实盘持仓市值比例载入标的');
}

// 综合穿透分析报告
const report = computed(() => {
  const input = Object.entries(selectedFundsWeights).map(([code, weight]) => ({
    code,
    weight,
  }));
  return calculateMultiFundPenetration(input);
});

// 两两重叠分析器
const compareFundA = ref<string>('sh510300');
const compareFundB = ref<string>('sh560510');

const pairwiseOverlap = computed(() => {
  return calculatePairwiseOverlap(compareFundA.value, compareFundB.value);
});

const stockColumns: PrimaryTableCol[] = [
  { colKey: 'stockName', title: '底层重仓股票 / 资产', width: 220 },
  { colKey: 'effectiveWeight', title: '组合穿透综合占比', width: 160 },
  { colKey: 'contributions', title: '各持有基金渗透贡献 breakdown', minWidth: 260 },
];
</script>
<style lang="less" scoped>
.holdings-penetration {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.penetration-header-card {
  .header-main-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;

    .header-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--td-text-color-primary);
      margin: 0;
    }

    .header-sub {
      font-size: 12px;
      color: var(--td-text-color-secondary);
      margin: 4px 0 0;
    }
  }

  .fund-selection-area {
    display: flex;
    flex-direction: column;
    gap: 10px;

    .selection-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--td-text-color-primary);
    }

    .fund-chips-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 10px;

      .fund-chip {
        background: var(--td-bg-color-page);
        border: 1px solid var(--td-border-level-1-color);
        border-radius: 8px;
        padding: 8px 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        flex-direction: column;
        gap: 6px;

        &:hover {
          border-color: var(--td-brand-color, #0d706d);
        }

        &.is-selected {
          border-color: var(--td-brand-color, #0d706d);
          background: rgb(13 112 109 / 5%);
        }

        .chip-top {
          display: flex;
          align-items: center;
          gap: 6px;

          .fund-name {
            font-size: 13px;
            color: var(--td-text-color-primary);
          }
        }

        .chip-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;

          .fund-code {
            color: var(--td-text-color-secondary);
          }

          .chip-weight-box {
            display: flex;
            align-items: center;
            gap: 4px;

            .weight-label {
              color: var(--td-text-color-secondary);
            }

            .weight-unit {
              font-family: var(--td-font-family-mono, monospace);
            }
          }
        }
      }
    }
  }
}

.penetration-insights-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 10px;

  .insight-card {
    padding: 10px 14px;
    border-radius: 8px;
    border: 1px solid transparent;
    display: flex;
    flex-direction: column;
    gap: 4px;

    &.insight-risk {
      background: rgb(184 67 62 / 8%);
      border-color: rgb(184 67 62 / 25%);
    }

    &.insight-warning {
      background: rgb(184 120 45 / 8%);
      border-color: rgb(184 120 45 / 25%);
    }

    &.insight-positive {
      background: rgb(22 129 95 / 8%);
      border-color: rgb(22 129 95 / 25%);
    }

    .insight-hd {
      display: flex;
      align-items: center;
      gap: 6px;

      .insight-title {
        font-size: 13px;
        color: var(--td-text-color-primary);
      }
    }

    .insight-desc {
      margin: 0;
      font-size: 12px;
      color: var(--td-text-color-secondary);
      line-height: 1.4;
    }
  }
}

.kpi-card {
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;

  .kpi-title {
    font-size: 11px;
    color: var(--td-text-color-secondary);
  }

  .kpi-num {
    font-size: 20px;
    font-weight: 700;
    color: var(--td-text-color-primary);

    &.text-warn {
      color: var(--guanlan-warning, #b8782d);
    }

    small {
      font-size: 11px;
      font-weight: 400;
      color: var(--td-text-color-secondary);
    }
  }

  .kpi-footer {
    font-size: 11px;
    color: var(--td-text-color-placeholder);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.guanlan-penetration-table {
  .stock-name-cell {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .stock-title-line {
      display: flex;
      align-items: baseline;
      gap: 6px;

      .stock-title {
        font-size: 13px;
        color: var(--td-text-color-primary);
      }

      .stock-code {
        font-size: 11px;
        color: var(--td-text-color-secondary);
      }
    }

    .stock-tags {
      display: flex;
      align-items: center;
      gap: 4px;

      .pe-hint {
        font-size: 10px;
        color: var(--td-text-color-placeholder);
        margin-left: 2px;
      }
    }
  }

  .eff-weight-cell {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .eff-pct {
      font-size: 14px;
      font-weight: 700;
      color: var(--td-brand-color, #0d706d);
    }
  }

  .contributions-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;

    .contrib-item {
      font-size: 11px;
      color: var(--td-text-color-secondary);

      .f-name {
        margin-right: 4px;
      }

      .f-val {
        color: var(--td-text-color-placeholder);

        strong {
          color: var(--td-text-color-primary);
        }
      }
    }
  }
}

.sector-list {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .sector-item {
    display: flex;
    flex-direction: column;
    gap: 3px;

    .sector-info {
      display: flex;
      justify-content: space-between;
      font-size: 12px;

      .sector-name {
        color: var(--td-text-color-primary);
      }

      .sector-pct {
        font-weight: 600;
      }
    }

    .sector-bar-track {
      height: 6px;
      background: var(--td-bg-color-page);
      border-radius: 3px;
      overflow: hidden;

      .sector-bar-fill {
        height: 100%;
        border-radius: 3px;
      }
    }
  }
}

.style-list {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .style-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;

    .st-name {
      width: 70px;
      color: var(--td-text-color-secondary);
    }

    .st-bar-wrap {
      flex: 1;
    }

    .st-val {
      width: 40px;
      text-align: right;
      font-weight: 600;
    }
  }
}

.overlap-matcher-wrap {
  display: flex;
  flex-direction: column;
  gap: 14px;

  .matcher-inputs {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 16px;
    padding: 12px;
    background: var(--td-bg-color-page);
    border-radius: 8px;

    .fund-picker-col {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
    }

    .vs-badge {
      font-size: 14px;
      font-weight: 800;
      color: var(--td-brand-color, #0d706d);
      padding: 2px 8px;
      background: rgb(13 112 109 / 10%);
      border-radius: 999px;
    }
  }

  .overlap-result-box {
    display: flex;
    flex-direction: column;
    gap: 12px;

    .overlap-score-banner {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      font-size: 14px;

      .score-val {
        font-size: 24px;
        font-weight: 800;

        &.text-warn {
          color: var(--guanlan-warning, #b8782d);
        }

        &.text-good {
          color: var(--guanlan-gain, #16815f);
        }
      }
    }

    .shared-stocks-table {
      display: flex;
      flex-direction: column;
      gap: 6px;

      .shared-title {
        font-size: 12px;
        font-weight: 600;
        color: var(--td-text-color-primary);
      }

      .shared-chips-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;

        .shared-chip {
          background: var(--td-bg-color-container);
          border: 1px solid var(--td-border-level-1-color);
          border-radius: 6px;
          padding: 4px 10px;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 6px;

          .s-name {
            font-weight: 600;
            color: var(--td-text-color-primary);
          }

          .s-overlap {
            color: var(--guanlan-gain, #16815f);
            font-weight: 600;
          }

          .s-detail {
            color: var(--td-text-color-placeholder);
          }
        }
      }
    }

    .empty-shared {
      text-align: center;
      padding: 16px;
      font-size: 13px;
      color: var(--guanlan-gain, #16815f);
      background: rgb(22 129 95 / 5%);
      border-radius: 6px;
    }
  }
}
</style>
