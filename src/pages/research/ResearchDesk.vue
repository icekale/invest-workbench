<template>
  <div>
    <!-- 研判与决策主体区：左侧信号动态 + 右侧决策待办 -->
    <t-row :gutter="[16, 16]">
      <t-col :xs="12" :xl="7">
        <t-card title="宏观研判与事件催化">
          <!-- 四级标签切换 -->
          <div class="macro-subtabs-nav">
            <t-tabs v-model="macroSectionTab" theme="normal">
              <t-tab-panel value="signals" :label="`晨会研判 (${macros.length})`" />
              <t-tab-panel value="events" :label="`近期重点会议 (${invest.macroEvents.length})`" />
              <t-tab-panel value="industries" :label="`产业催化 (${invest.industryFocus.length})`" />
            </t-tabs>
          </div>

          <div v-if="macroSectionTab === 'signals'">
            <div class="macro-filter-row">
              <t-radio-group v-model="macroFilter" variant="default-filled">
                <t-radio-button value="all">全部</t-radio-button>
                <t-radio-button value="增长">增长</t-radio-button>
                <t-radio-button value="流动性">流动性</t-radio-button>
                <t-radio-button value="政策">政策</t-radio-button>
                <t-radio-button value="海外">海外</t-radio-button>
              </t-radio-group>
              <t-space :size="8" align="center">
                <span class="macro-count-hint">
                  华尔街见闻{{ invest.macroBriefsLastUpdated ? ` · ${invest.macroBriefsLastUpdated}` : '' }} ·
                  {{ macros.length }} 条
                </span>
                <t-button
                  size="small"
                  variant="outline"
                  :loading="invest.macroBriefsLoading"
                  @click="handleRefreshBriefs"
                >
                  <template #icon><t-icon name="refresh" /></template>
                  同步快讯
                </t-button>
              </t-space>
            </div>
            <t-alert
              v-if="invest.macroBriefsError"
              theme="error"
              :message="invest.macroBriefsError"
              style="margin-bottom: 12px"
            />

            <!-- 时间轴研判列表 -->
            <t-timeline v-if="macros.length" mode="same">
              <t-timeline-item
                v-for="m in macros"
                :key="m.id"
                :dot-color="toneTimelineDot[m.tone as MacroTone] || toneTimelineDot['待定']"
              >
                <div class="macro">
                  <div class="macro-hd">
                    <strong class="macro-title">{{ m.title }}</strong>
                    <t-space :size="6" align="center">
                      <t-tag size="small" :theme="toneTagTheme(m.tone as MacroTone)" variant="light">{{
                        m.tone
                      }}</t-tag>
                      <t-tag size="small" variant="light">{{ m.topic }}</t-tag>
                      <t-tag size="small" variant="outline">{{
                        m.account === 'stock' ? '股票' : m.account === 'etf' ? 'ETF' : '全市场'
                      }}</t-tag>
                      <span class="macro-time-badge">{{ m.time }}</span>
                    </t-space>
                  </div>
                  <p class="macro-bd">{{ m.body }}</p>

                  <div v-if="m.actionAdvice" class="macro-action-box">
                    <span class="action-box-title">【应对策略】</span>
                    <span class="action-box-text">{{ m.actionAdvice }}</span>
                  </div>

                  <div class="macro-ft">
                    <t-button
                      v-if="m.suggestedTodo"
                      size="small"
                      theme="primary"
                      variant="outline"
                      @click="onConvertMacro(m)"
                    >
                      + 转为决策待办 ({{ m.suggestedTodo.side === 'buy' ? '买入' : '卖出' }} {{ m.suggestedTodo.name }})
                    </t-button>
                    <t-button v-else size="small" theme="default" variant="outline" @click="onConvertMacro(m)">
                      + 转为研判待办
                    </t-button>

                    <t-popconfirm
                      v-if="m.id.startsWith('m_')"
                      content="确认删除此条自定义研判？"
                      @confirm="invest.removeMacroBrief(m.id)"
                    >
                      <t-button size="small" theme="danger" variant="text">删除</t-button>
                    </t-popconfirm>
                  </div>
                </div>
              </t-timeline-item>
            </t-timeline>
            <t-empty v-else description="暂无宏观快讯，点击同步华尔街见闻" style="padding: 24px 0" />
          </div>

          <!-- 视图 2: 近期重点会议 -->
          <div v-else-if="macroSectionTab === 'events'" class="macro-events-panel">
            <div class="macro-filter-row events-filter-row">
              <div class="events-filter-left">
                <t-radio-group v-model="eventsFilter" variant="default-filled" size="small">
                  <t-radio-button value="upcoming">即将召开</t-radio-button>
                  <t-radio-button value="all">全部日程</t-radio-button>
                  <t-radio-button value="past">已结束</t-radio-button>
                </t-radio-group>
                <div class="major-filter-toggle" :class="{ 'is-active': onlyMajorEvents }">
                  <t-checkbox v-model="onlyMajorEvents">
                    <span class="major-toggle-text">
                      <span class="major-flame">🔥</span>
                      只看重大
                    </span>
                  </t-checkbox>
                </div>
                <span class="macro-section-sub events-sub-desc">
                  实时同步央行议息、物价指数(CPI/PPI)、重大会议与核心产业峰会
                </span>
              </div>
              <div class="events-filter-right">
                <t-space :size="8" align="center">
                  <span class="macro-count-hint">
                    {{ onlyMajorEvents ? '重大' : '' }}
                    {{ eventsFilter === 'upcoming' ? '待召开' : eventsFilter === 'past' ? '已结束' : '共' }}
                    {{ sortedEvents.length }} 场
                  </span>
                  <t-button
                    size="small"
                    variant="outline"
                    theme="default"
                    :loading="invest.macroEventsLoading"
                    @click="handleRefreshEvents"
                  >
                    <template #icon><t-icon name="refresh" /></template>
                    同步最新日历
                  </t-button>
                </t-space>
              </div>
            </div>
            <t-alert
              v-if="invest.macroEventsError"
              theme="error"
              :message="invest.macroEventsError"
              style="margin-bottom: 12px"
            />

            <div v-if="sortedEvents.length" class="events-list">
              <div v-for="ev in sortedEvents" :key="ev.id" class="event-card">
                <div class="event-card-top">
                  <div class="event-date-col">
                    <span class="event-date-main">{{ ev.date }}</span>
                    <span
                      class="event-countdown-badge"
                      :class="{
                        'countdown-urgent': getEventCountdown(ev.date).urgent,
                        'countdown-future': !getEventCountdown(ev.date).isPast && !getEventCountdown(ev.date).urgent,
                        'countdown-past': getEventCountdown(ev.date).isPast,
                      }"
                    >
                      {{ getEventCountdown(ev.date).label }}
                    </span>
                  </div>
                  <div class="event-main-col">
                    <div class="event-headline">
                      <strong class="event-title">{{ ev.title }}</strong>
                      <t-space :size="6" align="center" wrap>
                        <t-tag
                          size="small"
                          :theme="ev.level === '重大' ? 'danger' : ev.level === '关键' ? 'warning' : 'default'"
                          variant="light"
                        >
                          {{ ev.level }}
                        </t-tag>
                        <t-tag size="small" variant="outline">{{ ev.category }}</t-tag>
                        <t-tag size="small" variant="light">{{
                          ev.account === 'stock' ? '股票' : ev.account === 'etf' ? 'ETF' : '全市场'
                        }}</t-tag>
                      </t-space>
                    </div>
                    <div class="event-impact-text">{{ ev.impact }}</div>
                  </div>
                </div>

                <!-- 催化受益标的与板块 -->
                <div v-if="ev.beneficiaries?.length" class="event-beneficiaries-bar">
                  <span class="bar-label">潜在催化标的/板块：</span>
                  <div class="beneficiary-chips">
                    <div
                      v-for="b in ev.beneficiaries"
                      :key="b"
                      class="beneficiary-chip"
                      @click="handleEventTargetClick(b, ev)"
                    >
                      <span>{{ b }}</span>
                      <t-icon name="swap" size="11px" />
                    </div>
                  </div>
                </div>

                <!-- 应对策略建议 -->
                <div v-if="ev.suggestedAction" class="macro-action-box event-action-box">
                  <span class="action-box-title">【应对策略】</span>
                  <span class="action-box-text">{{ ev.suggestedAction }}</span>
                </div>

                <!-- 底部操作 -->
                <div class="event-footer-bar">
                  <t-space :size="8" wrap>
                    <t-button size="small" theme="primary" variant="outline" @click="onConvertEventToTodo(ev)">
                      + 生成重点跟踪待办
                    </t-button>
                    <t-button
                      v-if="ev.beneficiaries?.[0]"
                      size="small"
                      theme="default"
                      variant="text"
                      @click="handleEventTargetClick(ev.beneficiaries[0], ev)"
                    >
                      模拟交易标的
                    </t-button>
                  </t-space>

                  <t-popconfirm
                    v-if="ev.id.startsWith('ev_')"
                    content="确认删除此条重点会议？"
                    @confirm="invest.removeMacroEvent(ev.id)"
                  >
                    <t-button size="small" theme="danger" variant="text">删除</t-button>
                  </t-popconfirm>
                </div>
              </div>
            </div>
            <t-empty
              v-else
              :description="onlyMajorEvents ? '当前暂无符合筛选条件的重大日程' : '暂无即将召开的日程，点击同步日历'"
              style="padding: 24px 0"
            >
              <template v-if="onlyMajorEvents" #action>
                <t-button size="small" variant="outline" theme="primary" @click="onlyMajorEvents = false">
                  查看全部日程
                </t-button>
              </template>
            </t-empty>
          </div>

          <!-- 视图 3: 产业催化 -->
          <div v-else-if="macroSectionTab === 'industries'" class="macro-industry-panel">
            <div class="macro-filter-row">
              <span class="macro-section-sub events-sub-desc">选股宝板块异动 · 涨停家数与资金流向</span>
              <t-space :size="8" align="center">
                <span class="macro-count-hint">
                  {{ invest.industryFocusLastUpdated ? `更新 ${invest.industryFocusLastUpdated}` : '' }}
                  · {{ invest.industryFocus.length }} 个板块
                </span>
                <t-button
                  size="small"
                  variant="outline"
                  :loading="invest.industryFocusLoading"
                  @click="handleRefreshIndustry"
                >
                  <template #icon><t-icon name="refresh" /></template>
                  同步产业风口
                </t-button>
              </t-space>
            </div>
            <t-alert
              v-if="invest.industryFocusError"
              theme="error"
              :message="invest.industryFocusError"
              style="margin-bottom: 12px"
            />
            <div v-if="invest.industryFocus.length" class="industry-grid">
              <div v-for="ind in invest.industryFocus" :key="ind.id" class="ind-card">
                <div class="ind-card-hd">
                  <div class="ind-title-wrap">
                    <strong class="ind-card-name">{{ ind.name }}</strong>
                    <span
                      v-if="ind.changeRate != null"
                      class="ind-chg-pill tabular-nums"
                      :class="ind.changeRate >= 0 ? 'is-up' : 'is-down'"
                    >
                      {{ ind.changeRate >= 0 ? '+' : '' }}{{ ind.changeRate }}%
                    </span>
                    <t-tag v-if="ind.limitUpCount" size="small" theme="danger" variant="dark">
                      {{ ind.limitUpCount }}股涨停
                    </t-tag>
                    <t-tag size="small" :theme="ind.trend === 'up' ? 'danger' : 'default'" variant="light">
                      {{ ind.cycleStage }}
                    </t-tag>
                  </div>
                  <span class="ind-heat tabular-nums">景气 {{ ind.heat }}</span>
                </div>
                <div v-if="ind.catalyst" class="ind-catalyst-box">
                  <span class="catalyst-tag">催化</span>
                  <span class="catalyst-text">{{ ind.catalyst }}</span>
                </div>
                <div v-if="ind.keyTargets.length" class="ind-targets-bar">
                  <span class="targets-label">领涨 / ETF</span>
                  <button
                    v-for="tgt in ind.keyTargets"
                    :key="tgt.code"
                    type="button"
                    class="target-pill"
                    @click="openIndustryTarget(ind, tgt)"
                  >
                    <span>{{ tgt.name }}</span>
                    <span
                      v-if="tgt.changePercent != null"
                      class="tgt-chg tabular-nums"
                      :class="tgt.changePercent >= 0 ? 'is-up' : 'is-down'"
                    >
                      {{ tgt.changePercent >= 0 ? '+' : '' }}{{ tgt.changePercent }}%
                    </span>
                    <span class="tgt-type">{{ tgt.type }}</span>
                  </button>
                </div>
                <div class="ind-card-ft">
                  <span class="ind-meta">
                    {{ ind.updatedAt }}
                    <template v-if="ind.fundFlow">
                      · 主力
                      <span class="tabular-nums" :class="ind.fundFlow >= 0 ? 'is-up' : 'is-down'">
                        {{ fmtYi(ind.fundFlow) }}
                      </span>
                    </template>
                  </span>
                  <t-space :size="8">
                    <t-button size="small" variant="outline" @click="onConvertIndustry(ind)">存入机会池</t-button>
                    <t-popconfirm
                      v-if="ind.id.startsWith('ind_')"
                      content="确认删除此条产业跟踪？"
                      @confirm="invest.removeIndustryFocus(ind.id)"
                    >
                      <t-button size="small" theme="danger" variant="text">删除</t-button>
                    </t-popconfirm>
                  </t-space>
                </div>
              </div>
            </div>
            <t-empty v-else description="暂无产业催化，点击同步选股宝板块异动" style="padding: 24px 0" />
          </div>
        </t-card>
      </t-col>

      <!-- 右侧: 投资决策与交易待办清单 -->
      <t-col :xs="12" :xl="5">
        <t-card title="决策待办清单 (Trading Todos)">
          <template #actions>
            <t-button size="small" theme="primary" @click="openCreateTodoDialog">+ 新建立项</t-button>
          </template>

          <div class="todo-filter-bar">
            <t-radio-group v-model="todoFilter" variant="default-filled" size="small">
              <t-radio-button value="open">待执行 ({{ openTodos.length }})</t-radio-button>
              <t-radio-button value="all">全部 ({{ invest.todos.length }})</t-radio-button>
              <t-radio-button value="done">已完成 ({{ doneTodos.length }})</t-radio-button>
            </t-radio-group>
          </div>

          <t-list v-if="filteredTodos.length" :split="true" class="todo-list">
            <t-list-item v-for="t in filteredTodos" :key="t.id" class="todo-item-card">
              <div class="todo-inner">
                <div class="todo-top">
                  <div class="todo-badges">
                    <t-tag size="small" :theme="t.side === 'buy' ? 'danger' : 'success'" variant="light">
                      {{ t.side === 'buy' ? '拟买入' : '拟卖出' }}
                    </t-tag>
                    <t-tag size="small" variant="outline">{{ t.account === 'etf' ? 'ETF 账户' : '股票账户' }}</t-tag>
                    <span class="todo-code">{{ t.code }}</span>
                  </div>
                  <span class="todo-date">{{ t.status === 'open' ? '待执行' : '已完成' }}</span>
                </div>
                <div class="todo-name-line">
                  <strong class="todo-name">{{ t.name }}</strong>
                  <span class="todo-qty">{{ t.quantity }} 份</span>
                </div>
                <p class="todo-reason">{{ t.reason }}</p>
                <div class="todo-actions">
                  <t-space :size="8">
                    <t-button
                      v-if="t.status === 'open'"
                      size="small"
                      theme="success"
                      variant="outline"
                      @click="invest.setTodoStatus(t.id, 'done')"
                    >
                      标记执行
                    </t-button>
                    <t-button size="small" theme="default" variant="text" @click="openAddToOpportunityFromTodo(t)">
                      存入机会池
                    </t-button>
                    <t-popconfirm content="确认删除此项待办？" @confirm="invest.removeTodo(t.id)">
                      <t-button size="small" theme="danger" variant="text">删除</t-button>
                    </t-popconfirm>
                  </t-space>
                </div>
              </div>
            </t-list-item>
          </t-list>
          <t-empty v-else description="暂无待办交易，可从宏观信号或 ETF 雷达直接生成" style="padding: 40px 0" />
        </t-card>
      </t-col>
    </t-row>

    <!-- 新增决策待办弹窗 -->
    <t-dialog
      v-model:visible="todoDialogVisible"
      header="新建投资交易待办"
      :confirm-btn="{ content: '确认添加', theme: 'primary' }"
      @confirm="confirmCreateTodo"
    >
      <t-form :data="todoForm" label-align="left" :label-width="80">
        <t-form-item label="标的代码">
          <t-input v-model="todoForm.code" placeholder="如：511090 或 510300" />
        </t-form-item>
        <t-form-item label="标的名称">
          <t-input v-model="todoForm.name" placeholder="如：30年国债ETF" />
        </t-form-item>
        <t-form-item label="买卖方向">
          <t-radio-group v-model="todoForm.side">
            <t-radio-button value="buy">买入</t-radio-button>
            <t-radio-button value="sell">卖出</t-radio-button>
          </t-radio-group>
        </t-form-item>
        <t-form-item label="归属账户">
          <t-radio-group v-model="todoForm.account">
            <t-radio-button value="etf">ETF 账户</t-radio-button>
            <t-radio-button value="stock">股票账户</t-radio-button>
          </t-radio-group>
        </t-form-item>
        <t-form-item label="拟买份数">
          <t-input-number v-model="todoForm.quantity" :min="100" :step="1000" style="width: 180px" />
        </t-form-item>
        <t-form-item label="决策理由">
          <t-input v-model="todoForm.reason" placeholder="如：宏观资产荒逻辑持续，逢低建仓" />
        </t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>
