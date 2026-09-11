# 优化方案与实施计划

> 2026-09-08 · 基于全量前后端代码审查与严格测试后制定。
> 现状基线：tsc / eslint / stylelint / build 全绿；check:quotes / fund / backup / book 四个自检脚本通过；线上 <https://stock.053727.xyz> 已部署本轮修复。

## 一、程序现状概述

四个一级模块（驾驶舱 / 研究 / 计划 / 复盘）+ 登录，单用户本地记账工作台。数据层全部在浏览器 localStorage（`invest-v2-*` 键族），行情走腾讯 `/qt`（新浪 `/sina` 兜底），公募数据走东财 `/em`，交易日历走深交所 `/szse`，宏观事件直连华尔街见闻（CORS 已开），产业风口直连选股宝，万得 EDB 经 Caddy 代理（**当前账户余额不足，全部降级**）。估值分位基于内置 10 年 PE/PB 分布参数 + 腾讯实时点位计算。

架构判断：单人工具，"后端"就是 Caddy 反代 + 前端内的领域逻辑（utils/），这个形态短期不需要变。

## 二、优化方案（按收益排序）

### 方向 A：数据真实性收口（收益最高）

本轮审查修复了三处「看起来有数据、实际是编造」的问题（估值历史随机数、降级假点位、万得失败假指标）。剩余同类问题与延伸动作（下表是当时审查的建议**原文**，包括其中的数字建议；实际落地情况一律以文末清单为准）：

| #   | 事项               | 说明                                                                                                                                                       |
| --- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | 万得充值或下线入口 | 账户余额不足，EDB 四大支柱/权威要闻长期「未接通」。二选一：充值激活；或把四大支柱改为接入免费源（国家统计局/中债官网 JSON），把 Wind 相关代码退役          |
| A2  | 组合净值曲线升级   | 现为「当前盈亏率的平滑示意」。真实化路径：每日收盘后（15:05）把总市值快照写入 localStorage（按日一条），积累后改画真实净值曲线；历史缺口用标注为示意的线补 |
| A3  | 估值历史真实化     | 用东财 datacenter 的指数估值历史接口（需新增 `/em-datacenter/` 代理路由）替换确定性模拟序列，弹窗去掉「示意」标注                                          |
| A4  | 手续费入账         | 交易执行 fee 固定为 0；台账已有 fee 字段与计算。在交易弹窗加可选手续费输入（默认按万 2.5 + 最低 5 元估算），买入计入成本、卖出计入已实现盈亏               |

### 方向 B：可靠性

| #   | 事项                  | 说明                                                                                                                   |
| --- | --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| B1  | 上游偶发 502 重试     | 深交所/东财偶发连接 reset。Caddy 层给 `/szse`、`/em` 上游加 `health_uri` + 重试，或前端 fetch 封装统一一次重试         |
| B2  | localStorage 容量治理 | 万得缓存（6h TTL）、快照、流水逐年累积。加启动时清理：过期 wind-cache、上限条数（如流水 5000 条）                      |
| B3  | 快照自动备份          | 每周一把 snapshot 下载提示只弹一次；或导出自动触发。防 localStorage 被清（无痕模式/换机丢全部数据）                    |
| B4  | 时区统一回归          | 本轮已建 `todayCN()/formatCN()`。计划：全局替换残余 `toISOString().slice(0,10)`（grep 确认仅剩快照 at 字段属合理 UTC） |

### 方向 C：体验与一致性

| #   | 事项                       | 说明                                                                                                                    |
| --- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| C1  | 移动端回归清单化           | 本轮修了研究/复盘/计划的错位。把「底栏导航、卡片头换行、列表上下排、表格横滑、44px 触点」沉淀为 checklist，新增页面自查 |
| C2  | 方法论图片懒加载           | 8 张 `methodology/*.png` 加 `loading="lazy"`，首屏少拉几 MB                                                             |
| C3  | 驾驶舱「记录一条」按钮语义 | 当前跳公募研究，名字含义模糊；改为直接打开机会池新增弹窗                                                                |
| C4  | 搜索体验                   | 顶栏搜索已支持代码直达；补名称模糊匹配下拉建议                                                                          |

