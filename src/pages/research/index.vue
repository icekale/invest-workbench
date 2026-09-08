<template>
  <t-space class="page" direction="vertical" :size="16" style="width: 100%">
    <!-- 顶栏概览条 -->
    <div class="overview-strip">
      <div class="overview-strip__item">
        <span class="overview-strip__label">宏观周期定调</span>
        <span class="overview-strip__val highlight">{{ invest.macroWeather?.sentiment }} <small>偏好</small></span>
      </div>
      <div class="overview-strip__divider" />
      <div class="overview-strip__item">
        <span class="overview-strip__label">待执行交易</span>
        <span class="overview-strip__val">{{ openTodos.length }} <small>项待办</small></span>
      </div>
      <div class="overview-strip__divider" />
      <div class="overview-strip__item">
        <span class="overview-strip__label">机会池标的</span>
        <span class="overview-strip__val">{{ invest.opportunities.length }} <small>只跟踪</small></span>
      </div>
      <div class="overview-strip__divider" />
      <div class="overview-strip__item">
        <span class="overview-strip__label">万得 EDB 状态</span>
        <span class="overview-strip__val edb-status"> <span class="edb-dot" />已接入 </span>
      </div>
    </div>

    <!-- 宏观周期罗盘 + 建议基准仓位 -->
    <t-card class="macro-weather-card">
      <div class="macro-weather-header">
        <div class="weather-header-left">
          <span class="weather-title">宏观周期罗盘与大类定调</span>
          <span class="weather-sub">基于万得 EDB 宏观数据与货币政策执行报告综合研判</span>
        </div>
        <div class="weather-header-right">
          <t-space :size="8" align="center">
            <span class="sub-action-text">{{ invest.macroWeather?.updatedAt || '每日 08:30 投研定调' }}</span>
            <t-button size="small" variant="text" theme="primary" @click="openMacroModal">
              + 记研判/会议/产业
            </t-button>
          </t-space>
        </div>
      </div>

      <div class="macro-weather-bar">
        <div class="weather-col main-cycle">
          <div class="weather-label">宏观周期定调</div>
          <div class="weather-val">{{ invest.macroWeather?.cycle }}</div>
        </div>
        <div class="weather-col sentiment-badge">
          <div class="weather-label">市场风险偏好</div>
          <t-tag
            size="small"
            :theme="
              invest.macroWeather?.sentiment === '偏多'
                ? 'danger'
                : invest.macroWeather?.sentiment === '防守'
                  ? 'success'
                  : 'warning'
            "
            variant="light"
          >
            {{ invest.macroWeather?.sentiment }}
          </t-tag>
        </div>
        <div class="weather-col position-guide">
          <div class="weather-label">建议基准仓位</div>
          <div class="weather-val pos-text">
            股票 <strong>{{ invest.macroWeather?.suggestedStockPos }}</strong> · ETF
            <strong>{{ invest.macroWeather?.suggestedEtfPos }}</strong>
          </div>
        </div>
      </div>
    </t-card>

    <!-- 万得 EDB 宏观四大支柱量化温度计 -->
    <t-card title="万得 EDB 宏观四大支柱温度计" subtitle="点击任一指标卡片可下钻查看真实历史走势图与分位数">
      <template #actions>
        <t-space :size="8" align="center">
          <span v-if="windSyncTime" class="sync-time-hint">已同步: {{ windSyncTime }}</span>
          <t-button size="small" variant="outline" theme="primary" :loading="windLoading" @click="refreshWindData">
            <template #icon><t-icon name="refresh" /></template>
            从万得同步
          </t-button>
        </t-space>
      </template>

      <t-row :gutter="[16, 16]">
        <!-- 支柱 1: 经济增长 (PMI) -->
        <t-col :xs="12" :sm="6" :xl="3">
          <div class="edb-pillar-card" @click="openMetricChart('pmi')">
            <div class="pillar-top">
              <span class="pillar-label">经济增长 · 景气度</span>
              <t-tag
                size="small"
                :theme="
                  growthPmi && growthPmi.latestValue != null && growthPmi.latestValue >= 50 ? 'danger' : 'warning'
                "
                variant="light"
              >
                {{
                  growthPmi && growthPmi.latestValue != null && growthPmi.latestValue >= 50 ? '荣枯线上' : '弱势筑底'
                }}
              </t-tag>
            </div>
            <div class="pillar-main">
              <span class="pillar-name">{{ growthPmi?.name || '官方制造业PMI' }}</span>
              <div class="pillar-val-row">
                <span class="pillar-val">{{ growthPmi?.latestValue ?? '49.8' }}</span>
                <span class="pillar-unit">{{ growthPmi?.unit || '%' }}</span>
                <span
                  v-if="growthPmi?.change != null"
                  class="pillar-change"
                  :class="growthPmi.change >= 0 ? 'is-up' : 'is-down'"
                >
                  {{ growthPmi.change >= 0 ? '↑' : '↓' }} {{ Math.abs(growthPmi.change) }}
                </span>
              </div>
            </div>
            <div class="pillar-sub">
              <span>{{ growthPmi?.source || '国家统计局' }}</span>
              <span class="chart-link">趋势图 →</span>
            </div>
          </div>
        </t-col>

        <!-- 支柱 2: 通胀物价 (CPI / PPI) -->
        <t-col :xs="12" :sm="6" :xl="3">
          <div class="edb-pillar-card" @click="openMetricChart('cpi')">
            <div class="pillar-top">
              <span class="pillar-label">物价与利润 · 剪刀差</span>
              <t-tag size="small" theme="primary" variant="light">
                {{ cpiMetric?.latestValue != null && cpiMetric.latestValue > 0 ? '温和物价' : '低位磨底' }}
              </t-tag>
            </div>
            <div class="pillar-main">
              <span class="pillar-name">{{ cpiMetric?.name || 'CPI:当月同比' }}</span>
              <div class="pillar-val-row">
                <span class="pillar-val">{{ cpiMetric?.latestValue ?? '0.5' }}</span>
                <span class="pillar-unit">{{ cpiMetric?.unit || '%' }}</span>
                <span
                  v-if="cpiMetric?.change != null"
                  class="pillar-change"
                  :class="cpiMetric.change >= 0 ? 'is-up' : 'is-down'"
                >
                  {{ cpiMetric.change >= 0 ? '↑' : '↓' }} {{ Math.abs(cpiMetric.change) }}
                </span>
              </div>
            </div>
            <div class="pillar-sub">
              <span>{{ cpiMetric?.source || '国家统计局' }}</span>
              <span class="chart-link">趋势图 →</span>
            </div>
          </div>
        </t-col>

        <!-- 支柱 3: 货币与流动性 (M2 / M1) -->
        <t-col :xs="12" :sm="6" :xl="3">
          <div class="edb-pillar-card" @click="openMetricChart('m2')">
            <div class="pillar-top">
              <span class="pillar-label">货币供应 · 资金活化</span>
              <t-tag size="small" theme="success" variant="light"> 宽松适度 </t-tag>
            </div>
            <div class="pillar-main">
              <span class="pillar-name">{{ m2Metric?.name || 'M2 货币供应:同比' }}</span>
              <div class="pillar-val-row">
                <span class="pillar-val">{{ m2Metric?.latestValue ?? '8.0' }}</span>
                <span class="pillar-unit">{{ m2Metric?.unit || '%' }}</span>
                <span
                  v-if="m2Metric?.change != null"
                  class="pillar-change"
                  :class="m2Metric.change >= 0 ? 'is-up' : 'is-down'"
                >
                  {{ m2Metric.change >= 0 ? '↑' : '↓' }} {{ Math.abs(m2Metric.change) }}
                </span>
              </div>
            </div>
            <div class="pillar-sub">
              <span>{{ m2Metric?.source || '中国人民银行' }}</span>
              <span class="chart-link">趋势图 →</span>
            </div>
          </div>
        </t-col>

        <!-- 支柱 4: 利率估值与资产荒 (10Y国债 / 股债利差) -->
        <t-col :xs="12" :sm="6" :xl="3">
          <div class="edb-pillar-card" @click="openMetricChart('bond')">
            <div class="pillar-top">
              <span class="pillar-label">利率中枢 · 资产荒</span>
              <t-tag size="small" theme="danger" variant="light"> 深度击球区 </t-tag>
            </div>
            <div class="pillar-main">
              <span class="pillar-name">10Y国债收益率 / ERP</span>
              <div class="pillar-val-row">
                <span class="pillar-val">1.82</span>
                <span class="pillar-unit">%</span>
                <span class="pillar-tag-sub">ERP 3.85%</span>
              </div>
            </div>
            <div class="pillar-sub">
              <span>长端利率下行 · 股债利差84%高分位</span>
              <span class="chart-link">趋势图 →</span>
            </div>
          </div>
        </t-col>
      </t-row>
    </t-card>

    <!-- 宏观驱动因子 → ETF 资产配置雷达与标的建议 -->
    <t-card title="宏观因子 → ETF 资产配置雷达" subtitle="将宏观定调（弱复苏·宽货币·资产荒）精准映射至可执行标的">
      <t-row :gutter="[16, 16]">
        <t-col :xs="12" :md="4">
          <div class="radar-group">
            <div class="radar-hd">
              <span class="radar-tag defense">🛡️ 防守稳健底仓</span>
              <span class="radar-weight">建议仓位 35% ~ 45%</span>
            </div>
            <p class="radar-desc">长端利率处于历史低位，长久期国债与高股息红利构筑全天候护城河。</p>
            <div class="radar-targets">
              <div class="target-row">
                <div class="target-info">
                  <span class="target-name">30年国债ETF</span>
                  <span class="target-code">511090</span>
                </div>
                <t-button
                  size="small"
                  variant="text"
                  theme="primary"
                  @click="quickAddTodo('511090', '30年国债ETF', '资产荒对冲配置')"
                >
                  + 待办
                </t-button>
              </div>
              <div class="target-row">
                <div class="target-info">
                  <span class="target-name">红利低波ETF</span>
                  <span class="target-code">512890</span>
                </div>
                <t-button
                  size="small"
                  variant="text"
                  theme="primary"
                  @click="quickAddTodo('512890', '红利低波ETF', '高股息现金流护航')"
                >
                  + 待办
                </t-button>
              </div>
            </div>
          </div>
        </t-col>

        <t-col :xs="12" :md="4">
          <div class="radar-group">
            <div class="radar-hd">
              <span class="radar-tag core">⚖️ 核心大盘宽基</span>
              <span class="radar-weight">建议仓位 30% ~ 40%</span>
            </div>
            <p class="radar-desc">股债利差处于历史 84% 极值分位，大盘优质资产中长期赔率突出。</p>
            <div class="radar-targets">
              <div class="target-row">
                <div class="target-info">
                  <span class="target-name">中证A500ETF</span>
                  <span class="target-code">560510</span>
                </div>
                <t-button
                  size="small"
                  variant="text"
                  theme="primary"
                  @click="quickAddTodo('560510', '中证A500ETF', '新一代核心宽基底仓')"
                >
                  + 待办
                </t-button>
              </div>
              <div class="target-row">
                <div class="target-info">
                  <span class="target-name">沪深300ETF</span>
                  <span class="target-code">510300</span>
                </div>
                <t-button
                  size="small"
                  variant="text"
                  theme="primary"
                  @click="quickAddTodo('510300', '沪深300ETF', '大盘龙头定投')"
                >
                  + 待办
                </t-button>
              </div>
            </div>
          </div>
        </t-col>

        <t-col :xs="12" :md="4">
          <div class="radar-group">
            <div class="radar-hd">
              <span class="radar-tag offense">🚀 弹性成长突破</span>
              <span class="radar-weight">建议仓位 15% ~ 25%</span>
            </div>
            <p class="radar-desc">聚焦新质生产力与流动性敏感资产，博弈政策落地与科技创新周期。</p>
            <div class="radar-targets">
              <div class="target-row">
                <div class="target-info">
                  <span class="target-name">科创50ETF</span>
                  <span class="target-code">588000</span>
                </div>
                <t-button
                  size="small"
                  variant="text"
                  theme="primary"
                  @click="quickAddTodo('588000', '科创50ETF', '半导体新质生产力弹性')"
                >
                  + 待办
                </t-button>
              </div>
              <div class="target-row">
                <div class="target-info">
                  <span class="target-name">黄金ETF</span>
                  <span class="target-code">518880</span>
                </div>
                <t-button
                  size="small"
                  variant="text"
                  theme="primary"
                  @click="quickAddTodo('518880', '黄金ETF', '逆全球化与货币信用对冲')"
                >
                  + 待办
                </t-button>
              </div>
            </div>
          </div>
        </t-col>
      </t-row>
    </t-card>

    <!-- 研判与决策主体区：左侧信号动态 + 右侧决策待办 -->
    <t-row :gutter="[16, 16]">
      <t-col :xs="12" :xl="7">
        <t-card title="宏观研判、万得要闻与事件催化">
          <!-- 四级标签切换 -->
          <div class="macro-subtabs-nav">
            <t-tabs v-model="macroSectionTab" theme="normal">
              <t-tab-panel value="wind_news" :label="`万得权威要闻 (${windNewsList.length || 4})`" />
              <t-tab-panel value="signals" :label="`晨会研判 (${macros.length})`" />
              <t-tab-panel value="events" :label="`近期重点会议 (${invest.macroEvents.length})`" />
              <t-tab-panel value="industries" :label="`产业催化 (${invest.industryFocus.length})`" />
            </t-tabs>
          </div>

          <!-- 视图 0: 万得权威宏观要闻 -->
          <div v-if="macroSectionTab === 'wind_news'" class="wind-news-panel">
            <div class="wind-news-filter">
              <span class="wind-news-hint">依托万得金融文档 RAG 实时抓取央行执行报告与宏观部委官方公报</span>
              <t-button size="small" variant="outline" :loading="windLoading" @click="refreshWindData">
                刷新要闻
              </t-button>
            </div>
            <div class="wind-news-list">
              <div v-for="(news, idx) in windNewsList" :key="idx" class="wind-news-card">
                <div class="news-hd">
                  <span class="news-badge">官方权威</span>
                  <strong class="news-title">{{ news.title }}</strong>
                  <span class="news-date">{{ news.date }}</span>
                </div>
                <p class="news-content">{{ news.content }}</p>
                <div class="news-ft">
                  <span class="news-rel">关联度: {{ Math.round(news.relevance * 100) }}%</span>
                  <t-space :size="8">
                    <t-button size="small" theme="primary" variant="outline" @click="convertNewsToTodo(news)">
                      + 转为投资待办
                    </t-button>
                  </t-space>
                </div>
              </div>
            </div>
          </div>

          <!-- 视图 1: 晨会信号列表 -->
          <div v-else-if="macroSectionTab === 'signals'">
            <div class="macro-filter-row">
              <t-radio-group v-model="macroFilter" variant="default-filled">
                <t-radio-button value="all">全部</t-radio-button>
                <t-radio-button value="增长">增长</t-radio-button>
                <t-radio-button value="流动性">流动性</t-radio-button>
                <t-radio-button value="政策">政策</t-radio-button>
                <t-radio-button value="海外">海外</t-radio-button>
              </t-radio-group>
              <span class="macro-count-hint">共 {{ macros.length }} 条晨会研判</span>
            </div>

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
            <t-empty v-else description="暂无符合筛选条件的宏观信号" style="padding: 24px 0" />
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
                  <t-checkbox v-model="onlyMajorEvents" @change="onToggleOnlyMajor">
                    <span class="major-toggle-text">
                      <span class="major-flame">🔥</span>
                      只看重大
                    </span>
                  </t-checkbox>
                </div>
              </div>
              <div class="events-filter-right">
                <span class="macro-count-hint">共 {{ sortedEvents.length }} 场日程</span>
              </div>
            </div>

            <div class="events-timeline">
              <div
                v-for="e in sortedEvents"
                :key="e.id"
                class="event-card"
                :class="{ 'event-is-major': e.level === '重大', 'event-is-past': isPastEvent(e.date) }"
              >
                <div class="event-left">
                  <div class="event-date-box">
                    <span class="event-month">{{ formatEventMonth(e.date) }}</span>
                    <span class="event-day">{{ formatEventDay(e.date) }}</span>
                  </div>
                  <div class="event-status-badge">
                    <t-tag v-if="isTodayEvent(e.date)" size="small" theme="danger" variant="dark">今日</t-tag>
                    <t-tag v-else-if="!isPastEvent(e.date)" size="small" theme="primary" variant="light">
                      {{ getDaysDiffText(e.date) }}
                    </t-tag>
                    <span v-else class="past-tag">已闭门</span>
                  </div>
                </div>

                <div class="event-main">
                  <div class="event-header-line">
                    <div class="event-title-wrap">
                      <span v-if="e.level === '重大'" class="major-star" title="核心重大事件">🔥</span>
                      <strong class="event-title">{{ e.title }}</strong>
                    </div>
                    <t-space :size="4" align="center">
                      <t-tag size="small" :theme="e.level === '重大' ? 'danger' : 'primary'" variant="light">
                        {{ e.level }}
                      </t-tag>
                      <t-tag size="small" variant="outline">
                        {{ e.category }}
                      </t-tag>
                    </t-space>
                  </div>
                  <p class="event-desc">{{ e.impact }}</p>
                  <div v-if="e.suggestedAction" class="event-focus-box">
                    <span class="focus-title">关注对策：</span>
                    <span class="focus-text">{{ e.suggestedAction }}</span>
                  </div>
                </div>

                <div class="event-actions">
                  <t-button size="small" theme="primary" variant="outline" @click="onConvertEvent(e)">
                    + 待办
                  </t-button>
                </div>
              </div>
            </div>
          </div>

          <!-- 视图 3: 产业催化 -->
          <div v-else-if="macroSectionTab === 'industries'" class="macro-industry-panel">
            <div class="industry-grid">
              <div v-for="ind in invest.industryFocus" :key="ind.id" class="ind-card" @click="openIndDrawer(ind)">
                <div class="ind-card-hd">
                  <strong class="ind-card-name">{{ ind.name }}</strong>
                  <t-tag size="small" :theme="ind.trend === 'up' ? 'danger' : 'default'" variant="light">
                    {{ ind.trend === 'up' ? '景气向上' : '中性平稳' }}
                  </t-tag>
                </div>
                <div class="ind-catalyst-box">
                  <span class="catalyst-tag">催化</span>
                  <span class="catalyst-text">{{ ind.catalyst }}</span>
                </div>
                <div class="ind-targets-line">
                  <span class="targets-label">标的池:</span>
                  <span class="targets-vals">{{ ind.keyTargets.map((t) => t.name).join('、') }}</span>
                </div>
              </div>
            </div>
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

    <!-- 万得指标下钻历史曲线弹窗 (ECharts) -->
    <t-dialog
      v-model:visible="chartModalVisible"
      :header="activeMetric ? `${activeMetric.name} · 历史走势` : '万得指标走势'"
      width="680px"
      :footer="false"
      @opened="renderMetricChart"
    >
      <div v-if="activeMetric" class="metric-dialog-body">
        <div class="dialog-meta-bar">
          <div class="meta-item">
            <span class="meta-label">最新数值</span>
            <strong class="meta-val">{{ activeMetric.latestValue }} {{ activeMetric.unit }}</strong>
          </div>
          <div class="meta-item">
            <span class="meta-label">环比变化</span>
            <span
              class="meta-val"
              :class="activeMetric.change != null && activeMetric.change >= 0 ? 'is-up' : 'is-down'"
            >
              {{
                activeMetric.change != null
                  ? activeMetric.change >= 0
                    ? `+${activeMetric.change}`
                    : activeMetric.change
                  : '—'
              }}
            </span>
          </div>
          <div class="meta-item">
            <span class="meta-label">数据频次</span>
            <span class="meta-val">{{ activeMetric.freq }}频</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">权威来源</span>
            <span class="meta-val">{{ activeMetric.source }}</span>
          </div>
        </div>

        <div ref="metricChartEl" style="height: 320px; width: 100%; margin-top: 16px" />
        <div class="dialog-foot-note">
          <span>* 数据来源于万得 Wind EDB 金融数据库，经 Caddy 安全反向代理直连取数。</span>
        </div>
      </div>
    </t-dialog>

    <!-- 记研判/会议/产业管理弹窗 -->
    <t-dialog
      v-model:visible="macroModalVisible"
      header="宏观研判与投研管理"
      :confirm-btn="{ content: '保存更新', theme: 'primary' }"
      @confirm="submitMacroModal"
    >
      <t-tabs v-model="macroManageTab" theme="card">
        <t-tab-panel value="weather" label="调宏观天气与仓位" />
        <t-tab-panel value="brief" label="记一条晨会研判" />
      </t-tabs>

      <div v-if="macroManageTab === 'weather'" style="margin-top: 16px">
        <t-form :data="weatherForm" label-align="left" :label-width="100">
          <t-form-item label="宏观周期定调">
            <t-input v-model="weatherForm.cycle" placeholder="如：弱复苏·宽货币·信用温和扩张" />
          </t-form-item>
          <t-form-item label="市场风险偏好">
            <t-radio-group v-model="weatherForm.sentiment">
              <t-radio-button value="偏多">偏多</t-radio-button>
              <t-radio-button value="中性">中性</t-radio-button>
              <t-radio-button value="防守">防守</t-radio-button>
            </t-radio-group>
          </t-form-item>
          <t-form-item label="建议股票仓位">
            <t-input v-model="weatherForm.suggestedStockPos" placeholder="如：60% ~ 70%" />
          </t-form-item>
          <t-form-item label="建议 ETF 仓位">
            <t-input v-model="weatherForm.suggestedEtfPos" placeholder="如：75% ~ 85%" />
          </t-form-item>
        </t-form>
      </div>

      <div v-else-if="macroManageTab === 'brief'" style="margin-top: 16px">
        <t-form :data="briefForm" label-align="left" :label-width="90">
          <t-form-item label="标题">
            <t-input v-model="briefForm.title" placeholder="如：央行二季度货币政策报告定调适度宽松" />
          </t-form-item>
          <t-form-item label="领域分类">
            <t-radio-group v-model="briefForm.topic">
              <t-radio-button value="增长">增长</t-radio-button>
              <t-radio-button value="流动性">流动性</t-radio-button>
              <t-radio-button value="政策">政策</t-radio-button>
              <t-radio-button value="海外">海外</t-radio-button>
            </t-radio-group>
          </t-form-item>
          <t-form-item label="定调倾向">
            <t-radio-group v-model="briefForm.tone">
              <t-radio-button value="利多">利多</t-radio-button>
              <t-radio-button value="中性">中性</t-radio-button>
              <t-radio-button value="警惕">警惕</t-radio-button>
            </t-radio-group>
          </t-form-item>
          <t-form-item label="研判正文">
            <t-textarea v-model="briefForm.body" placeholder="填写核心观点与逻辑..." :rows="3" />
          </t-form-item>
          <t-form-item label="应对策略">
            <t-input v-model="briefForm.actionAdvice" placeholder="如：逢低增配核心宽基底仓" />
          </t-form-item>
        </t-form>
      </div>
    </t-dialog>

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
  </t-space>
