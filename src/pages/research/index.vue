<template>
  <t-space class="page" direction="vertical" :size="16" style="width: 100%">
    <div class="overview-strip">
      <button type="button" class="overview-strip__item" @click="openTab('macro')">
        <span class="overview-strip__label">宏观周期定调</span>
        <span class="overview-strip__val highlight">{{ invest.macroWeather?.sentiment }} <small>偏好</small></span>
      </button>
      <div class="overview-strip__divider" />
      <button type="button" class="overview-strip__item" @click="openTab('desk')">
        <span class="overview-strip__label">待执行交易</span>
        <span class="overview-strip__val">{{ openTodos.length }} <small>项计划</small></span>
      </button>
      <div class="overview-strip__divider" />
      <button type="button" class="overview-strip__item" @click="openTab('desk')">
        <span class="overview-strip__label">机会池标的</span>
        <span class="overview-strip__val">{{ invest.opportunities.length }} <small>只跟踪</small></span>
      </button>
      <div class="overview-strip__divider" />
      <button type="button" class="overview-strip__item" @click="openTab('valuation')">
        <span class="overview-strip__label">估值低估机会</span>
        <span class="overview-strip__val" style="color: var(--guanlan-gain, #16815f)">
          {{ bargainCount }} <small>只极低/偏低</small>
        </span>
      </button>
      <div class="overview-strip__divider" />
      <button type="button" class="overview-strip__item" @click="openTab('macro')">
        <span class="overview-strip__label">宏观源状态</span>
        <span class="overview-strip__val edb-status">
          <span class="edb-dot" :class="{ 'is-down': macroState !== 'ok' }" />
          {{ macroState === 'ok' ? '已接入' : macroState === 'loading' ? '同步中' : '未接通' }}
        </span>
      </button>
    </div>

    <t-radio-group v-model="tab" variant="default-filled" class="research-nav">
      <t-radio-button value="macro">宏观定调</t-radio-button>
      <t-radio-button value="catalyst">事件催化</t-radio-button>
      <t-radio-button value="valuation">估值信号</t-radio-button>
      <t-radio-button value="desk">交易计划</t-radio-button>
    </t-radio-group>

    <div v-show="tab === 'macro'" class="research-pane">
      <briefing-card :written="writtenKeys" @retry="bootBriefing(true)" @commit="commitBriefingTodo" />
      <macro-compass />
      <etf-radar />
    </div>
    <div v-show="tab === 'catalyst' || tab === 'desk'" class="research-pane">
      <research-desk :pane="tab === 'desk' ? 'plan' : 'catalyst'" />
    </div>
    <div v-show="tab === 'valuation'" class="research-pane">
      <valuation-radar />
    </div>
  </t-space>
</template>
<script setup lang="ts">
import './research.less';

import { MessagePlugin } from 'tdesign-vue-next';
import { computed, onMounted, ref } from 'vue';

import { useInvestStore } from '@/store';
import type { BriefingTodoDraft } from '@/types/invest';
import type { FactPackInput, HoldingSlice } from '@/utils/briefing';
import {
  alreadyOpen,
  buildFactPack,
  ensureTodayBriefing,
  QUOTE_WAIT_MS,
  readCachedBriefing,
  todoDraftKey,
} from '@/utils/briefing';
import { todayCN } from '@/utils/date';

import BriefingCard from './BriefingCard.vue';
import EtfRadar from './EtfRadar.vue';
import MacroCompass from './MacroCompass.vue';
import ResearchDesk from './ResearchDesk.vue';
import { bargainCount, briefing, briefingStatus, macroState, valuationItems } from './state';
import ValuationRadar from './ValuationRadar.vue';

defineOptions({ name: 'ResearchIndex' });

type Tab = 'macro' | 'catalyst' | 'valuation' | 'desk';

const invest = useInvestStore();
const tab = ref<Tab>('macro');
const openTodos = computed(() => invest.todos.filter((t) => t.status === 'open'));
const writtenKeys = computed(() => {
  const s = new Set<string>();
  for (const t of invest.todos) {
    if (t.status === 'open') s.add(todoDraftKey(t));
  }
  return s;
});

function openTab(next: Tab) {
  tab.value = next;
}

function factInput(): FactPackInput {
  const holdings: HoldingSlice[] = invest.enriched.map((h) => ({
    account: h.account,
    code: h.code,
    name: h.name,
    quantity: h.quantity,
    cost: h.cost,
    marketValue: h.marketValue ?? null,
    pnl: h.pnl ?? null,
    pnlPct: h.pnlPct ?? null,
    health: h.health,
    action: h.action,
  }));
  return {
    date: todayCN(),
    weather: invest.macroWeather,
    indicators: invest.macroIndicators,
    events: invest.macroEvents,
    valuation: valuationItems.value.map((v) => ({
      name: v.name,
      code: v.code,
      pe: v.pe,
      percentile: v.pePercentile,
      advice: v.advice,
    })),
    holdings,
    cash: invest.cash,
    todos: invest.todos,
    alerts: invest.activeAlerts,
  };
}

async function waitQuotes() {
  const start = Date.now();
  while (invest.quoteLoading && Date.now() - start < QUOTE_WAIT_MS) {
    await new Promise((r) => setTimeout(r, 200));
  }
}

async function bootBriefing(force = false) {
  if (typeof localStorage === 'undefined') return;
  if (!force) {
    const cached = readCachedBriefing(localStorage, todayCN());
    if (cached) {
      briefing.value = cached;
      briefingStatus.value = 'ready';
      return;
    }
  }
  briefingStatus.value = 'loading';
  if (!force) await waitQuotes();
  const result = await ensureTodayBriefing({
    pack: buildFactPack(factInput()),
    storage: localStorage,
    today: todayCN(),
    force,
  });
  briefing.value = result.briefing;
  briefingStatus.value = result.status === 'ready' ? 'ready' : 'fail';
}

function commitBriefingTodo(todo: BriefingTodoDraft) {
  if (alreadyOpen(invest.todos, todo)) return;
  invest.addTodo({
    account: todo.account,
    code: todo.code,
    name: todo.name,
    side: todo.side,
    quantity: todo.quantity || 0,
    reason: todo.reason,
  });
  MessagePlugin.success('已写入交易计划');
}

onMounted(() => {
  void bootBriefing(false);
  if (!invest.macroEventsLastUpdated) void invest.refreshMacroEvents();
});
</script>