### 方向 D：技术债

| #   | 事项          | 说明                                                                                                                                                              |
| --- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Wind Key 管理 | Bearer Key 写在 VPS Caddyfile 里（未入仓）。建议改环境变量引用或独立 secrets 文件，避免备份泄露                                                                   |
| D2  | 测试补齐      | check 脚本已覆盖 book/ledger/valuation/日期。已补 quote 解析的指数字段用例（`parseIndexQuotes`，见第 2 批）；rebalance 用例失去对象——该模块已删（零消费者，见下） |
| D3  | 依赖升级      | npm audit 有中危告警（构建链）；跑 `npm audit fix` 无破坏项                                                                                                       |

## 三、实施计划

### 第 1 批（1 次会话，本次已含一部分）

- [x] 时区统一：`todayCN()/formatCN()` 落地 store/ledger（已完成）
- [x] 估值历史确定性 + 弹窗「示意」标注（已完成）
- [x] ~~万得失败诚实展示 + 状态灯~~ —— 已作废：`src/utils/wind.ts` 在 8be8e39 删除，全库已无「万得」，此项失去对象
- [x] 再平衡佣金最低 5 元 —— 已做。下限加在 `src/utils/accounts.ts` 的 `feeOf`（所有费用计算的唯一出口），不是加在 `rateOf`：`rateOf` 要留给"每手费率"用，把元塞进去会算出 `rate = 5`。`MIN_COMMISSION = 5` 只对有佣金的账户成立，`feeRate: 0` 的免佣账户下限是 0。原 `src/utils/rebalance.ts` 的 `estimatedFee` 不含下限（它把全部调仓委托合成一个金额，按笔收的下限摊不到单笔上）——该文件已整删，这些注释一并移到这里
- [x] A2 每日市值快照落库（`recordDailySnapshot()` 每次行情刷新同日覆盖；AccountPanel 有 ≥2 日快照自动切真实净值，否则回退示意）
- [x] C2 图片懒加载（已在迭代中落地）

### 第 2 批（1 次会话）

- [x] B1 fetch 封装重试 —— `src/utils/http.ts` 已接入 calendar / macro-cn / valuation / sw-valuation / briefs / briefing / quote / backup。后三处（`fetchQuotes` / `fetchSinaQuotes` / `fetchTradeMonth`）原来是裸 `fetch` + 自拼错误串，现已换成 `fetchOk` 并包 `withRetry`，重试覆盖到读响应体（连接重置常发生在 body 读到一半）。`scripts/check-quotes.ts` 有断言：502 重试一次后拿到数据、404 只试一次
- [x] B2 localStorage 清理 —— 只清真正无界增长的那一处：新增 `pruneBriefingCache()`，在 `writeCachedBriefing` 写入时清掉当日与昨日以外的晨会缓存。**保留昨日是必须的**：`src/pages/research/index.vue:158` 会读昨日那份取 `yesterdayStance` 喂给模型。**明确不做「流水 5000 条上限」**——流水是持仓与成本结转的唯一来源，截断等于改账，比配额溢出更糟。另两处无需处理：`val-history` 已有 `MAX_POINTS=60` 上限，市场缓存已搬服务端 `/sync/cache`
- [x] B3 快照周提醒（7 天未导出在驾驶舱提示一次；导出自动记录 lastBackupAt）
- [x] A4 交易手续费输入 —— 试算面板渲染出手续费，可手改并「恢复自动」；`effectiveFee` 同时驱动现金校验、加权成本与落库（`submitTrade` 显式传 `fee`，否则 store 会按费率重算）。**最低佣金 5 元已生效**（见 B 段）。影响面已核实：存量持仓成本不受影响，因为加权成本读的是**存储的** `tx.fee`（`src/utils/ledger.ts:204,259-265,273`），只有新成交和缺费率列的 CSV 导入走新规则
- [x] D2 测试补齐 —— 两半分别处置：**指数字段用例**已补进 `scripts/check-valuation.ts`（`parseIndexQuotes` 断言守 `vals[32]`=涨跌幅、`vals[39]`=PE；改错下标会拿到时间戳/成交额而**不报错**，所以这组断言是静默错误唯一的哨兵，已用变异测试验证会真的失败）；**rebalance 用例改删模块**——`src/utils/rebalance.ts`（337 行）已零消费者：knip 报死代码，全库 grep 只剩 `rebalanceThresholdPct`（阈值偏好，不是本模块），唯一消费者 `RebalanceCalculator.vue` 已于 d8e5933 随计划页简化删掉。补测一个不存在的模块没有意义，所以 `git rm`