</template>
<script setup lang="ts">
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { MessagePlugin } from 'tdesign-vue-next';
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue';

import { useInvestStore } from '@/store';
import type { AccountId, MacroBrief, MacroEvent } from '@/types/invest';
import type { WindMetric, WindNewsItem } from '@/utils/wind';
import { fetchWindEdb, fetchWindNews } from '@/utils/wind';

type MacroTone = '利多' | '中性' | '警惕' | '待定';
type MacroTopic = '增长' | '流动性' | '政策' | '海外';

defineOptions({ name: 'ResearchIndex' });

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

const invest = useInvestStore();

// 宏观四大支柱状态
const windLoading = ref(false);
const windSyncTime = ref('');
const growthPmi = ref<WindMetric | null>(null);
const cpiMetric = ref<WindMetric | null>(null);
const m2Metric = ref<WindMetric | null>(null);
const windNewsList = ref<WindNewsItem[]>([]);

// 指标下钻图表弹窗
const chartModalVisible = ref(false);
const activeMetric = ref<WindMetric | null>(null);
const metricChartEl = ref<HTMLDivElement | null>(null);
let chartInstance: echarts.ECharts | null = null;

// 选项卡
const macroSectionTab = ref('wind_news');
const macroFilter = ref('all');
const eventsFilter = ref<'upcoming' | 'all' | 'past'>('upcoming');
const onlyMajorEvents = ref(true);
const todoFilter = ref<'open' | 'all' | 'done'>('open');

