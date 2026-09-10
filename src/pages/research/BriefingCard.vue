<template>
  <t-card class="briefing-card">
    <div class="briefing-card__head">
      <div>
        <span class="briefing-card__title">今日晨会研判</span>
        <t-tag v-if="briefing && briefingStatus === 'ready'" size="small" variant="light" :theme="stanceTheme">
          {{ briefing.stance }}
        </t-tag>
        <t-tag v-if="briefing?.conflicts?.length" size="small" theme="danger" variant="light">冲突</t-tag>
      </div>
      <t-space :size="8">
        <t-button
          v-if="briefing && briefingStatus === 'ready'"
          size="small"
          theme="primary"
          variant="outline"
          :disabled="applied"
          @click="$emit('apply-weather')"
        >
          {{ applied ? '已写入立场' : '写入仓位立场' }}
        </t-button>
        <t-button size="small" variant="outline" :loading="briefingStatus === 'loading'" @click="$emit('retry')">
          {{ briefingStatus === 'ready' ? '重新生成' : '重试' }}
        </t-button>
      </t-space>
    </div>

    <div v-if="briefingStatus === 'loading'" class="briefing-card__muted">正在生成今日研判…</div>
    <div v-else-if="briefingStatus !== 'ready' || !briefing" class="briefing-card__muted">今日研判未生成</div>
    <template v-else>
      <p class="briefing-card__headline">{{ briefing.headline }}</p>
      <p v-if="briefing.suggestedStockPos || briefing.suggestedEtfPos" class="briefing-card__pos">
        目标 股票 {{ briefing.suggestedStockPos || '—' }} · ETF {{ briefing.suggestedEtfPos || '—' }}
      </p>
      <p v-if="briefing.conflicts?.length" class="briefing-card__conflict">{{ briefing.conflicts[0] }}</p>
      <div v-if="briefing.cites?.length" class="briefing-card__cites">
        <span>依据</span>
        <t-tag v-for="c in briefing.cites" :key="c.label" size="small" variant="outline">{{ c.label }}</t-tag>
      </div>
      <div class="briefing-card__notes">
        <div><span>股票</span>{{ briefing.stockNote }}</div>
        <div><span>ETF</span>{{ briefing.etfNote }}</div>
      </div>
      <ul v-if="briefing.risks.length" class="briefing-card__risks">
        <li v-for="(r, i) in briefing.risks" :key="i">{{ r }}</li>
      </ul>
      <div v-for="(todo, i) in briefing.todos" :key="i" class="briefing-card__todo">
        <div>
          <strong>{{ todo.side === 'buy' ? '买' : '卖' }} {{ todo.name || todo.code || '未指定标的' }}</strong>
          <p>{{ todo.reason }}</p>
        </div>
        <t-button
          size="small"
          theme="primary"
          variant="outline"
          :disabled="written.has(todoKey(todo))"
          @click="$emit('commit', todo)"
        >
          {{ written.has(todoKey(todo)) ? '已写入' : '写入计划' }}
        </t-button>
      </div>
    </template>
  </t-card>
</template>
<script setup lang="ts">
import { computed } from 'vue';

import type { BriefingTodoDraft } from '@/types/invest';
import { todoDraftKey } from '@/utils/briefing';

import { briefing, briefingStatus } from './state';

defineProps<{
  written: Set<string>;
  applied?: boolean;
}>();
defineEmits<{ retry: []; commit: [todo: BriefingTodoDraft]; 'apply-weather': [] }>();

const stanceTheme = computed(() => {
  const s = briefing.value?.stance;
  if (s === '偏多') return 'danger';
  if (s === '防守') return 'success';
  return 'warning';
});

function todoKey(todo: BriefingTodoDraft) {
  return todoDraftKey(todo);
}
</script>
