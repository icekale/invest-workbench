# 优化方案与实施计划

> 2026-09-08 · 基于全量前后端代码审查与严格测试后制定。
> 现状基线：tsc / eslint / stylelint / build 全绿；check:quotes / fund / backup / book 四个自检脚本通过；线上 https://stock.053727.xyz 已部署本轮修复。

## 一、程序现状概述

四个一级模块（驾驶舱 / 研究 / 计划 / 复盘）+ 登录，单用户本地记账工作台。数据层全部在浏览器 localStorage（`invest-v2-*` 键族），行情走腾讯 `/qt`（新浪 `/sina` 兜底），公募数据走东财 `/em`，交易日历走深交所 `/szse`，宏观事件直连华尔街见闻（CORS 已开），产业风口直连选股宝，万得 EDB 经 Caddy 代理（**当前账户余额不足，全部降级**）。估值分位基于内置 10 年 PE/PB 分布参数 + 腾讯实时点位计算。

架构判断：单人工具，"后端"就是 Caddy 反代 + 前端内的领域逻辑（utils/），这个形态短期不需要变。

## 二、优化方案（按收益排序）

### 方向 A：数据真实性收口（收益最高）

本轮审查修复了三处「看起来有数据、实际是编造」的问题（估值历史随机数、降级假点位、万得失败假指标）。剩余同类问题与延伸动作：

| # | 事项 | 说明 |
|---|------|------|
| A1 | 万得充值或下线入口 | 账户余额不足，EDB 四大支柱/权威要闻长期「未接通」。二选一：充值激活；或把四大支柱改为接入免费源（国家统计局/中债官网 JSON），把 Wind 相关代码退役 |
| A2 | 组合净值曲线升级 | 现为「当前盈亏率的平滑示意」。真实化路径：每日收盘后（15:05）把总市值快照写入 localStorage（按日一条），积累后改画真实净值曲线；历史缺口用标注为示意的线补 |
| A3 | 估值历史真实化 | 用东财 datacenter 的指数估值历史接口（需新增 `/em-datacenter/` 代理路由）替换确定性模拟序列，弹窗去掉「示意」标注 |
| A4 | 手续费入账 | 交易执行 fee 固定为 0；台账已有 fee 字段与计算。在交易弹窗加可选手续费输入（默认按万 2.5 + 最低 5 元估算），买入计入成本、卖出计入已实现盈亏 |

### 方向 B：可靠性

| # | 事项 | 说明 |
|---|------|------|
| B1 | 上游偶发 502 重试 | 深交所/东财偶发连接 reset。Caddy 层给 `/szse`、`/em` 上游加 `health_uri` + 重试，或前端 fetch 封装统一一次重试 |
| B2 | localStorage 容量治理 | 万得缓存（6h TTL）、快照、流水逐年累积。加启动时清理：过期 wind-cache、上限条数（如流水 5000 条） |
| B3 | 快照自动备份 | 每周一把 snapshot 下载提示只弹一次；或导出自动触发。防 localStorage 被清（无痕模式/换机丢全部数据） |
| B4 | 时区统一回归 | 本轮已建 `todayCN()/formatCN()`。计划：全局替换残余 `toISOString().slice(0,10)`（grep 确认仅剩快照 at 字段属合理 UTC） |

### 方向 C：体验与一致性

| # | 事项 | 说明 |
|---|------|------|
| C1 | 移动端回归清单化 | 本轮修了研究/复盘/计划的错位。把「底栏导航、卡片头换行、列表上下排、表格横滑、44px 触点」沉淀为 checklist，新增页面自查 |
| C2 | 方法论图片懒加载 | 8 张 `methodology/*.png` 加 `loading="lazy"`，首屏少拉几 MB |
| C3 | 驾驶舱「记录一条」按钮语义 | 当前跳公募研究，名字含义模糊；改为直接打开机会池新增弹窗 |
| C4 | 搜索体验 | 顶栏搜索已支持代码直达；补名称模糊匹配下拉建议 |