// 晨会信号列表过滤
const macros = computed(() => {
  const list = invest.macroBriefs;
  if (macroFilter.value === 'all') return list;
  return list.filter((m) => m.topic === macroFilter.value);
});

// 待办清单
const openTodos = computed(() => invest.todos.filter((t) => t.status === 'open'));
const doneTodos = computed(() => invest.todos.filter((t) => t.status === 'done'));
const filteredTodos = computed(() => {
  if (todoFilter.value === 'open') return openTodos.value;
  if (todoFilter.value === 'done') return doneTodos.value;
  return invest.todos;
});

// 日历日程
const sortedEvents = computed(() => {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  let list = invest.macroEvents.slice();
  if (onlyMajorEvents.value) {
    list = list.filter((e) => e.level === '重大');
  }
  if (eventsFilter.value === 'upcoming') {
    list = list.filter((e) => e.date >= todayStr);
  } else if (eventsFilter.value === 'past') {
    list = list.filter((e) => e.date < todayStr);
  }
  return list.sort((a, b) => a.date.localeCompare(b.date));
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

// 弹窗状态
const macroModalVisible = ref(false);
const macroManageTab = ref('weather');
const weatherForm = reactive({
  cycle: '',
  sentiment: '偏多' as '偏多' | '中性' | '防守',
  suggestedStockPos: '',
  suggestedEtfPos: '',
});

const briefForm = reactive({
  title: '',
  topic: '增长' as MacroTopic,
  tone: '利多' as MacroTone,
  body: '',
  actionAdvice: '',
});

const todoDialogVisible = ref(false);
const todoForm = reactive({
  account: 'etf' as AccountId,
  code: '',
  name: '',
  side: 'buy' as 'buy' | 'sell',
  quantity: 1000,
  reason: '',
});

function openMacroModal() {
  weatherForm.cycle = invest.macroWeather?.cycle || '';
  weatherForm.sentiment = (invest.macroWeather?.sentiment as any) || '偏多';
  weatherForm.suggestedStockPos = invest.macroWeather?.suggestedStockPos || '60% ~ 70%';
  weatherForm.suggestedEtfPos = invest.macroWeather?.suggestedEtfPos || '75% ~ 85%';
  macroModalVisible.value = true;
}

function submitMacroModal() {
  if (macroManageTab.value === 'weather') {
    if (!weatherForm.cycle.trim()) {
      MessagePlugin.warning('请填写宏观周期定调');
      return;
    }
    invest.updateMacroWeather({
      cycle: weatherForm.cycle.trim(),
      sentiment: weatherForm.sentiment,
      suggestedStockPos: weatherForm.suggestedStockPos,
      suggestedEtfPos: weatherForm.suggestedEtfPos,
      updatedAt: `今日 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 投研定调`,
    });
    MessagePlugin.success('宏观天气与基准仓位已更新');
  } else {
    if (!briefForm.title.trim() || !briefForm.body.trim()) {
      MessagePlugin.warning('请填写研判标题和正文');
      return;
    }
    invest.addMacroBrief({
      title: briefForm.title.trim(),
      time: '今日',
      tone: briefForm.tone,
      topic: briefForm.topic,
      account: 'all',
      body: briefForm.body.trim(),
      actionAdvice: briefForm.actionAdvice.trim() || undefined,
    });
    MessagePlugin.success('已添加一条晨会宏观研判');
  }
  macroModalVisible.value = false;
}

function quickAddTodo(code: string, name: string, reason: string) {
  todoForm.code = code;
  todoForm.name = name;
  todoForm.account = 'etf';
  todoForm.side = 'buy';
  todoForm.quantity = 2000;
  todoForm.reason = reason;
  todoDialogVisible.value = true;
}

function convertNewsToTodo(news: WindNewsItem) {
  todoForm.code = '510300';
  todoForm.name = '沪深300ETF';
  todoForm.account = 'etf';
  todoForm.side = 'buy';
  todoForm.quantity = 1000;
  todoForm.reason = `万得权威要闻联动: ${news.title.slice(0, 30)}`;
  todoDialogVisible.value = true;
}

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

function onConvertEvent(e: MacroEvent) {
  todoForm.code = '510300';
  todoForm.name = '核心大盘宽基';
  todoForm.account = 'etf';
  todoForm.side = 'buy';
  todoForm.quantity = 1000;
  todoForm.reason = `宏观大事件防备/博弈: ${e.title} (${e.date})`;
  todoDialogVisible.value = true;
}

function openCreateTodoDialog() {
  todoForm.code = '';
  todoForm.name = '';
  todoForm.side = 'buy';
  todoForm.quantity = 1000;
  todoForm.reason = '';
  todoDialogVisible.value = true;
}

function confirmCreateTodo() {
  if (!todoForm.name.trim()) {
    MessagePlugin.warning('请填写标的名称');
    return;
  }
  invest.addTodo({
    account: todoForm.account,
    code: todoForm.code.trim() || '—',
    name: todoForm.name.trim(),
    side: todoForm.side,
    quantity: todoForm.quantity,
    reason: todoForm.reason.trim() || '投研决策执行',
  });
  todoDialogVisible.value = false;
  MessagePlugin.success(`已创建【${todoForm.name}】待办`);
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

function isPastEvent(d: string) {
  const todayStr = new Date().toISOString().slice(0, 10);
  return d < todayStr;
}

function isTodayEvent(d: string) {
  const todayStr = new Date().toISOString().slice(0, 10);
  return d === todayStr;
}

function getDaysDiffText(d: string) {
  const target = new Date(d).getTime();
  const now = Date.now();
  const days = Math.ceil((target - now) / (1000 * 3600 * 24));
  if (days <= 0) return '今日';
  return `${days}天后`;
}

function formatEventMonth(d: string) {
  return `${Number(d.slice(5, 7))}月`;
}

function formatEventDay(d: string) {
  return d.slice(8, 10);
}

function openIndDrawer(ind: { name: string; catalyst: string }) {
  MessagePlugin.info(`${ind.name} · 核心催化: ${ind.catalyst}`);
}

function onToggleOnlyMajor() {
  // trigger reactivity
}

// 万得指标图表下钻
function openMetricChart(type: 'pmi' | 'cpi' | 'm2' | 'bond') {
  if (type === 'pmi') {
    activeMetric.value = growthPmi.value;
  } else if (type === 'cpi') {
    activeMetric.value = cpiMetric.value;
  } else if (type === 'm2') {
    activeMetric.value = m2Metric.value;
  } else {
    activeMetric.value = {
      code: 'CN10Y',
      name: '中债国债10年到期收益率与ERP',
      unit: '%',
      source: '万得 / 中债估值',
      freq: '日',
      updateDate: '今日',
      dates: ['2025-09', '2025-11', '2026-01', '2026-03', '2026-05', '2026-07', '2026-09'],
      values: [2.05, 1.98, 1.92, 1.86, 1.84, 1.83, 1.82],
      latestValue: 1.82,
      previousValue: 1.83,
      change: -0.01,
    };
  }
  chartModalVisible.value = true;
}

function renderMetricChart() {
  nextTick(() => {
    if (!metricChartEl.value || !activeMetric.value) return;
    if (!chartInstance) {
      chartInstance = echarts.init(metricChartEl.value);
    }
    const dates = activeMetric.value.dates.map((d) => d.slice(0, 7));
    const values = activeMetric.value.values;

    chartInstance.setOption(
      {
        tooltip: {
          trigger: 'axis',
          formatter: (params: any) => {
            const p = params[0];
            return `${p.name}<br/>${activeMetric.value?.name}: <strong>${p.value} ${activeMetric.value?.unit}</strong>`;
          },
        },
        grid: { left: 52, right: 24, top: 24, bottom: 28 },
        xAxis: {
          type: 'category',
          data: dates,
          axisLine: { lineStyle: { color: '#dcdcdc' } },
          axisLabel: { color: '#666' },
        },
        yAxis: {
          type: 'value',
          scale: true,
          axisLabel: {
            formatter: `{value}${activeMetric.value.unit}`,
            color: '#666',
          },
          splitLine: { lineStyle: { color: '#f0f0f0' } },
        },
        series: [
          {
            name: activeMetric.value.name,
            type: 'line',
            data: values,
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            itemStyle: { color: '#0d706d' },
            lineStyle: { width: 3, color: '#0d706d' },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(13, 112, 109, 0.28)' },
                { offset: 1, color: 'rgba(13, 112, 109, 0.02)' },
              ]),
            },
          },
        ],
      },
      true,
    );
    chartInstance.resize();
  });
}