<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next';
import { computed, onMounted, ref } from 'vue';

import { useInvestStore } from '@/store';
import type { IndustryFocus, MacroBrief, MacroEvent } from '@/types/invest';
import { getEventCountdown, sortMacroEvents } from '@/utils/calendar';

import { confirmCreateTodo, openCreateTodoDialog, todoDialogVisible, todoForm } from './todo';

type MacroTone = '利多' | '中性' | '警惕' | '待定';

const invest = useInvestStore();
const macroSectionTab = ref('signals');
const macroFilter = ref('all');
const eventsFilter = ref<'upcoming' | 'all' | 'past'>('upcoming');
const onlyMajorEvents = computed({
  get: () => !!invest.prefs.onlyMajorEvents,
  set: (val: boolean) => invest.setPref('onlyMajorEvents', val),
});
const todoFilter = ref<'open' | 'all' | 'done'>('open');

const macros = computed(() => {
  const list = invest.macroBriefs;
  if (macroFilter.value === 'all') return list;
  return list.filter((m) => m.topic === macroFilter.value);
});

const openTodos = computed(() => invest.todos.filter((t) => t.status === 'open'));
const doneTodos = computed(() => invest.todos.filter((t) => t.status === 'done'));
const filteredTodos = computed(() => {
  if (todoFilter.value === 'open') return openTodos.value;
  if (todoFilter.value === 'done') return doneTodos.value;
  return invest.todos;
});

