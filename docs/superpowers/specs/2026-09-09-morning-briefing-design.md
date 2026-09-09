# 晨会研判 · 设计规格

日期：2026-09-09  
状态：待用户审阅后进入实现计划

## 1. 目标

每天第一次打开「研究与决策」时，用工作台里已经算好的事实，让模型写一份**晨会研判**，并给出 0–3 条待办草稿。人点确认后才写入现有待办。

成功标准：开盘前能用一段对照两账户仓位的结论，决定今天动哪几只；不是多一个聊天窗口。

## 2. 已锁定的决定

| 项 | 决定 |
|---|---|
| 岗位 | 晨会研判，不是单标的点评、不是对话框、不是周末复盘 |
| 权限 | 只出待办草稿；点「写入待办」才调用现成 `addTodo()` |
| 触发 | 每天第一次进入 `/research` 自动跑；当天成功结果缓存 |
| 材料 | 只用 Pinia 已有事实；不拉要闻正文、不搜网页 |
| 通道 | Caddy `/llm*` 反代到现成 `cli-proxy-api` / `grok-caddy`；密钥留在 VPS |
| 方案 | A：宏观定调顶上一张卡 |
| 账本 | 研判是派生结果，不进 `invest-sync` SQLite |

## 3. 明确不做

- 新页面、新侧栏、聊天/追问/流式打字
- 自动写入待办或论点、自动下单、改仓位
- 新后端进程、RAG、定时晨会任务
- 浏览器直连模型、Key 放前端
- 失败时编一段假研判

## 4. 架构

```
/research 当天第一次打开
        │
        ├─ localStorage 已有今日成功缓存 → 渲染卡片
        │
        └─ 否则
              ├─ 若行情刷新正在进行则等它结束（成功/失败都算；最多 8 秒）
              ├─ buildFactPack(Pinia)     只读
              ├─ POST /llm                同源，一次完整 JSON，不流式
              ├─ parseBriefing()          不合格整份作废
              ├─ 写入当日缓存
              └─ BriefingCard 渲染
                        │
                        └─ 「写入待办」→ addTodo()
```

密钥不出 VPS。浏览器只打 `https://stock.053727.xyz/llm/...`。

Caddy 增加 `handle /llm*`，反代到本机已在跑、且兼容 OpenAI `POST /v1/chat/completions` 的那个端口（实现时先探 `cli-proxy-api`，不通再探 `grok-caddy:8096`）。前端不写死上游主机名。

## 5. 组件

| 文件 | 职责 |
|---|---|
| `src/utils/briefing.ts` | 组事实包、请求、校验、按日缓存、冷却 |
| `src/pages/research/BriefingCard.vue` | 卡片 UI |
| `src/pages/research/index.vue` | 进入页面时触发一次 |
| `src/pages/research/MacroCompass.vue` | 在天气卡**上方**挂 `BriefingCard` |
| `src/types/invest.ts` | `DailyBriefing`、`BriefingTodoDraft` |
| VPS Caddyfile | `/llm*` 反代 |
| `scripts/check-briefing.ts` | 校验与缓存的自检 |

不改 `addTodo()` 签名。不把研判塞进 `MacroBrief` 列表，避免和华尔街见闻快讯混在一起。

设置页不加模型开关。模型名是 `briefing.ts` 里的一个常量，跟代理默认模型对齐；要对齐时改这一处。

## 6. 数据合同

日期一律北京自然日，用现成 `todayCN()`。

### 6.1 事实包（模型唯一输入）

超出条数从尾部丢掉，不附新闻正文、不附方法论、不附原始行情字符串。

```ts
interface BriefingFactPack {
  date: string; // todayCN()
  weather: { cycle: string; sentiment: string; suggestedStockPos: string; suggestedEtfPos: string };
  indicators: Array<{ name: string; value: string; status: string }>; // ≤4，四大支柱
  events: Array<{ date: string; title: string; level: string; impact: string }>; // 今日+明日，≤8
  valuation: Array<{ name: string; code: string; pe: number; percentile: number; advice: string }>; // ≤8，极端项优先
  accounts: Array<{
    id: 'stock' | 'etf';
    cash: number;
    marketValue: number;
    pnl: number;
    pnlPct: number;
    holdings: Array<{
      code: string;
      name: string;
      weight: number; // 占该账户市值，0–1
      pnlPct: number;
      health: string;
      action: string;
    }>; // 该账户全部持仓，单账户超过 20 只按 |pnlPct| 取前 20
  }>;
  openTodos: Array<{ name: string; code: string; side: string; reason: string }>; // ≤8
  alerts: Array<{ code: string; type: string; title: string; level: string }>; // ≤8
}
```

空仓也生成事实包，照样请求。

### 6.2 模型输出