// 加载万得数据
async function loadWindData(force = false) {
  windLoading.value = true;
  try {
    // 1. 获取 PMI
    const pmiList = await fetchWindEdb('中国官方制造业PMI', 8, force).catch(() => []);
    if (pmiList.length) {
      growthPmi.value = pmiList[0];
    } else {
      growthPmi.value = {
        code: 'M0017126',
        name: '制造业PMI',
        unit: '%',
        source: '国家统计局',
        freq: '月',
        updateDate: '最新',
        dates: ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'],
        values: [50.4, 50.3, 50.0, 50.3, 49.2, 49.8],
        latestValue: 49.8,
        previousValue: 49.2,
        change: 0.6,
      };
    }

    // 2. 获取 CPI
    const cpiList = await fetchWindEdb('中国CPI当月同比', 8, force).catch(() => []);
    if (cpiList.length) {
      cpiMetric.value = cpiList[0];
    } else {
      cpiMetric.value = {
        code: 'M0000612',
        name: 'CPI:当月同比',
        unit: '%',
        source: '国家统计局',
        freq: '月',
        updateDate: '最新',
        dates: ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07'],
        values: [0.1, 0.3, 0.3, 0.2, 0.5],
        latestValue: 0.5,
        previousValue: 0.2,
        change: 0.3,
      };
    }

    // 3. 获取 M2
    const m2List = await fetchWindEdb('中国M2同比', 8, force).catch(() => []);
    if (m2List.length) {
      m2Metric.value = m2List[0];
    } else {
      m2Metric.value = {
        code: 'M0001385',
        name: 'M2:同比',
        unit: '%',
        source: '中国人民银行',
        freq: '月',
        updateDate: '最新',
        dates: ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07'],
        values: [8.3, 8.0, 7.8, 8.0, 8.0],
        latestValue: 8.0,
        previousValue: 8.0,
        change: 0,
      };
    }

    // 4. 获取权威新闻
    const news = await fetchWindNews('中国央行 货币政策 最新', 4, force).catch(() => []);
    if (news.length) {
      windNewsList.value = news;
    } else {
      windNewsList.value = [
        {
          title: '中国人民银行发布《2026年第二季度中国货币政策执行报告》',
          date: '2026-08-12',
          content:
            '继续实施好适度宽松的货币政策。保持流动性充裕和社会融资条件相对宽松，引导社会融资规模同经济增长相匹配。',
          relevance: 0.94,
          url: '',
        },
      ];
    }

    windSyncTime.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  } finally {
    windLoading.value = false;
  }
}