### 第 3 批（需用户决策后执行）

- [x] ~~A1 万得充值 vs 免费源替换~~ —— **已作废：免费源替换早在 `8be8e39`（2026-09-09「chore: drop unused Wind client and name pillar thresholds」）就做完了**，删掉 `src/utils/wind.ts`（218 行）与 `vite.config.ts` 里 10 行代理。四大支柱现走东财数据中心 `/em-dc/api/data/v1/get?reportName=RPT_ECONOMY_{PMI,CPI,PPI,GDP}`（`src/utils/macro-cn.ts` 的 `dcUrl()`），社融走 `/sync/afre`（央行 xlsx，`src/utils/afre.ts`）——**两条都是免费源、都不需要 key**，与 A1 建议的「国家统计局/中债官网 JSON」是同一条路线。线上实测数据是新鲜的：PMI 2026-08、CPI 2026-08、GDP 2026 年第 1-2 季度。全库已无活的 Wind/EDB **数据/依赖**引用：残余只有 CSS 类名 `edb-*`（`MacroCompass.vue:81,117,148,184` 的 `edb-pillar-card`、`research/index.vue:28-29` 的 `edb-status`/`edb-dot` 及 `research.less` 中对应规则）与 `research.less:268` 一行 `/* EDB 支柱卡片 */` 注释，纯命名残留、不连任何接口——不重命名是因为那是零收益的 churn（要改 11 处类名 + 重建），留到下次真需要改这几个卡片时顺手做。「未接通」也不再是常态：`macroState` 只在 `okCount === 0` 时置 error（`src/pages/research/MacroCompass.vue:559-575`）
- [x] A3 估值历史真实化 —— **原定路径（东财）实测证伪**：`datacenter-web` 的 `RPT_VALUEINDEX` / `RPT_INDEX_VALUATION` / `RPT_VALUEINDEX_DET` / `RPT_INDEXVALUATION` / `RPT_VALUE_INDEX` 全部返 `code 9501`「报表配置不存在」，`RPT_VALUATION_INDEX` 虽存在但要必填参数（`9201` 返回数据为空），所以**不需要**在 VPS 加 `/em-datacenter/` 路由。乐咕乐股的 `/api/stock-data/weight-pe?marketId=…&token=MD5(YYYY-MM-DD)` 接口找到了，但它要服务端会话 cookie，无 cookie 稳定返 `200` + **0 字节**，同一请求实测 `0B / 9356B / 44875B / 1.37MB` 四种结果且整站一度 504 —— 浏览器直连做不到，不适合生产。真正可修的是**同一个指数被两份源评**：`buildItem` 用腾讯 PE 去查中证分布算分位（异源），实测偏差科创50 **+85.8%**（129.73 vs 69.82）、中证1000 +37.8%、中证500 +23.8% —— 会把指数顶到接近 100% 分位，报出假的「偏高/减配」，而这条分位正是驱动 `signal/advice/allocationTilt` 的开关。已改为同源（有 `dist` 时以 `dist.currentPe` 为准），`scripts/check-valuation.ts` 有断言且已用变异测试验证会真失败。修复后实测（用 production 的 `percentileFromQuantiles` 算，分位为修复前 → 修复后）：科创50 **100% → 67%**（不再是顶格）、中证1000 93% → 70%、中证500 92% → 74%、沪深300 54% → 57%（低 PE 指数几乎不动，证明旧偏差随 PE 水平放大——正是异源的指纹）。**残留缺口**：`sz399006` 创业板指中证不覆盖（返空 `data`），UI 已诚实显示「拿不到真实 PE 历史，不画图」而不是编一条
- [ ] 创业板指 399006 真实 PE 历史（中证不覆盖；可用源：理杏仁/乐咕乐股均需会话或付费。维持现状「不画图」是可接受的）
- [x] ~~C3 驾驶舱「记录一条」按钮语义~~ —— 已作废：该按钮早已在四栏 IA 改版中删掉（全库 `rg '记录一条' src/` 无命中），没有可改的对象
- [x] C4 搜索体验 —— **原描述也部分作废，先核实现状再动手**：「顶栏搜索」已不存在（`src/layouts/components/` 全目录无搜索，Header.vue 只剩 logo / 主题切换 / 用户菜单），真正还活着的搜索框只有机会池 `src/pages/funds/index.vue:96` 那一个，所以 C4 按这处落地。**修的是死胡同，不是“锦上添花”**：排行走东财 `FundMNRank` 且 `pageSize=80`（近 1 年收益降序），搜一个排在 80 名之外的基金只会得到一张空表 —— 既没建议、回车也没反应；表格内的筛选只能治「排 80 名以内」那半边。改为 `t-auto-complete` + 新增 `suggestFunds()`（`src/utils/fund-model.ts`，紧邻 `buyable`）查**全样本**（`fund-statistical.csv` 7249 只，615KB gzip，只在真按名称搜时才拉，`loadSample` 自带缓存所以一个会话最多一次）。选项用 `text=代码 / label="名称 · 代码 · 类型"`：AutoComplete 渲染 `label`、`@select` 回传 `text`（点选走 `title` 属性），所以不必从展示串里反解代码；6 位纯数字仍走原来的「回车直达详情」。两处刻意的宽松：① 6 位数字不出建议；② **不**按 `buyable` 过滤 —— 搜索是「找一只基金看」不是「选一只可买的」，把限购/暂停申购的挡在外面等于刚修的死胡同换个地方长出来（`scripts/check-fund.ts` 里用 `quota=100` 的 `限额混合` 锁住这条）。断言不只补了，还做了**变异测试**：去掉 6 位短路 / 忽略 limit / 误加限购过滤，三种变异全部被抓住
- [ ] D1 Key 迁移（10 分钟，VPS 操作）—— **原描述已过期，这里的钥匙不是 Wind 的**：Caddyfile 里唯一的 Bearer（第 87 行）位于 `handle /llm*` 段内，是**上游 LLM 网关（`172.17.0.1:8317`）的 key**，供 `src/utils/ocr-vision.ts:90`、`src/utils/source-health.ts:74,214`、`src/utils/briefing.ts:529` 的 `/llm/v1/*` 使用；Wind key 已随 `wind.ts` 一起消失，所以本项应叫「LLM Key 迁出 Caddyfile」。暴露面比原描述小：该路由带 `forward_auth invest-sync:3003 { uri /sync }`，未登录访问不到。迁移动作不变（改环境变量引用或独立 secrets 文件，防备份泄露）

### 不做（明确排除）

- ~~不引入后端服务/数据库~~ —— 已推翻：`scripts/sync-server.py` + SQLite 已上线（多账户跨设备同步）。「单人工具该保持低复杂度」这个判断仍然成立，但边界已从「纯 Caddy + localStorage」变成「Caddy + localStorage + 单文件同步服务」。
- 不做多用户/权限。
- 不把方法论页的静态研报改成 CMS。

## 四、验收口径

每批完成后：

1. `vue-tsc / eslint / stylelint / build` 全绿；
2. `npm run check:*` 全部通过（现有 14 个，新增逻辑必须带断言）;
3. `npm run build` 后按 DEPLOY.md 发布；
4. 线上冒烟：首页 200、/qt /em /sina /szse 四路 API、登录后驾驶舱数据渲染。