```ts
type BriefingStance = '偏多' | '中性' | '谨慎' | '防守';

interface BriefingTodoDraft {
  account: 'stock' | 'etf';
  code: string;       // 必须出现在事实包 holdings/valuation/openTodos/alerts 的 code 集合里；没有标的则用 ""
  name: string;
  side: 'buy' | 'sell';
  quantity: number;   // 允许 0，表示只给方向
  reason: string;
}

interface DailyBriefing {
  date: string;       // 必须等于 todayCN()
  headline: string;   // 一行
  stance: BriefingStance;
  stockNote: string;
  etfNote: string;
  risks: string[];    // 0–3
  todos: BriefingTodoDraft[]; // 0–3
}
```

系统提示要点（写死在 `briefing.ts`，中文）：

- 只根据 JSON 事实包写研判，禁止使用训练记忆里的行情或新闻
- 数字必须来自事实包；没有就写「数据不足」，不许编
- `code` 不在事实包里 → 该条 todo 非法
- 只输出 JSON，不要 markdown

请求：一次 `chat/completions`，`temperature` 0.2，不流式。若代理支持 `response_format: json_object` 则打开。

### 6.3 校验（整份作废，不展示半成品）

任一则失败：

- 不是对象 / 缺字段 / `date !== todayCN()`
- `stance` 不在四档
- `risks.length > 3` 或 `todos.length > 3`
- todo 的 `account`/`side` 非法
- todo.`code` 非空且不在事实包 code 集合中
- `headline` 空

### 6.4 缓存

| 键 | 值 |
|---|---|
| `invest-briefing-YYYY-MM-DD` | 成功的 `DailyBriefing` JSON |
| `invest-briefing-fail-at` | 最近一次失败的 epoch ms |

成功缓存只认当天键；跨日自动失效（根本不会读昨天的键）。  
失败不写成功键。10 分钟内有失败记录且无成功缓存 → 不自动重打，卡片可手动重试。  
手动「重新生成」：删当天成功键后立刻请求（仍受进行中锁，不并行）。

研判不进 SQLite 账本，也不走 `/sync`。换机当天会再跑一次。

## 7. 界面

放在 `MacroCompass` 宏观周期天气卡上方，TDesign `t-card`，观澜 token，不另开皮肤。

成功态：

- 一行 `headline` + `stance` 标签（偏多红、防守绿、其余黄，跟天气卡同一套）
- 股票句、ETF 句
- 风险最多 3 条
- 每条草稿：账户、方向、名称/代码、理由、按钮「写入待办」
- 写入成功后该按钮变「已写入」并禁用
- 「重新生成」在卡片右上

失败/冷却/进行中：

- 进行中：卡片骨架或 loading，按钮禁用
- 失败：文案「今日研判未生成」+「重试」
- 不 toast 连环弹

「写入待办」：

```
addTodo({
  account, code, name, side,
  quantity: draft.quantity || 0,
  reason: draft.reason,
})
```

同一自然日已存在 `status=open` 且 `code+side` 相同的待办 → 跳过，按钮仍标「已写入」。

## 8. 触发与时序

入口：`src/pages/research/index.vue` 的 `onMounted`（不是切到宏观 tab 才跑）。

1. 若当天成功缓存存在 → 渲染，结束
2. 若 10 分钟冷却内 → 显示失败态，结束
3. 若 `invest.refreshQuotes` 正在进行，等它结束；否则不等。硬超时 8 秒
4. 组包、请求、校验、缓存、渲染

估值分位、宏观支柱用当时 Pinia 里的值，不再为研判单独打万得/东财。

## 9. 错误处理

| 情况 | 行为 |
|---|---|
| `/llm` 超时、401、502、网络错误 | 失败态；记 `fail-at` |
| JSON 解析失败或校验失败 | 同上，不展示模型原文 |
| 事实包几乎为空 | 仍请求；模型应写「数据不足」 |
| 代理没有 json_object | 仍用提示约束；靠校验兜底 |

## 10. 验收

`scripts/check-briefing.ts`（与现有 `check-book.ts` 同类，不接真模型）：

- 坏 JSON、错误日期、`todos>3`、未知 `code` → 校验拒绝
- `buildFactPack` 截断到上限，且序列化结果不含「http」新闻 URL、不含快讯正文
- 缓存键使用 `todayCN()` 格式

手动：研究页当天第一次打开出卡；刷新不再打 `/llm`；点写入后「研判待办」出现一条；失败时卡片诚实。

## 11. 实现时探路（不是开放需求）

上 VPS 确认 OpenAI 兼容入口的路径和鉴权头（Bearer 仍只写在 Caddyfile）。前端只假定：

`POST /llm/v1/chat/completions`，JSON body 与 OpenAI 相同。

若实际前缀不是 `/v1`，只改 Caddy rewrite，不改浏览器跨域策略。
