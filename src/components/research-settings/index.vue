<template>
  <div class="rs">
    <!-- ① 分位档位 -->
    <div class="setting-group-title">
      估值分位档位
      <t-tag v-if="bandsDirty" size="small" theme="warning" variant="light">已改动</t-tag>
    </div>
    <p class="rs-hint">分位落在哪一档，决定买卖信号和仓位建议。改完立刻生效（含晨会事实包），无需重新部署。</p>

    <table class="rs-bands">
      <thead>
        <tr>
          <th>分位区间</th>
          <th>标签</th>
          <th>仓位建议</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(b, i) in draft" :key="i">
          <td class="rs-range">
            <span v-if="i > 0" class="rs-range-pre">{{ draft[i - 1]!.max }}% ~</span>
            <span class="rs-range-pre">＜</span>
            <t-input-number
              v-if="i < draft.length - 1"
              v-model="b.max"
              theme="normal"
              size="small"
              class="rs-num"
              :min="1"
              :max="99"
              :step="5"
              @change="commitBands"
            />
            <span v-else class="rs-range-cap">100%</span>
          </td>
          <td>
            <t-input v-model="b.label" size="small" class="rs-text" @change="commitBands" />
          </td>
          <td>
            <t-input v-model="b.tilt" size="small" class="rs-text rs-wide" @change="commitBands" />
          </td>
        </tr>
      </tbody>
    </table>

    <div class="rs-row-actions">
      <t-button v-if="bandsDirty" size="small" variant="text" @click="resetBandsAndDraft">恢复默认档位</t-button>
      <span v-else class="rs-dim">当前为默认档位</span>
    </div>

    <!-- ② 研判模型 -->
    <div class="setting-group-title">
      晨会模型
      <t-tag v-if="modelDirty" size="small" theme="warning" variant="light">已改动</t-tag>
    </div>
    <p class="rs-hint">
      选项来自 <code>/llm/v1/models</code>，取不到就只剩当前值。改完下一份晨会生效，旧晨会不受影响。
    </p>
    <t-select
      v-model="modelDraft"
      size="small"
      class="rs-model"
      :options="modelOptions"
      :loading="modelsLoading"
      filterable
      :creatable="false"
      placeholder="选一个模型"
      @change="onModelChange"
    />
    <div class="rs-row-actions">
      <t-button v-if="modelDirty" size="small" variant="text" @click="onResetModel">恢复默认模型</t-button>
      <span v-else class="rs-dim">当前为默认（{{ DEFAULT_MODEL }}）</span>
    </div>
    <p v-if="modelsError" class="rs-err">模型列表取不到：{{ modelsError }}</p>

    <!-- ③ 数据源自检 -->
    <div class="setting-group-title">数据源自检</div>
    <p class="rs-hint">
      「重取并自检」会清掉本页内存缓存，并绕过服务端缓存真打一次上游 —— 它既验证通路又把缓存换成新的。
      「仅自检」走缓存，用来看缓存里到底有没有东西。
    </p>

    <div class="rs-row-actions rs-actions-top">
      <t-button size="small" theme="primary" :loading="running" @click="check(true)">重取并自检</t-button>
      <t-button size="small" variant="outline" :disabled="running" @click="check(false)">仅自检</t-button>
      <t-button size="small" variant="text" :disabled="running" @click="clearMem">清空本页缓存</t-button>
    </div>

    <div v-if="summary" class="rs-summary">{{ summary }}</div>

    <table class="rs-health">
      <tbody>
        <tr v-for="row in rows" :key="row.id">
          <td class="rs-h-name">
            <span class="rs-dot" :class="`rs-dot--${row.status}`" />
            {{ row.name }}
          </td>
          <td class="rs-h-meta">
            <code>{{ row.path }}</code>
            <span class="rs-dim">TTL {{ row.ttl }}</span>
            <span class="rs-dim">缓存 {{ cacheAt(row) }}</span>
          </td>
          <td class="rs-h-detail">
            <span v-if="row.status === 'idle'" class="rs-dim">未测</span>
            <template v-else>
              {{ row.detail }}
              <span v-if="row.ms" class="rs-dim">{{ row.ms }}ms</span>
            </template>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { lastOkFor, marketClearMemory } from '@/utils/market-cache';
import type { ValuationBand } from '@/utils/research-settings';
import {
  bands as liveBands,
  briefingModel,
  DEFAULT_MODEL,
  isBandsOverridden,
  isModelOverridden,
  resetBands,
  resetModel,
  saveBands,
  saveModel,
} from '@/utils/research-settings';
import type { HealthRow } from '@/utils/source-health';
import { fetchLlmModels, initialRows, runHealthCheck } from '@/utils/source-health';

/* ---------- ① 档位 ---------- */

// 编辑用草稿。改完一次 @change 就规范化回填，所以界面上看到的永远是生效值，
// 不会出现「输入框里是 90、实际生效 85」这种两套真相。
const draft = ref<ValuationBand[]>(liveBands.value.map((b) => ({ ...b })));
const bandsDirty = computed(() => isBandsOverridden());

function commitBands() {
  saveBands(draft.value.map((b) => ({ ...b })));
  draft.value = liveBands.value.map((b) => ({ ...b }));
}

function resetBandsAndDraft() {
  resetBands();
  draft.value = liveBands.value.map((b) => ({ ...b }));
}

