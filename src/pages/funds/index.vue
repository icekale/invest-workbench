<template>
  <t-space class="page" direction="vertical" :size="16" style="width: 100%">
    <!-- 基金导航栏 -->
    <funds-nav />

    <!-- 顶栏概览条 -->
    <div class="overview-strip">
      <div class="overview-strip__item">
        <span class="overview-strip__label">每日宏观信号</span>
        <span class="overview-strip__val">{{ invest.macroBriefs.length }} <small>条研判</small></span>
      </div>
      <div class="overview-strip__divider" />
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

    <!-- 宏观信号 + 决策待办 -->
    <t-row :gutter="[16, 16]">
      <t-col :xs="12" :xl="7">
        <t-card title="每日宏观信号">
          <template #actions>
            <t-space :size="8" align="center">
              <span class="sub-action-text">{{ invest.macroWeather?.updatedAt || '每日 08:30 晨会定调' }}</span>
              <t-button size="small" variant="text" theme="primary" @click="openMacroModal"> + 记研判 </t-button>
            </t-space>
          </template>

          <!-- 宏观天气与建议基准仓位 -->
          <div class="macro-weather-bar">
            <div class="weather-col main-cycle">
              <div class="weather-label">宏观周期定调</div>
              <div class="weather-val">{{ invest.macroWeather?.cycle }}</div>
            </div>
            <div class="weather-col sentiment-badge">
              <div class="weather-label">市场偏好</div>
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

          <!-- 核心量化温度计 4 锚点 -->
          <div class="macro-indicators-strip">
            <div v-for="ind in invest.macroIndicators" :key="ind.id" class="ind-pill" :title="ind.hint">
              <div class="ind-top">
                <span class="ind-name">{{ ind.name }}</span>
                <t-tag size="small" :theme="ind.theme" variant="light">{{ ind.status }}</t-tag>
              </div>
              <div class="ind-bottom">
                <span class="ind-val">{{ ind.value }}</span>
                <span class="ind-hint">{{ ind.hint }}</span>
              </div>
            </div>
          </div>

          <!-- 筛选过滤与条数 -->
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
            <t-timeline-item v-for="m in macros" :key="m.id" :dot-color="toneTimelineDot[m.tone]">
              <div class="macro">
                <div class="macro-hd">
                  <strong class="macro-title">{{ m.title }}</strong>
                  <t-space :size="6" align="center">
                    <t-tag size="small" :theme="toneTagTheme(m.tone)" variant="light">{{ m.tone }}</t-tag>
                    <t-tag size="small" variant="light">{{ m.topic }}</t-tag>
                    <t-tag size="small" variant="outline">{{
                      m.account === 'stock' ? '股票' : m.account === 'etf' ? 'ETF' : '全市场'
                    }}</t-tag>
                    <span class="macro-time-badge">{{ m.time }}</span>
                  </t-space>
                </div>
                <p class="macro-bd">{{ m.body }}</p>

                <!-- 应对策略建议 -->
                <div v-if="m.actionAdvice" class="macro-action-box">
                  <span class="action-box-title">【应对策略】</span>
                  <span class="action-box-text">{{ m.actionAdvice }}</span>
                </div>

                <!-- 底部交互：转为待办 / 删除 -->
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
        </t-card>
      </t-col>

      <t-col :xs="12" :xl="5">
        <t-card title="决策待办清单">
          <template #actions>
            <t-button size="small" variant="text" theme="primary" @click="router.push('/plan')"> 调仓计划 → </t-button>
          </template>
          <div v-if="openTodos.length" class="todo-list">
            <div v-for="t in openTodos" :key="t.id" class="todo-item">
              <div class="todo-left">
                <div class="todo-headline">
                  <t-tag size="small" :theme="t.side === 'buy' ? 'danger' : 'success'" variant="light">
                    {{ t.side === 'buy' ? '买入' : '卖出' }}
                  </t-tag>
                  <span class="todo-target">{{ t.name }}</span>
                  <span v-if="t.quantity" class="todo-qty">{{ t.quantity }} 股/份</span>
                </div>
                <div class="todo-reason">{{ t.reason }}</div>
              </div>
              <t-button size="small" theme="primary" variant="outline" @click="markTodoDone(t.id)">完成</t-button>
            </div>
          </div>
          <t-empty v-else description="当前无待执行买卖项，可在机会池中生成" style="padding: 24px 0">
            <template #action>
              <t-button size="small" theme="primary" variant="outline" @click="router.push('/plan')">
                查看调仓计划
              </t-button>
            </template>
          </t-empty>
        </t-card>
      </t-col>
    </t-row>

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
              <t-tag size="small" variant="light" :theme="o.account === 'etf' ? 'primary' : 'warning'">
                {{ o.account === 'etf' ? 'ETF' : '股票' }}
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
              <t-popconfirm content="确定将该机会生成一条买入待办？" @confirm="convertOppToTodo(o)">
                <t-link theme="primary" hover="color">转为待办</t-link>
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
            <t-radio value="etf">ETF 账户</t-radio>
            <t-radio value="stock">股票账户</t-radio>
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

    <!-- 宏观研判与定调弹窗 -->
    <t-dialog
      v-model:visible="macroModalVisible"
      header="宏观研判与定调管理"
      :on-confirm="saveMacroModal"
      width="560px"
    >
      <t-tabs v-model="macroActiveTab" theme="card" style="margin-bottom: 16px">
        <t-tab-panel value="brief" label="记一笔晨会研判" />
        <t-tab-panel value="weather" label="调整宏观天气与基准仓位" />
      </t-tabs>

      <div v-if="macroActiveTab === 'brief'">
        <t-form label-align="top">
          <t-form-item label="研判标题">
            <t-input v-model="newBrief.title" placeholder="例如：央行公开市场净投放加码，资金面充裕平稳" />
          </t-form-item>
          <t-row :gutter="12">
            <t-col :span="4">
              <t-form-item label="核心主题">
                <t-select v-model="newBrief.topic">
                  <t-option value="增长" label="增长" />
                  <t-option value="流动性" label="流动性" />
                  <t-option value="政策" label="政策" />
                  <t-option value="海外" label="海外" />
                </t-select>
              </t-form-item>
            </t-col>
            <t-col :span="4">
              <t-form-item label="多空偏向">
                <t-select v-model="newBrief.tone">
                  <t-option value="偏多" label="偏多" />
                  <t-option value="中性" label="中性" />
                  <t-option value="偏空" label="偏空" />
                </t-select>
              </t-form-item>
            </t-col>
            <t-col :span="4">
              <t-form-item label="关联账户">
                <t-select v-model="newBrief.account">
                  <t-option value="all" label="全市场" />
                  <t-option value="stock" label="股票账户" />
                  <t-option value="etf" label="ETF账户" />
                </t-select>
              </t-form-item>
            </t-col>
          </t-row>
          <t-form-item label="逻辑推导与研判正文">
            <t-textarea
              v-model="newBrief.body"
              placeholder="记录晨报核心数据、影响链条与市场反应"
              :autosize="{ minRows: 2, maxRows: 4 }"
            />
          </t-form-item>
          <t-form-item label="应对策略建议">
            <t-input v-model="newBrief.actionAdvice" placeholder="例如：宽基ETF逢调整按计划低吸，避免盘中追高" />
          </t-form-item>

          <div
            style="
              margin: 14px 0 10px;
              padding: 10px 12px;
              background: var(--td-bg-color-secondarycontainer, #f8fafc);
              border-radius: 6px;
            "
          >
            <t-form-item label="联动生成待办建议（可选）" style="margin-bottom: 8px">
              <t-space align="center">
                <t-switch v-model="newBrief.enableTodo" />
                <span style="font-size: 12px; color: var(--td-text-color-secondary)">
                  保存时同时在右侧「决策待办清单」生成一条待执行动作
                </span>
              </t-space>
            </t-form-item>

            <div v-if="newBrief.enableTodo">
              <t-row :gutter="12">
                <t-col :span="4">
                  <t-form-item label="买卖方向">
                    <t-radio-group v-model="newBrief.todoSide" variant="default-filled">
                      <t-radio-button value="buy">买入</t-radio-button>
                      <t-radio-button value="sell">卖出</t-radio-button>
                    </t-radio-group>
                  </t-form-item>
                </t-col>
                <t-col :span="8">
                  <t-form-item label="标的名称">
                    <t-input v-model="newBrief.todoName" placeholder="例如：沪深300ETF / 贵州茅台" />
                  </t-form-item>
                </t-col>
              </t-row>
              <t-form-item label="待办执行理由" style="margin-bottom: 0">
                <t-input v-model="newBrief.todoReason" placeholder="例如：流动性宽裕支撑底仓，逢低补齐目标权重" />
              </t-form-item>
            </div>
          </div>
        </t-form>
      </div>

      <div v-else>
        <t-form label-align="top">
          <t-form-item label="宏观周期定调">
            <t-input v-model="weatherForm.cycle" placeholder="例如：货币宽松 · 信用温和扩张" />
          </t-form-item>
          <t-form-item label="全市场风险偏好">
            <t-radio-group v-model="weatherForm.sentiment" variant="default-filled">
              <t-radio-button value="偏多">偏多</t-radio-button>
              <t-radio-button value="中性">中性</t-radio-button>
              <t-radio-button value="谨慎">谨慎</t-radio-button>
              <t-radio-button value="防守">防守</t-radio-button>
            </t-radio-group>
          </t-form-item>
          <t-row :gutter="12">
            <t-col :span="6">
              <t-form-item label="股票账户建议仓位">
                <t-input v-model="weatherForm.suggestedStockPos" placeholder="例如：60% ~ 70%" />
              </t-form-item>
            </t-col>
            <t-col :span="6">
              <t-form-item label="ETF账户建议仓位">
                <t-input v-model="weatherForm.suggestedEtfPos" placeholder="例如：75% ~ 85%" />
              </t-form-item>
            </t-col>
          </t-row>
        </t-form>
      </div>
    </t-dialog>
  </t-space>
</template>
<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { smartPortfolios } from '@/mock/invest';
import { useInvestStore } from '@/store';
import type { AccountId, MacroBrief, Opportunity, TradeSide } from '@/types/invest';
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

// 宏观研判与定调弹窗控制
const macroModalVisible = ref(false);
const macroActiveTab = ref<'brief' | 'weather'>('brief');

const newBrief = reactive({
  title: '',
  topic: '流动性',
  tone: '偏多',
  account: 'etf' as AccountId | 'all',
  body: '',
  actionAdvice: '',
  enableTodo: true,
  todoSide: 'buy' as TradeSide,
  todoName: '',
  todoQty: 100,
  todoReason: '',
});

const weatherForm = reactive({
  cycle: '',
  sentiment: '偏多',
  suggestedStockPos: '',
  suggestedEtfPos: '',
});

function openMacroModal() {
  weatherForm.cycle = invest.macroWeather?.cycle || '';
  weatherForm.sentiment = invest.macroWeather?.sentiment || '偏多';
  weatherForm.suggestedStockPos = invest.macroWeather?.suggestedStockPos || '60% ~ 70%';
  weatherForm.suggestedEtfPos = invest.macroWeather?.suggestedEtfPos || '75% ~ 85%';
  macroActiveTab.value = 'brief';
  macroModalVisible.value = true;
}

function saveMacroModal() {
  if (macroActiveTab.value === 'weather') {
    if (!weatherForm.cycle.trim()) {
      MessagePlugin.warning('请填写宏观周期定调');
      return;
    }
    invest.updateMacroWeather({
      cycle: weatherForm.cycle.trim(),
      sentiment: weatherForm.sentiment,
      suggestedStockPos: weatherForm.suggestedStockPos.trim() || '60% ~ 70%',
      suggestedEtfPos: weatherForm.suggestedEtfPos.trim() || '75% ~ 85%',
      updatedAt: `今日 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 投研定调`,
    });
    MessagePlugin.success('宏观天气与基准仓位已更新');
    macroModalVisible.value = false;
    return;
  }

  // brief
  if (!newBrief.title.trim() || !newBrief.body.trim()) {
    MessagePlugin.warning('请填写研判标题和逻辑正文');
    return;
  }

  const suggestedTodo =
    newBrief.enableTodo && newBrief.todoName.trim()
      ? {
          account: (newBrief.account === 'stock' ? 'stock' : 'etf') as AccountId,
          name: newBrief.todoName.trim(),
          side: newBrief.todoSide,
          quantity: Number(newBrief.todoQty) || 0,
          reason: newBrief.todoReason.trim() || newBrief.actionAdvice.trim() || newBrief.title.trim(),
        }
      : undefined;

  invest.addMacroBrief({
    title: newBrief.title.trim(),
    topic: newBrief.topic,
    tone: newBrief.tone,
    account: newBrief.account,
    body: newBrief.body.trim(),
    actionAdvice: newBrief.actionAdvice.trim() || undefined,
    suggestedTodo,
  });

  if (suggestedTodo) {
    invest.addTodo({
      account: suggestedTodo.account,
      code: '',
      name: suggestedTodo.name,
      side: suggestedTodo.side,
      quantity: suggestedTodo.quantity || 0,
      reason: suggestedTodo.reason,
    });
    MessagePlugin.success('已添加晨会研判，并同步在右侧生成决策待办');
  } else {
    MessagePlugin.success('已添加一条晨会宏观研判');
  }

  // reset
  newBrief.title = '';
  newBrief.body = '';
  newBrief.actionAdvice = '';
  newBrief.todoName = '';
  newBrief.todoReason = '';
  macroModalVisible.value = false;
}

function onConvertMacro(m: MacroBrief) {
  invest.convertMacroToTodo(m);
  MessagePlugin.success(`已生成决策待办「${m.suggestedTodo?.name || m.title.slice(0, 10)}」，请在右侧清单查看`);
}

// 宏观信号色彩
const toneTimelineDot: Record<string, string> = {
  偏多: '#b8433e', // Guanlan gain red
  中性: '#3569bb', // Guanlan blue
  偏空: '#16815f', // Guanlan loss green
};

function toneTagTheme(tone: string): 'danger' | 'primary' | 'success' | 'default' {
  if (tone === '偏多') return 'danger';
  if (tone === '偏空') return 'success';
  if (tone === '中性') return 'primary';
  return 'default';
}

const macros = computed(() =>
  macroFilter.value === 'all' ? invest.macroBriefs : invest.macroBriefs.filter((m) => m.topic === macroFilter.value),
);

const openTodos = computed(() => invest.todos.filter((x) => x.status === 'open'));

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

function markTodoDone(id: string) {
  invest.setTodoStatus(id, 'done');
  MessagePlugin.success('待办已标记完成');
}

function saveOpp() {
  if (!opp.name.trim() || !opp.thesis.trim()) {
    MessagePlugin.warning('名称和论点必填');
    return false;
  }
  invest.addOpportunity({
    name: opp.name.trim(),
    account: opp.account,
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
  const code = match ? match[0] : o.account === 'etf' ? '510300' : '600519';
  invest.addTodo({
    account: o.account,
    code,
    name: o.name,
    side: 'buy',
    quantity: o.account === 'etf' ? 1000 : 100,
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
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 14px;

  @media (width <= 900px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (width <= 480px) {
    grid-template-columns: 1fr;
  }

  .ind-pill {
    padding: 8px 10px;
    background: var(--td-bg-color-secondarycontainer, #f1f5f9);
    border: 1px solid var(--td-component-stroke, #e2e8f0);
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .ind-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 4px;

    .ind-name {
      font-size: 11px;
      color: var(--td-text-color-secondary);
      white-space: nowrap;
    }
  }

  .ind-bottom {
    display: flex;
    align-items: baseline;
    gap: 6px;
    overflow: hidden;

    .ind-val {
      font-size: 14px;
      font-weight: 700;
      color: var(--td-text-color-primary);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .ind-hint {
      font-size: 11px;
      color: var(--td-text-color-placeholder);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
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