const sortedEvents = computed(() => {
  let sorted = sortMacroEvents(invest.macroEvents);
  if (eventsFilter.value === 'upcoming') {
    sorted = sorted.filter((e) => !getEventCountdown(e.date).isPast);
  } else if (eventsFilter.value === 'past') {
    sorted = sorted.filter((e) => getEventCountdown(e.date).isPast);
  }
  if (onlyMajorEvents.value) {
    sorted = sorted.filter((e) => e.level === '重大');
  }
  return sorted;
});

const toneTagTheme = (tone: MacroTone): 'danger' | 'success' | 'warning' | 'default' => {
  if (tone === '利多') return 'danger';
  if (tone === '警惕') return 'success';
  if (tone === '中性') return 'warning';
  return 'default';
};

const toneTimelineDot: Record<MacroTone, string> = {
  利多: 'var(--guanlan-gain, #b8433e)',
  警惕: 'var(--guanlan-loss, #16815f)',
  中性: 'var(--guanlan-gold, #dfb56d)',
  待定: 'var(--guanlan-muted, #8ea2ae)',
};

function onConvertMacro(m: MacroBrief) {
  if (m.suggestedTodo) {
    todoForm.account = m.suggestedTodo.account;
    todoForm.code = m.suggestedTodo.code || '510300';
    todoForm.name = m.suggestedTodo.name;
    todoForm.side = m.suggestedTodo.side;
    todoForm.quantity = m.suggestedTodo.quantity || 1000;
    todoForm.reason = m.suggestedTodo.reason;
  } else {
    todoForm.account = m.account === 'stock' ? 'stock' : 'etf';
    todoForm.code = '';
    todoForm.name = m.title;
    todoForm.side = m.tone === '利多' ? 'buy' : 'sell';
    todoForm.quantity = 1000;
    todoForm.reason = m.actionAdvice || m.body;
  }
  todoDialogVisible.value = true;
}