/* ---------- ② 模型 ---------- */

const models = ref<string[]>([]);
const modelsLoading = ref(false);
const modelsError = ref('');
const modelDraft = ref(briefingModel.value);
const modelDirty = computed(() => isModelOverridden());

const modelOptions = computed(() => models.value.map((m) => ({ label: m, value: m })));

function onModelChange(v: unknown) {
  if (typeof v === 'string' && v.trim()) saveModel(v);
}

function onResetModel() {
  resetModel();
  modelDraft.value = briefingModel.value;
}

onMounted(async () => {
  modelsLoading.value = true;
  try {
    const list = await fetchLlmModels();
    // 当前值不在列表里也要能显示出来，否则下拉框会空着
    models.value = list.includes(briefingModel.value) ? list : [briefingModel.value, ...list];
  } catch (e) {
    modelsError.value = e instanceof Error ? e.message : String(e);
    models.value = [briefingModel.value];
  } finally {
    modelsLoading.value = false;
  }
});

/* ---------- ③ 自检 ---------- */

const rows = ref<HealthRow[]>(initialRows());
const running = ref(false);

function upsert(row: HealthRow) {
  const i = rows.value.findIndex((r) => r.id === row.id);
  if (i >= 0) rows.value[i] = row;
}

async function check(force: boolean) {
  running.value = true;
  rows.value = initialRows();
  try {
    await runHealthCheck(force, upsert);
  } finally {
    running.value = false;
  }
}

function clearMem() {
  marketClearMemory();
  rows.value = initialRows();
}

const summary = computed(() => {
  const ok = rows.value.filter((r) => r.status === 'ok').length;
  const fail = rows.value.filter((r) => r.status === 'fail').length;
  if (!ok && !fail) return '';
  return `${ok} 正常 / ${fail} 失败 / 共 ${rows.value.length} 个源`;
});

function fmtAgo(ts: number | null): string {
  if (!ts) return '无记录';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s 前`;
  if (s < 3600) return `${Math.round(s / 60)} 分钟前`;
  if (s < 86400) return `${Math.round(s / 3600)} 小时前`;
  return `${Math.round(s / 86400)} 天前`;
}

function cacheAt(row: HealthRow): string {
  return row.cacheKey ? fmtAgo(lastOkFor(row.cacheKey)) : '—';
}
</script>
<!-- scoped 照样生效：作用域属性挂在元素自己身上，不靠 DOM 位置，
     drawer 把内容 teleport 到 body 也不影响。 -->
<style lang="less" scoped>
.rs {
  .rs-hint {
    margin: 0 0 12px;
    font-size: 12px;
    line-height: 18px;
    color: var(--td-text-color-secondary);

    code {
      font-size: 11px;
      padding: 0 3px;
      border-radius: 3px;
      background: var(--td-bg-color-secondarycontainer);
    }
  }

  .rs-dim {
    color: var(--td-text-color-placeholder);
    font-size: 12px;
  }

  .rs-err {
    margin: 8px 0 0;
    font-size: 12px;
    color: var(--td-error-color);
  }

  .rs-bands {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 4px;

    th {
      font-size: 12px;
      font-weight: 500;
      text-align: left;
      color: var(--td-text-color-secondary);
      padding: 0 4px 6px 0;
      border-bottom: 1px solid var(--td-component-stroke);
    }

    td {
      padding: 5px 4px 5px 0;
      vertical-align: middle;
    }

    tr:not(:last-child) td {
      border-bottom: 1px solid var(--td-component-stroke);
    }
  }

  .rs-range {
    white-space: nowrap;
    font-size: 12px;
    color: var(--td-text-color-secondary);
  }

  .rs-range-pre {
    margin-right: 2px;
  }

  .rs-range-cap {
    color: var(--td-text-color-placeholder);
  }

  .rs-num {
    width: 62px;
  }

  .rs-text {
    width: 68px;
  }

  .rs-text.rs-wide {
    width: 104px;
  }

  .rs-model {
    width: 100%;
  }

  .rs-row-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 28px;
    margin-bottom: 4px;
  }

  .rs-actions-top {
    margin-bottom: 10px;
  }

  .rs-summary {
    font-size: 12px;
    margin-bottom: 8px;
    color: var(--td-text-color-secondary);
  }

  .rs-health {
    width: 100%;
    border-collapse: collapse;

    td {
      padding: 6px 0;
      font-size: 12px;
      vertical-align: top;
      border-bottom: 1px solid var(--td-component-stroke);
    }

    tr:last-child td {
      border-bottom: none;
    }
  }

  .rs-h-name {
    white-space: nowrap;
    padding-right: 8px !important;
    color: var(--td-text-color-primary);
  }

  .rs-h-meta {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding-right: 8px !important;

    code {
      font-size: 11px;
      color: var(--td-text-color-placeholder);
    }
  }

  .rs-h-detail {
    text-align: right;
    color: var(--td-text-color-secondary);
  }

  .rs-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    margin-right: 5px;
    border-radius: 50%;
    background: var(--td-text-color-placeholder);
    vertical-align: middle;

    &--running {
      background: var(--td-brand-color);
    }

    &--ok {
      background: var(--td-success-color);
    }

    &--fail {
      background: var(--td-error-color);
    }
  }

  .setting-group-title {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 24px 0 8px;

    &:first-child {
      margin-top: 4px;
    }
  }
}
</style>