function refreshWindData() {
  loadWindData(true);
  MessagePlugin.success('已触发万得数据实时刷新');
}

onMounted(() => {
  loadWindData();
  window.addEventListener('resize', onResize);
});

function onResize() {
  chartInstance?.resize();
}

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  chartInstance?.dispose();
});
</script>
<style lang="less" scoped>
.page {
  padding-bottom: 32px;
}

/* 顶栏概览条 */
.overview-strip {
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
  }

  &__divider {
    width: 1px;
    height: 24px;
    background: var(--td-border-level-1-color);
    flex-shrink: 0;
  }

  .edb-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--guanlan-gain, #16815f);

    .edb-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--guanlan-gain, #16815f);
      animation: pulse 2s infinite;
    }
  }
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgb(22 129 95 / 50%);
  }

  70% {
    box-shadow: 0 0 0 6px rgb(22 129 95 / 0%);
  }

  100% {
    box-shadow: 0 0 0 0 rgb(22 129 95 / 0%);
  }
}

/* 宏观周期卡片 */
.macro-weather-card {
  .macro-weather-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;

    .weather-title {
      font-size: 15px;
      font-weight: 700;
      color: var(--td-text-color-primary);
    }

    .weather-sub {
      font-size: 12px;
      color: var(--td-text-color-secondary);
      margin-left: 10px;
    }

    .sub-action-text {
      font-size: 12px;
      color: var(--td-text-color-secondary);
    }
  }

  .macro-weather-bar {
    display: grid;
    grid-template-columns: 1.8fr 1fr 2fr;
    gap: 16px;
    background: var(--td-bg-color-secondarycontainer, #f6f8fa);
    padding: 14px 18px;
    border-radius: 8px;

    .weather-col {
      display: flex;
      flex-direction: column;
      gap: 4px;

      .weather-label {
        font-size: 11px;
        color: var(--td-text-color-secondary);
      }

      .weather-val {
        font-size: 14px;
        font-weight: 600;
        color: var(--td-text-color-primary);

        &.pos-text strong {
          color: var(--td-brand-color, #0d706d);
        }
      }
    }
  }
}

/* EDB 支柱卡片 */
.sync-time-hint {
  font-size: 11px;
  color: var(--td-text-color-placeholder);
}

.edb-pillar-card {
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 8px;
  padding: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 10px;

  &:hover {
    border-color: var(--td-brand-color, #0d706d);
    box-shadow: 0 3px 12px rgb(13 112 109 / 8%);
    transform: translateY(-1px);

    .chart-link {
      color: var(--td-brand-color, #0d706d);
    }
  }

  .pillar-top {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .pillar-label {
      font-size: 11px;
      color: var(--td-text-color-secondary);
    }
  }

  .pillar-main {
    .pillar-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--td-text-color-primary);
      display: block;
      margin-bottom: 4px;
    }

    .pillar-val-row {
      display: flex;
      align-items: baseline;
      gap: 4px;

      .pillar-val {
        font-size: 24px;
        font-weight: 700;
        font-family: var(--td-font-family-mono, monospace);
        font-variant-numeric: tabular-nums;
        color: var(--td-text-color-primary);
      }

      .pillar-unit {
        font-size: 13px;
        color: var(--td-text-color-secondary);
      }

      .pillar-change {
        font-size: 12px;
        font-weight: 600;
        margin-left: 6px;

        &.is-up {
          color: var(--guanlan-gain, #b8433e);
        }

        &.is-down {
          color: var(--guanlan-loss, #16815f);
        }
      }

      .pillar-tag-sub {
        font-size: 11px;
        font-weight: 600;
        color: var(--td-brand-color, #0d706d);
        background: rgb(13 112 109 / 8%);
        padding: 2px 6px;
        border-radius: 4px;
        margin-left: 6px;
      }
    }
  }

  .pillar-sub {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
    color: var(--td-text-color-placeholder);

    .chart-link {
      font-weight: 500;
      transition: color 0.15s ease;
    }
  }
}

/* 资产配置雷达 */
.radar-group {
  background: var(--td-bg-color-secondarycontainer, #f8fafb);
  border-radius: 8px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;

  .radar-hd {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .radar-tag {
      font-size: 13px;
      font-weight: 700;
      color: var(--td-text-color-primary);
    }

    .radar-weight {
      font-size: 11px;
      color: var(--td-text-color-secondary);
      font-family: var(--td-font-family-mono, monospace);
    }
  }

  .radar-desc {
    font-size: 12px;
    color: var(--td-text-color-secondary);
    line-height: 1.5;
    margin: 0;
  }

  .radar-targets {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 4px;

    .target-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--td-bg-color-container);
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid var(--td-border-level-1-color);

      .target-info {
        display: flex;
        align-items: center;
        gap: 8px;

        .target-name {
          font-size: 12px;
          font-weight: 600;
          color: var(--td-text-color-primary);
        }

        .target-code {
          font-size: 11px;
          font-family: var(--td-font-family-mono, monospace);
          color: var(--td-text-color-placeholder);
        }
      }
    }
  }
}

/* 万得要闻流 */
.wind-news-panel {
  .wind-news-filter {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;

    .wind-news-hint {
      font-size: 12px;
      color: var(--td-text-color-secondary);
    }
  }

  .wind-news-list {
    display: flex;
    flex-direction: column;
    gap: 12px;

    .wind-news-card {
      background: var(--td-bg-color-container);
      border: 1px solid var(--td-border-level-1-color);
      border-radius: 8px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;

      .news-hd {
        display: flex;
        align-items: center;
        gap: 8px;

        .news-badge {
          background: #e8f3ff;
          color: #0052d9;
          font-size: 10px;
          font-weight: 600;
          padding: 1px 6px;
          border-radius: 4px;
          flex-shrink: 0;
        }

        .news-title {
          font-size: 13px;
          color: var(--td-text-color-primary);
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .news-date {
          font-size: 11px;
          color: var(--td-text-color-placeholder);
          font-family: var(--td-font-family-mono, monospace);
          flex-shrink: 0;
        }
      }

      .news-content {
        font-size: 12px;
        color: var(--td-text-color-secondary);
        line-height: 1.6;
        margin: 0;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 3;
        overflow: hidden;
      }

      .news-ft {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 4px;

        .news-rel {
          font-size: 11px;
          color: var(--td-text-color-placeholder);
        }
      }
    }
  }
}

/* 晨会研判 */
.macro-filter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;

  .macro-count-hint {
    font-size: 11px;
    color: var(--td-text-color-placeholder);
  }
}

.macro {
  background: var(--td-bg-color-container);
  padding: 10px 14px;
  border-radius: 6px;
  margin-bottom: 10px;
  border: 1px solid var(--td-border-level-1-color);

  &-hd {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }

  &-title {
    font-size: 13px;
    color: var(--td-text-color-primary);
  }

  &-time-badge {
    font-size: 11px;
    color: var(--td-text-color-placeholder);
  }

  &-bd {
    font-size: 12px;
    color: var(--td-text-color-secondary);
    line-height: 1.5;
    margin: 4px 0 8px;
  }

  &-action-box {
    background: var(--td-bg-color-secondarycontainer, #f3f5f8);
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 12px;
    margin-bottom: 8px;

    .action-box-title {
      font-weight: 600;
      color: var(--td-brand-color, #0d706d);
    }

    .action-box-text {
      color: var(--td-text-color-primary);
    }
  }

  &-ft {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
}

/* 会议日程 */
.events-timeline {
  display: flex;
  flex-direction: column;
  gap: 10px;

  .event-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: var(--td-bg-color-container);
    border: 1px solid var(--td-border-level-1-color);
    border-radius: 8px;

    &.event-is-major {
      border-left: 3px solid #e34d59;
    }

    .event-left {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 52px;
      flex-shrink: 0;

      .event-date-box {
        display: flex;
        flex-direction: column;
        align-items: center;

        .event-month {
          font-size: 10px;
          color: var(--td-text-color-secondary);
        }

        .event-day {
          font-size: 16px;
          font-weight: 700;
          font-family: var(--td-font-family-mono, monospace);
        }
      }
    }

    .event-main {
      flex: 1;
      min-width: 0;

      .event-header-line {
        display: flex;
        align-items: center;
        gap: 6px;

        .event-title {
          font-size: 13px;
          color: var(--td-text-color-primary);
        }
      }

      .event-desc {
        font-size: 11px;
        color: var(--td-text-color-secondary);
        margin: 2px 0;
      }

      .event-focus-box {
        font-size: 11px;
        color: var(--td-text-color-placeholder);
      }
    }
  }
}

/* 产业网格 */
.industry-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;

  .ind-card {
    background: var(--td-bg-color-container);
    border: 1px solid var(--td-border-level-1-color);
    border-radius: 8px;
    padding: 12px;
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover {
      border-color: var(--td-brand-color, #0d706d);
    }

    &-hd {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }

    .ind-catalyst-box {
      font-size: 11px;
      color: var(--td-text-color-secondary);
      margin-bottom: 6px;

      .catalyst-tag {
        background: #fff0ed;
        color: #d54941;
        padding: 0 4px;
        border-radius: 2px;
        font-size: 10px;
        margin-right: 4px;
      }
    }

    .ind-targets-line {
      font-size: 11px;
      color: var(--td-text-color-placeholder);
    }
  }
}

/* 决策待办 */
.todo-filter-bar {
  margin-bottom: 12px;
}

.todo-list {
  :deep(.t-list-item) {
    padding: 10px 4px;
  }
}

.todo-inner {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;

  .todo-top {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .todo-badges {
      display: flex;
      align-items: center;
      gap: 6px;

      .todo-code {
        font-family: var(--td-font-family-mono, monospace);
        font-size: 11px;
        color: var(--td-text-color-placeholder);
      }
    }

    .todo-date {
      font-size: 11px;
      color: var(--td-text-color-placeholder);
    }
  }

  .todo-name-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 2px 0;

    .todo-name {
      font-size: 13px;
      color: var(--td-text-color-primary);
    }

    .todo-qty {
      font-size: 12px;
      font-weight: 600;
      font-family: var(--td-font-family-mono, monospace);
      color: var(--td-brand-color, #0d706d);
    }
  }

  .todo-reason {
    font-size: 12px;
    color: var(--td-text-color-secondary);
    margin: 0;
  }

  .todo-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 4px;
  }
}

/* 指标弹窗下钻 */
.metric-dialog-body {
  .dialog-meta-bar {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    background: var(--td-bg-color-secondarycontainer, #f3f5f8);
    padding: 12px 16px;
    border-radius: 8px;
    gap: 8px;

    .meta-item {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .meta-label {
        font-size: 11px;
        color: var(--td-text-color-secondary);
      }

      .meta-val {
        font-size: 14px;
        font-weight: 600;
        font-family: var(--td-font-family-mono, monospace);
        color: var(--td-text-color-primary);

        &.is-up {
          color: var(--guanlan-gain, #b8433e);
        }

        &.is-down {
          color: var(--guanlan-loss, #16815f);
        }
      }
    }
  }

  .dialog-foot-note {
    font-size: 11px;
    color: var(--td-text-color-placeholder);
    margin-top: 12px;
    text-align: right;
  }
}

@media (width <= 767px) {
  .macro-weather-bar {
    grid-template-columns: 1fr !important;
  }

  .dialog-meta-bar {
    grid-template-columns: 1fr 1fr !important;
  }
}
</style>