### 方向 D：技术债

| # | 事项 | 说明 |
|---|------|------|
| D1 |Wind Key 管理 | Bearer Key 写在 VPS Caddyfile 里（未入仓）。建议改环境变量引用或独立 secrets 文件，避免备份泄露 |
| D2 | 测试补齐 | check 脚本已覆盖 book/ledger/valuation/日期。补 rebalance 的用例（注入资金、阈值触发、卖出上限）与 quote 解析的指数字段用例 |
| D3 | 依赖升级 | npm audit 有中危告警（构建链）；跑 `npm audit fix` 无破坏项 |

## 三、实施计划

### 第 1 批（1 次会话，本次已含一部分）
- [x] 时区统一：`todayCN()/formatCN()` 落地 store/ledger（已完成）
- [x] 估值历史确定性 + 弹窗「示意」标注（已完成）
- [x] ~~万得失败诚实展示 + 状态灯~~ —— 已作废：`src/utils/wind.ts` 在 8be8e39 删除，全库已无「万得」，此项失去对象
- [ ] 再平衡佣金最低 5 元 —— 未做。`src/utils/accounts.ts:58` 的 `feeOf` 是 `Math.max(0, amount * rateOf(...))`，下限 0，不是 5 元
- [x] A2 每日市值快照落库（`recordDailySnapshot()` 每次行情刷新同日覆盖；AccountPanel 有 ≥2 日快照自动切真实净值，否则回退示意）
- [x] C2 图片懒加载（已在迭代中落地）

### 第 2 批（1 次会话）
- [x] B1 fetch 封装重试 —— `src/utils/http.ts` 已接入 calendar / macro-cn / valuation / sw-valuation / briefs / briefing / quote / backup。后三处（`fetchQuotes` / `fetchSinaQuotes` / `fetchTradeMonth`）原来是裸 `fetch` + 自拼错误串，现已换成 `fetchOk` 并包 `withRetry`，重试覆盖到读响应体（连接重置常发生在 body 读到一半）。`scripts/check-quotes.ts` 有断言：502 重试一次后拿到数据、404 只试一次
- [x] B2 localStorage 清理 —— 只清真正无界增长的那一处：新增 `pruneBriefingCache()`，在 `writeCachedBriefing` 写入时清掉当日与昨日以外的晨会缓存。**保留昨日是必须的**：`src/pages/research/index.vue:158` 会读昨日那份取 `yesterdayStance` 喂给模型。**明确不做「流水 5000 条上限」**——流水是持仓与成本结转的唯一来源，截断等于改账，比配额溢出更糟。另两处无需处理：`val-history` 已有 `MAX_POINTS=60` 上限，市场缓存已搬服务端 `/sync/cache`
- [x] B3 快照周提醒（7 天未导出在驾驶舱提示一次；导出自动记录 lastBackupAt）
- [x] A4 交易手续费输入 —— 试算面板渲染出手续费，可手改并「恢复自动」；`effectiveFee` 同时驱动现金校验、加权成本与落库（`submitTrade` 显式传 `fee`，否则 store 会按费率重算）。**仍无最低 5 元下限**：`rateOf` 是纯比例，加下限会改掉成交价与成本，且与 `scripts/check-book.ts:57` 的 `tradeFee('stock', 10_000) === 0.8` 冲突，需单独拍板
- [ ] D2 rebalance 测试用例进 check-book —— 未做。所有 `scripts/check-*.ts` 中没有一处 rebalance

### 第 3 批（需用户决策后执行）
- [ ] A1 万得充值 vs 免费源替换（需要你定：充值可保留现 UI；换源则约一次会话工作量）
- [ ] A3 东财估值历史真实化（需在 VPS Caddyfile 加 `/em-datacenter/` 路由 + 一次会话改造）
- [ ] C3/C4 交互优化（半天）
- [ ] D1 Key 迁移（10 分钟，VPS 操作）

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
