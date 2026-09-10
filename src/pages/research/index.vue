<template>
  <t-space class="page" direction="vertical" :size="16" style="width: 100%">
    <div class="overview-strip">
      <button type="button" class="overview-strip__item" @click="openTab('macro')">
        <span class="overview-strip__label">仓位立场</span>
        <span class="overview-strip__val highlight">{{ invest.macroWeather?.sentiment }}</span>
      </button>
      <div class="overview-strip__divider" />
      <button type="button" class="overview-strip__item" @click="router.push('/review/index')">
        <span class="overview-strip__label">待执行交易</span>
        <span class="overview-strip__val">{{ openTodos.length }} <small>项计划</small></span>
      </button>
      <div class="overview-strip__divider" />
      <button type="button" class="overview-strip__item" @click="router.push('/funds/index')">
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
      <t-radio-button value="macro">仓位定调</t-radio-button>
      <t-radio-button value="catalyst">事件催化</t-radio-button>
      <t-radio-button value="valuation">估值信号</t-radio-button>
    </t-radio-group>

    <div v-show="tab === 'macro'" class="research-pane">
      <briefing-card
        :written="writtenKeys"
        :applied="weatherApplied"
        @retry="bootBriefing(true)"
        @commit="commitBriefingTodo"
        @apply-weather="applyBriefingWeather"
      />
      <macro-compass />
      <etf-radar />
    </div>
    <div v-show="tab === 'catalyst'" class="research-pane">
      <research-desk />
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
import { useRouter } from 'vue-router';

import { useInvestStore } from '@/store';
import type { BriefingTodoDraft } from '@/types/invest';
import type { FactPackInput, HoldingSlice } from '@/utils/briefing';
import {
  alreadyOpen,
  buildFactPack,
  decorateBriefing,
  ensureTodayBriefing,
  QUOTE_WAIT_MS,
  readCachedBriefing,
  shiftDate,
  todoDraftKey,
  weatherFromBriefing,
  weatherMatchesBriefing,
} from '@/utils/briefing';
import { todayCN } from '@/utils/date';
import { impliedRef, mergeScenario, scenarioTarget, scenarioUpside } from '@/utils/scenario';
import type { SwClass } from '@/utils/sw-industry';
import { fetchSwClass, swGroupOf } from '@/utils/sw-industry';

import BriefingCard from './BriefingCard.vue';
import EtfRadar from './EtfRadar.vue';
import MacroCompass from './MacroCompass.vue';
import ResearchDesk from './ResearchDesk.vue';
import { bargainCount, briefing, briefingStatus, macroState, valuationItems } from './state';
import ValuationRadar from './ValuationRadar.vue';

defineOptions({ name: 'ResearchIndex' });

type Tab = 'macro' | 'catalyst' | 'valuation';

const router = useRouter();
const invest = useInvestStore();
const tab = ref<Tab>('macro');
const swMap = ref<Record<string, SwClass>>({});
const openTodos = computed(() => invest.todos.filter((t) => t.status === 'open'));
const writtenKeys = computed(() => {
  const s = new Set<string>();
  for (const t of invest.todos) {
    if (t.status === 'open') s.add(todoDraftKey(t));
  }
  return s;
});
const weatherApplied = computed(() => !!briefing.value && weatherMatchesBriefing(invest.macroWeather, briefing.value));

function openTab(next: Tab) {
  tab.value = next;
}

function baseOf(code: string, last: number | null) {
  const saved = invest.priceScenarios.find((s) => s.code === code);
  const s = mergeScenario(code, saved);
  const q = invest.quotes[code];
  const live = (s.metric === 'bvps' ? q?.pb : q?.pe) ?? null;
  const ref = s.ref != null && s.ref > 0 ? s.ref : impliedRef(last, live);
  const baseTarget = scenarioTarget(ref, s.base.growth, s.base.multiple);
  return { baseTarget, baseUpside: scenarioUpside(last, baseTarget) };
}

function factInput(): FactPackInput {
  const holdings: HoldingSlice[] = invest.enriched.map((h) => {
    const { baseTarget, baseUpside } = baseOf(h.code, h.last);
    return {
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
      last: h.last,
      industry: swGroupOf({ code: h.code, tag: h.tag, name: h.name }, swMap.value, 'l1'),
      baseTarget,
      baseUpside,
    };
  });
  const yesterday = readCachedBriefing(localStorage, shiftDate(todayCN(), -1));
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
    yesterdayStance: yesterday?.stance ?? null,
    industries: invest.industryFocus,
  };
}

async function waitQuotes() {
  const start = Date.now();
  while (invest.quoteLoading && Date.now() - start < QUOTE_WAIT_MS) {
    await new Promise((r) => setTimeout(r, 200));
  }
}

async function loadSw() {
  const codes = invest.holdings.filter((h) => h.account === 'stock').map((h) => h.code);
  if (!codes.length) {
    swMap.value = {};
    return;
  }
  try {
    swMap.value = await fetchSwClass(codes);
  } catch {
    /* keep last map */
  }
}

async function bootBriefing(force = false) {
  if (typeof localStorage === 'undefined') return;
  if (!force) {
    const cached = readCachedBriefing(localStorage, todayCN());
    if (cached) {
      briefing.value = decorateBriefing(cached, buildFactPack(factInput()));
      briefingStatus.value = 'ready';
      return;
    }
  }
  briefingStatus.value = 'loading';
  if (!force) await waitQuotes();
  await loadSw();
  const extra: Promise<unknown>[] = [];
  if (!invest.macroEventsLastUpdated) extra.push(invest.refreshMacroEvents().catch(() => {}));
  if (!invest.industryFocusLastUpdated) extra.push(invest.refreshIndustryFocus().catch(() => {}));
  if (extra.length) await Promise.all(extra);
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

function applyBriefingWeather() {
  if (!briefing.value) return;
  invest.updateMacroWeather(weatherFromBriefing(briefing.value, invest.macroWeather));
  MessagePlugin.success('已写入仓位立场');
}

onMounted(() => {
  void bootBriefing(false);
  if (!invest.macroEventsLastUpdated) void invest.refreshMacroEvents();
  if (!invest.industryFocusLastUpdated) void invest.refreshIndustryFocus();
});
</script>