function onConvertEventToTodo(ev: MacroEvent) {
  invest.convertEventToTodo(ev);
  MessagePlugin.success(`已生成【${ev.title}】重点跟踪待办`);
}

function handleEventTargetClick(targetName: string, ev: MacroEvent) {
  invest.openTradeModal({
    name: targetName,
    account: !ev.account || ev.account === 'all' ? 'stock' : ev.account,
    note: `会议催化交易【${ev.title}】：${ev.impact}`,
  });
}

function fmtYi(n: number) {
  return `${n >= 0 ? '+' : ''}${(n / 1e8).toFixed(1)}亿`;
}

async function handleRefreshBriefs() {
  await invest.refreshMacroBriefs();
  if (invest.macroBriefsError) {
    MessagePlugin.error(invest.macroBriefsError);
    return;
  }
  MessagePlugin.success('已同步华尔街见闻宏观快讯');
}

async function handleRefreshEvents() {
  await invest.refreshMacroEvents();
  if (invest.macroEventsError) {
    MessagePlugin.error(invest.macroEventsError);
    return;
  }
  MessagePlugin.success('已同步华尔街见闻宏观日历');
}

async function handleRefreshIndustry() {
  await invest.refreshIndustryFocus();
  if (invest.industryFocusError) {
    MessagePlugin.error(invest.industryFocusError);
    return;
  }
  MessagePlugin.success('已同步选股宝产业风口');
}

function openAddToOpportunityFromTodo(t: { name: string; reason: string }) {
  invest.addOpportunity({
    account: 'etf',
    name: t.name,
    thesis: t.reason,
    score: 85,
    note: '来自决策待办转化',
  });
  MessagePlugin.success(`已将【${t.name}】存入研究机会池`);
}

function onConvertIndustry(ind: IndustryFocus) {
  invest.convertIndustryToOpportunity(ind);
  MessagePlugin.success(`已将【${ind.name}】加入机会池`);
}

function openIndustryTarget(ind: IndustryFocus, tgt: IndustryFocus['keyTargets'][number]) {
  invest.openTradeModal({
    code: tgt.code,
    name: tgt.name,
    account: ind.account === 'all' ? (tgt.type === 'ETF' ? 'etf' : 'stock') : ind.account,
    note: `产业配置【${ind.name}】：${ind.catalyst}`,
  });
}

onMounted(() => {
  if (!invest.macroBriefsLastUpdated) void invest.refreshMacroBriefs();
  if (!invest.macroEventsLastUpdated) void invest.refreshMacroEvents();
  if (!invest.industryFocusLastUpdated) void invest.refreshIndustryFocus();
});
</script>
