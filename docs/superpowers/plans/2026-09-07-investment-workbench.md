# 个人投资研究工作台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于 TDesign Vue Next Starter 做出可登录的四页投资研究工作台：驾驶舱双账户、公募研究、计划与执行、持有与复盘；持仓为本地 mock，股票/ETF/指数现价走腾讯行情。

**Architecture:** 保留 Starter 的壳（布局、路由、登录、Pinia），砍掉示例页和异步菜单。业务数据集中在 `src/mock/invest.ts` + `src/store/modules/invest.ts`。行情只通过同源 `/qt` 代理访问 `qt.gtimg.cn`，解析与盈亏计算放 `src/utils/quote.ts`。规格要求第一期不引入测试框架，唯一自动检查是 `scripts/check-quotes.ts`（解析 + 盈亏）。

**Tech Stack:** Vue 3、Vite、Pinia、TypeScript、tdesign-vue-next、echarts（Starter 已有）。不新增依赖。

**Spec:** `docs/superpowers/specs/2026-09-07-investment-workbench-design.md`

---

## File map

| 路径 | 职责 |
|---|---|
| `src/utils/quote.ts` | 腾讯行情解析、批量拉取、持仓盈亏 |
| `scripts/check-quotes.ts` | 唯一自动检查：解析夹具 + 盈亏断言 |
| `src/types/invest.ts` | 持仓/基金/计划/论文类型 |
| `src/mock/invest.ts` | 全部第一期模拟数据 |
| `src/store/modules/user.ts` | 单用户登录（空 token 必须登录） |
| `src/store/modules/permission.ts` | 菜单只用静态四页，不请求后端菜单 |
| `src/store/modules/invest.ts` | 持仓+行情+备选池+待办+日志 |
| `src/router/modules/homepage.ts` | 四模块路由 |
| `src/router/index.ts` | `/` → `/dashboard` |
| `vite.config.ts` | `/qt` 代理到 `https://qt.gtimg.cn` |
| `src/style/invest.less` | 拾光气质：白底、大标题、圆角卡、红涨绿跌 |
| `src/pages/login/index.vue` | 只留账密登录，去注册 |
| `src/pages/dashboard/index.vue` | 驾驶舱 |
| `src/pages/dashboard/AccountPanel.vue` | 单账户板块 |
| `src/pages/funds/index.vue` | 公募研究三 Tab |
| `src/pages/funds/detail.vue` | 基金详情 |
| `src/pages/funds/compare.vue` | 对比 |
| `src/pages/plan/index.vue` | 计划与执行 |
| `src/pages/review/index.vue` | 持有与复盘 |

---

### Task 1: 接入 TDesign Vue Next Starter

**Files:**
- Create: 仓库根目录下的 Starter 骨架（勿覆盖 `docs/`）
- Modify: `.gitignore`（保留 `.superpowers/`）

- [ ] **Step 1: 克隆并同步骨架**

在仓库根目录执行（项目里已有 `docs/` 和 `.gitignore`，不要用空目录 degit）：

```bash
git clone --depth 1 https://github.com/Tencent/tdesign-vue-next-starter.git /tmp/tdesign-vue-next-starter
rsync -a --exclude .git --exclude docs /tmp/tdesign-vue-next-starter/ "/Users/kale/熊总基金ETF工作台/"
```

若 rsync 覆盖了 `.gitignore`，把下面两行加回去：

```
.superpowers/
```

确认 `docs/superpowers/specs/2026-09-07-investment-workbench-design.md` 仍在。

- [ ] **Step 2: 安装依赖**

```bash
cd "/Users/kale/熊总基金ETF工作台"
npm install
```

Expected: `node_modules/` 出现，无报错。

- [ ] **Step 3: 能跑起来**

```bash
npx vite --mode development --host 127.0.0.1 --port 3002
```

Expected: 终端无 compile error。浏览器打开 `http://127.0.0.1:3002` 能看到 Starter 登录或仪表盘（Starter 默认 `token: 'main_token'` 可能直接进后台）。Ctrl+C 停掉。

- [ ] **Step 4: Commit**

```bash
git add -A
git status
# 确认 docs/superpowers 未被删
git commit -m "chore: scaffold tdesign-vue-next-starter"
```

---

### Task 2: 行情解析与盈亏（唯一自动检查）

**Files:**
- Create: `src/utils/quote.ts`
- Create: `scripts/check-quotes.ts`
- Modify: `vite.config.ts`（加 `/qt` 代理）
- Modify: `src/types/env.d.ts`
- Modify: `package.json`（加 `check:quotes` 脚本）

- [ ] **Step 1: 写会失败的检查脚本**

创建 `scripts/check-quotes.ts`（此时还没有 `src/utils/quote.ts`，运行应失败）：

```ts
import assert from 'node:assert/strict';
import { calcHolding, parseTencentBody } from '../src/utils/quote.ts';

const fixture = `v_sz000001="51~平安银行~000001~10.00~9.00~9.50~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~20260907~1.00~11.11~0~0~0~0~0~0~0~0~0~0";`;

const map = parseTencentBody(fixture);
const q = map.get('sz000001');
assert.ok(q, 'missing sz000001');
assert.equal(q.name, '平安银行');
assert.equal(q.price, 10);
assert.equal(q.changePct, 11.11);

const row = calcHolding({ quantity: 1000, cost: 8 }, q);
assert.equal(row.marketValue, 10000);
assert.equal(row.pnl, 2000);
assert.equal(row.pnlPct, 0.25);

const dead = calcHolding({ quantity: 100, cost: 10 }, undefined);
assert.equal(dead.marketValue, null);
assert.equal(dead.pnl, null);

console.log('check-quotes ok');
```

- [ ] **Step 2: 跑检查，确认失败**

```bash
node --experimental-strip-types scripts/check-quotes.ts
```

Expected: `ERR_MODULE_NOT_FOUND` 或类似，因为 `src/utils/quote.ts` 不存在。

- [ ] **Step 3: 实现 `src/utils/quote.ts`**

```ts
export type Quote = {
  code: string;
  name: string;
  price: number;
  changePct: number;
};

export type HoldingInput = {
  quantity: number;
  cost: number;
};

export type HoldingNumbers = {
  marketValue: number | null;
  pnl: number | null;
  pnlPct: number | null;
};

export function parseTencentBody(text: string): Map<string, Quote> {
  const out = new Map<string, Quote>();
  for (const chunk of text.split(';')) {
    const m = chunk.match(/v_([a-z]{2}\d+)=["']([^"']*)["']/i);
    if (!m) continue;
    const fields = m[2].split('~');
    const price = Number(fields[3]);
    const changePct = Number(fields[32]);
    if (!Number.isFinite(price)) continue;
    out.set(m[1].toLowerCase(), {
      code: m[1].toLowerCase(),
      name: fields[1] || m[1],
      price,
      changePct: Number.isFinite(changePct) ? changePct : 0,
    });
  }
  return out;
}

export function calcHolding(h: HoldingInput, q: Quote | undefined): HoldingNumbers {
  if (!q || !Number.isFinite(q.price)) {
    return { marketValue: null, pnl: null, pnlPct: null };
  }
  const marketValue = q.price * h.quantity;
  const costValue = h.cost * h.quantity;
  const pnl = marketValue - costValue;
  const pnlPct = costValue === 0 ? null : pnl / costValue;
  return { marketValue, pnl, pnlPct };
}

export async function fetchQuotes(codes: string[]): Promise<Map<string, Quote>> {
  const uniq = [...new Set(codes.filter(Boolean))];
  if (!uniq.length) return new Map();
  const res = await fetch(`/qt/q=${uniq.join(',')}`);
  if (!res.ok) throw new Error(`quote http ${res.status}`);
  const text = new TextDecoder('gbk').decode(await res.arrayBuffer());
  return parseTencentBody(text);
}
```

- [ ] **Step 4: 再跑检查，确认通过**

```bash
node --experimental-strip-types scripts/check-quotes.ts
```

Expected: 打印 `check-quotes ok`，exit 0。

- [ ] **Step 5: Vite 代理 + env 类型 + npm script**

`vite.config.ts` 的 `server.proxy` 在现有 `[VITE_API_URL_PREFIX]` 旁加上：

```ts
'/qt': {
  target: 'https://qt.gtimg.cn',
  changeOrigin: true,
  rewrite: (p: string) => p.replace(/^\/qt/, ''),
},
```

`src/types/env.d.ts` 增加：

```ts
readonly VITE_AUTH_USER: string;
readonly VITE_AUTH_PASS: string;
```

`.env` 增加：

```
VITE_AUTH_USER = xiong
VITE_AUTH_PASS = demo
```

`package.json` scripts 增加：

```
"check:quotes": "node --experimental-strip-types scripts/check-quotes.ts"
```

- [ ] **Step 6: Commit**

```bash
git add src/utils/quote.ts scripts/check-quotes.ts vite.config.ts src/types/env.d.ts .env package.json
git commit -m "feat: parse tencent quotes and compute pnl"
```

---

### Task 3: 类型与模拟数据

**Files:**
- Create: `src/types/invest.ts`
- Create: `src/mock/invest.ts`

- [ ] **Step 1: 写类型**

```ts
export type AccountId = 'stock' | 'etf';
export type Health = 'healthy' | 'watch' | 'alert';
export type ActionPoint = 'hold' | 'add' | 'reduce' | 'exit';
export type ThesisStatus = 'valid' | 'watch' | 'invalid';
export type TradeSide = 'buy' | 'sell';
export type TodoStatus = 'open' | 'done';

export type Holding = {
  account: AccountId;
  code: string;
  name: string;
  quantity: number;
  cost: number;
  health: Health;
  action: ActionPoint;
  thesisId: string;
};

export type MacroNote = { id: string; title: string; body: string; date: string };

export type Fund = {
  code: string;
  name: string;
  manager: string;
  type: string;
  yield: number;
  vix: number;
  loss: number;
  score: number;
  star: number;
};

export type SmartPortfolio = {
  id: string;
  name: string;
  risk: string;
  blurb: string;
  funds: { code: string; weight: number }[];
};

export type PlanTarget = { code: string; account: AccountId; targetWeight: number };
export type TradeTodo = {
  id: string;
  account: AccountId;
  code: string;
  name: string;
  side: TradeSide;
  quantity: number;
  reason: string;
  status: TodoStatus;
};
export type DisciplineRule = { id: string; title: string; limit: number };

export type Thesis = {
  id: string;
  code: string;
  title: string;
  body: string;
  status: ThesisStatus;
};
export type JournalEntry = { id: string; date: string; body: string };
```

- [ ] **Step 2: 写 mock（真实 A 股/ETF 代码，方便行情）**

`src/mock/invest.ts` 必须导出：`holdings`、`macroNotes`、`opportunity`、`funds`、`smartPortfolios`、`planTargets`、`tradeTodos`、`disciplineRules`、`theses`、`journal`、`indexes`。

```ts
import type {
  DisciplineRule,
  Fund,
  Holding,
  JournalEntry,
  MacroNote,
  PlanTarget,
  SmartPortfolio,
  Thesis,
  TradeTodo,
} from '@/types/invest';

export const indexes = ['sh000001', 'sz399001', 'sz399006', 'sh000300'] as const;

export const holdings: Holding[] = [
  { account: 'stock', code: 'sz000001', name: '平安银行', quantity: 2000, cost: 11.2, health: 'healthy', action: 'hold', thesisId: 't1' },
  { account: 'stock', code: 'sh600519', name: '贵州茅台', quantity: 50, cost: 1680, health: 'watch', action: 'hold', thesisId: 't2' },
  { account: 'stock', code: 'sz300750', name: '宁德时代', quantity: 200, cost: 198, health: 'healthy', action: 'add', thesisId: 't3' },
  { account: 'stock', code: 'sh600036', name: '招商银行', quantity: 800, cost: 36.5, health: 'healthy', action: 'hold', thesisId: 't4' },
  { account: 'stock', code: 'sh601318', name: '中国平安', quantity: 600, cost: 48, health: 'alert', action: 'reduce', thesisId: 't5' },
  { account: 'etf', code: 'sh510300', name: '沪深300ETF', quantity: 20000, cost: 3.85, health: 'healthy', action: 'hold', thesisId: 't6' },
  { account: 'etf', code: 'sh510500', name: '中证500ETF', quantity: 15000, cost: 5.62, health: 'healthy', action: 'add', thesisId: 't7' },
  { account: 'etf', code: 'sz159915', name: '创业板ETF', quantity: 10000, cost: 2.1, health: 'watch', action: 'hold', thesisId: 't8' },
  { account: 'etf', code: 'sh513100', name: '纳指ETF', quantity: 8000, cost: 1.35, health: 'watch', action: 'reduce', thesisId: 't9' },
  { account: 'etf', code: 'sh511010', name: '国债ETF', quantity: 5000, cost: 138, health: 'healthy', action: 'hold', thesisId: 't10' },
];

export const macroNotes: MacroNote[] = [
  { id: 'm1', date: '2026-09-07', title: '利率观察', body: '资金面平稳，十年期国债收益率窄幅波动。模拟简报。' },
  { id: 'm2', date: '2026-09-07', title: '汇率', body: '美元兑人民币中间价小幅波动。模拟简报。' },
  { id: 'm3', date: '2026-09-06', title: '指数', body: '两市成交额回升，成长风格占优。模拟简报。' },
];

export const funds: Fund[] = [
  { code: '110011', name: '易方达中小盘', manager: '张坤', type: '偏股', yield: 18.5, vix: 1.32, loss: -22.4, score: 86, star: 5 },
  { code: '005827', name: '易方达蓝筹精选', manager: '张坤', type: '偏股', yield: 15.2, vix: 1.28, loss: -19.1, score: 84, star: 5 },
  { code: '161725', name: '招商中证白酒', manager: '侯昊', type: '指数', yield: 12.1, vix: 1.55, loss: -28.0, score: 72, star: 4 },
  { code: '000001', name: '华夏成长', manager: '王泽实', type: '偏股', yield: 8.4, vix: 1.1, loss: -16.2, score: 68, star: 3 },
  { code: '003096', name: '中欧医疗健康', manager: '葛兰', type: '行业', yield: 6.2, vix: 1.7, loss: -31.5, score: 61, star: 3 },
  { code: '270002', name: '广发稳健增长', manager: '傅友兴', type: '混合', yield: 9.8, vix: 0.72, loss: -8.4, score: 80, star: 5 },
  { code: '000216', name: '易方达黄金ETF联接', manager: '纪玲', type: '商品', yield: 11.0, vix: 0.9, loss: -12.0, score: 74, star: 4 },
  { code: '001182', name: '易方达安心回馈', manager: '杨宗昌', type: '混合', yield: 7.1, vix: 0.55, loss: -6.2, score: 77, star: 4 },
  { code: '110003', name: '易方达上证50', manager: '余海燕', type: '指数', yield: 10.4, vix: 1.05, loss: -18.8, score: 73, star: 4 },
  { code: '163406', name: '兴全合润', manager: '谢治宇', type: '偏股', yield: 14.8, vix: 1.22, loss: -20.5, score: 82, star: 5 },
  { code: '260108', name: '景顺长城新兴成长', manager: '刘彦春', type: '偏股', yield: 13.0, vix: 1.4, loss: -24.0, score: 75, star: 4 },
  { code: '519736', name: '交银新成长', manager: '王崇', type: '偏股', yield: 11.6, vix: 1.18, loss: -17.7, score: 79, star: 4 },
  { code: '000008', name: '嘉实中证500', manager: '何如', type: '指数', yield: 9.2, vix: 1.35, loss: -25.1, score: 66, star: 3 },
  { code: '001051', name: '华夏上证50ETF联接', manager: '荣膺', type: '指数', yield: 10.1, vix: 1.02, loss: -18.0, score: 71, star: 4 },
  { code: '002190', name: '农银新能源主题', manager: '赵诣', type: '行业', yield: 16.4, vix: 1.8, loss: -33.0, score: 70, star: 4 },
  { code: '450009', name: '国富中小盘', manager: '赵晓东', type: '偏股', yield: 12.7, vix: 1.25, loss: -21.3, score: 76, star: 4 },
  { code: '519002', name: '华安安信消费', manager: '胡宜斌', type: '行业', yield: 8.8, vix: 1.15, loss: -19.9, score: 69, star: 3 },
  { code: '000083', name: '汇添富消费行业', manager: '胡昕炜', type: '行业', yield: 10.9, vix: 1.2, loss: -20.1, score: 78, star: 5 },
  { code: '001938', name: '中欧时代先锋', manager: '周应波', type: '偏股', yield: 13.5, vix: 1.3, loss: -23.2, score: 81, star: 5 },
  { code: '070013', name: '嘉实研究阿尔法', manager: '归凯', type: '偏股', yield: 12.2, vix: 1.16, loss: -18.6, score: 80, star: 5 },
  { code: '519674', name: '银河创新成长', manager: '郑巍山', type: '偏股', yield: 15.9, vix: 1.62, loss: -29.4, score: 67, star: 3 },
  { code: '000248', name: '汇添富中证主要消费ETF联接', manager: '过蓓蓓', type: '指数', yield: 9.5, vix: 1.08, loss: -16.5, score: 72, star: 4 },
  { code: '001717', name: '工银瑞信文体产业', manager: '袁文博', type: '行业', yield: 7.6, vix: 1.21, loss: -22.0, score: 64, star: 3 },
  { code: '519772', name: '交银阿尔法核心', manager: '何帅', type: '偏股', yield: 11.3, vix: 1.09, loss: -17.0, score: 77, star: 4 },
];

export const opportunity = funds.slice(0, 10);

export const smartPortfolios: SmartPortfolio[] = [
  { id: 'p1', name: '安心货基', risk: '低', blurb: '以货币基金为主，适合闲钱。', funds: [{ code: '000216', weight: 0.4 }, { code: '001182', weight: 0.6 }] },
  { id: 'p2', name: '安稳长债', risk: '中低', blurb: '债券为主，回撤可控。', funds: [{ code: '001182', weight: 0.7 }, { code: '270002', weight: 0.3 }] },
  { id: 'p3', name: '均衡成长', risk: '中', blurb: '股债搭配，兼顾稳健与增值。', funds: [{ code: '270002', weight: 0.4 }, { code: '110011', weight: 0.3 }, { code: '163406', weight: 0.3 }] },
  { id: 'p4', name: '进取灵活', risk: '中高', blurb: '权益仓位更高。', funds: [{ code: '110011', weight: 0.4 }, { code: '163406', weight: 0.3 }, { code: '001938', weight: 0.3 }] },
  { id: 'p5', name: '卓越回报', risk: '高', blurb: '高仓位股票布局。', funds: [{ code: '005827', weight: 0.4 }, { code: '002190', weight: 0.3 }, { code: '519674', weight: 0.3 }] },
];

export const planTargets: PlanTarget[] = [
  { account: 'etf', code: 'sh510300', targetWeight: 0.4 },
  { account: 'etf', code: 'sh510500', targetWeight: 0.25 },
  { account: 'etf', code: 'sz159915', targetWeight: 0.15 },
  { account: 'etf', code: 'sh513100', targetWeight: 0.1 },
  { account: 'etf', code: 'sh511010', targetWeight: 0.1 },
];

export const tradeTodos: TradeTodo[] = [
  { id: 'td1', account: 'stock', code: 'sz300750', name: '宁德时代', side: 'buy', quantity: 100, reason: '论文仍成立，回撤加仓', status: 'open' },
  { id: 'td2', account: 'etf', code: 'sh513100', name: '纳指ETF', side: 'sell', quantity: 2000, reason: '卫星仓超配', status: 'open' },
  { id: 'td3', account: 'stock', code: 'sh601318', name: '中国平安', side: 'sell', quantity: 200, reason: '健康度预警', status: 'open' },
];

export const disciplineRules: DisciplineRule[] = [
  { id: 'd1', title: '单票市值不超过该账户 25%', limit: 0.25 },
  { id: 'd2', title: '买入必须出现在待办买卖', limit: 1 },
];

export const theses: Thesis[] = [
  { id: 't1', code: 'sz000001', title: '零售银行修复', body: '息差见底，资产质量稳定。', status: 'valid' },
  { id: 't2', code: 'sh600519', title: '高端消费品牌', body: '批次价承压，观察动销。', status: 'watch' },
  { id: 't3', code: 'sz300750', title: '全球储能+车', body: '出货与价格周期向上。', status: 'valid' },
  { id: 't4', code: 'sh600036', title: '零售银行优质资产', body: 'ROA 稳定。', status: 'valid' },
  { id: 't5', code: 'sh601318', title: '综合金融', body: '负债端改善慢于预期。', status: 'invalid' },
  { id: 't6', code: 'sh510300', title: 'A 股底仓', body: 'Beta 仓，不择时。', status: 'valid' },
  { id: 't7', code: 'sh510500', title: '中盘均衡', body: '相对沪深300的风格平衡。', status: 'valid' },
  { id: 't8', code: 'sz159915', title: '成长暴露', body: '估值仍偏贵，观察。', status: 'watch' },
  { id: 't9', code: 'sh513100', title: '海外科技卫星', body: '超配，准备降到 10%。', status: 'watch' },
  { id: 't10', code: 'sh511010', title: '利率债压舱', body: '组合波动缓冲。', status: 'valid' },
];

export const journal: JournalEntry[] = [
  { id: 'j1', date: '2026-09-05', body: '加了宁德时代计划，未执行。' },
  { id: 'j2', date: '2026-09-01', body: 'ETF 再平衡：纳指略超配。' },
];
```

- [ ] **Step 3: Commit**

```bash
git add src/types/invest.ts src/mock/invest.ts
git commit -m "feat: add invest types and mock data"
```

---

### Task 4: 单用户登录 + 静态四页菜单

**Files:**
- Modify: `src/store/modules/user.ts`
- Modify: `src/store/modules/permission.ts`
- Modify: `src/pages/login/index.vue`
- Modify: `src/pages/login/components/Login.vue`
- Modify: `src/locales/lang/zh_CN.json`（`common.appName`、`common.copyright`）
- Modify: `src/router/index.ts`
- Modify: `src/router/modules/homepage.ts`

- [ ] **Step 1: 默认未登录**

`src/store/modules/user.ts`：

- `state.token` 初始值改成 `''`（不要 `'main_token'`）。
- `login` 里用环境变量校验：

```ts
async login(userInfo: Record<string, unknown>) {
  const account = String(userInfo.account || '');
  const password = String(userInfo.password || '');
  const user = import.meta.env.VITE_AUTH_USER || 'xiong';
  const pass = import.meta.env.VITE_AUTH_PASS || 'demo';
  if (account !== user || password !== pass) {
    throw { code: 401, message: t('pages.login.validation.passwordError') };
  }
  this.token = 'main_token';
},
async getUserInfo() {
  this.userInfo = { name: '熊总', roles: ['all'] };
},
```

- [ ] **Step 2: 菜单不请求后端**

`src/store/modules/permission.ts` 的 `initRoutes` / `buildAsyncRoutes` 改成：

```ts
async initRoutes() {
  this.routers = cloneDeep([...homepageRouterList]);
},
async buildAsyncRoutes() {
  this.asyncRoutes = [{ path: '/__ready', name: 'AsyncReady', meta: { hidden: true } }] as unknown as RouteRecordRaw[];
  await this.initRoutes();
  return [];
},
```

删掉对 `getMenuList` 的依赖（可留 import 不调用，或删 import）。目的：`asyncRoutes.length > 0`，路由守卫不死循环；侧栏只有 `homepageRouterList`。

- [ ] **Step 3: 四条业务路由**

替换 `src/router/modules/homepage.ts` 为：

```ts
import { ChartIcon, EditIcon, PreciseMonitorIcon, SearchIcon } from 'tdesign-icons-vue-next';
import { shallowRef } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

import { LAYOUT } from '@/utils/route/constant';

export default [
  {
    path: '/dashboard',
    component: LAYOUT,
    name: 'dashboard',
    redirect: '/dashboard/index',
    meta: {
      title: { zh_CN: '投资驾驶舱', en_US: 'Cockpit' },
      icon: shallowRef(PreciseMonitorIcon),
      orderNo: 0,
      single: true,
    },
    children: [
      {
        path: 'index',
        name: 'DashboardIndex',
        component: () => import('@/pages/dashboard/index.vue'),
        meta: { title: { zh_CN: '投资驾驶舱', en_US: 'Cockpit' } },
      },
    ],
  },
  {
    path: '/funds',
    component: LAYOUT,
    name: 'funds',
    redirect: '/funds/index',
    meta: {
      title: { zh_CN: '公募研究', en_US: 'Funds' },
      icon: shallowRef(SearchIcon),
      orderNo: 1,
      single: true,
    },
    children: [
      {
        path: 'index',
        name: 'FundsIndex',
        component: () => import('@/pages/funds/index.vue'),
        meta: { title: { zh_CN: '公募研究', en_US: 'Funds' } },
      },
      {
        path: 'detail/:code',
        name: 'FundsDetail',
        component: () => import('@/pages/funds/detail.vue'),
        meta: { title: { zh_CN: '基金详情', en_US: 'Fund' }, hidden: true },
      },
      {
        path: 'compare',
        name: 'FundsCompare',
        component: () => import('@/pages/funds/compare.vue'),
        meta: { title: { zh_CN: '基金对比', en_US: 'Compare' }, hidden: true },
      },
    ],
  },
  {
    path: '/plan',
    component: LAYOUT,
    name: 'plan',
    redirect: '/plan/index',
    meta: {
      title: { zh_CN: '计划与执行', en_US: 'Plan' },
      icon: shallowRef(EditIcon),
      orderNo: 2,
      single: true,
    },
    children: [
      {
        path: 'index',
        name: 'PlanIndex',
        component: () => import('@/pages/plan/index.vue'),
        meta: { title: { zh_CN: '计划与执行', en_US: 'Plan' } },
      },
    ],
  },
  {
    path: '/review',
    component: LAYOUT,
    name: 'review',
    redirect: '/review/index',
    meta: {
      title: { zh_CN: '持有与复盘', en_US: 'Review' },
      icon: shallowRef(ChartIcon),
      orderNo: 3,
      single: true,
    },
    children: [
      {
        path: 'index',
        name: 'ReviewIndex',
        component: () => import('@/pages/review/index.vue'),
        meta: { title: { zh_CN: '持有与复盘', en_US: 'Review' } },
      },
    ],
  },
] satisfies RouteRecordRaw[];
```

`src/router/index.ts` 把 `/` 的 redirect 从 `/dashboard/base` 改成 `/dashboard/index`。

- [ ] **Step 4: 登录页只留账密**

`src/pages/login/index.vue`：删掉注册切换（`type === 'register'` 整段、`Register` 组件、`switchType`）。标题走 i18n。

`zh_CN.json`：

```
"appName": "投资研究工作台",
"copyright": "个人使用"
```

`Login.vue`：去掉扫码/手机号切换；placeholder 改成 `xiong` / `demo`；`INITIAL_DATA.account = 'xiong'`。

- [ ] **Step 5: 先放空页，让路由能编过**

四个页面先用最小 SFC，后续任务再填：

```vue
<template>
  <div class="invest-page">
    <h1 class="invest-title">占位</h1>
  </div>
</template>
```

创建：

- `src/pages/dashboard/index.vue`
- `src/pages/funds/index.vue`
- `src/pages/funds/detail.vue`
- `src/pages/funds/compare.vue`
- `src/pages/plan/index.vue`
- `src/pages/review/index.vue`

- [ ] **Step 6: 验证登录门**

```bash
npx vite --mode development --host 127.0.0.1 --port 3002
```

Expected：无 token 打开任意页跳到 `/login`；`xiong` / `demo` 进入驾驶舱占位页；侧栏四项：投资驾驶舱 / 公募研究 / 计划与执行 / 持有与复盘。错密码有错误提示。

- [ ] **Step 7: Commit**

```bash
git add src/store/modules/user.ts src/store/modules/permission.ts src/pages/login src/locales/lang/zh_CN.json src/router src/pages/dashboard src/pages/funds src/pages/plan src/pages/review
git commit -m "feat: single-user login and four-module routes"
```

---

### Task 5: 拾光气质皮肤

**Files:**
- Create: `src/style/invest.less`
- Modify: `src/main.ts` 或 `src/App.vue`（引入皮肤）

- [ ] **Step 1: 写皮肤**

```less
.invest-page {
  padding: 8px 4px 32px;
  color: #111827;
}

.invest-title {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #111827;
}

.invest-sub {
  margin: 8px 0 20px;
  color: #6b7280;
  font-size: 14px;
}

.invest-card {
  background: #fff;
  border: 1px solid #f3f4f6;
  border-radius: 16px;
  padding: 16px 18px;
}

.invest-kpi {
  font-size: 22px;
  font-weight: 700;
}

.invest-up {
  color: #dc2626;
}

.invest-down {
  color: #16a34a;
}

.invest-muted {
  color: #9ca3af;
  font-size: 12px;
}

.invest-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

@media (max-width: 960px) {
  .invest-grid-2 {
    grid-template-columns: 1fr;
  }
}
```

在 `src/main.ts` 现有 style import 后加：

```ts
import '@/style/invest.less';
```

- [ ] **Step 2: Commit**

```bash
git add src/style/invest.less src/main.ts
git commit -m "style: sglcai-like content skin"
```

---

### Task 6: Invest store（持仓 + 行情 + 本地可写状态）

**Files:**
- Create: `src/store/modules/invest.ts`
- Modify: `src/store/index.ts`（若需导出）

- [ ] **Step 1: 实现 store**

```ts
import { defineStore } from 'pinia';

import {
  disciplineRules,
  holdings as seedHoldings,
  indexes,
  journal as seedJournal,
  theses as seedTheses,
  tradeTodos as seedTodos,
} from '@/mock/invest';
import type { JournalEntry, Thesis, ThesisStatus, TodoStatus, TradeTodo } from '@/types/invest';
import { calcHolding, fetchQuotes, type Quote } from '@/utils/quote';

const LS_TODO = 'invest-todos';
const LS_WATCH = 'invest-watch';
const LS_JOURNAL = 'invest-journal';
const LS_THESIS = 'invest-theses';

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const useInvestStore = defineStore('invest', {
  state: () => ({
    quotes: {} as Record<string, Quote>,
    quoteError: '' as string,
    quoteLoading: false,
    todos: readLS<TradeTodo[]>(LS_TODO, seedTodos),
    watchlist: readLS<string[]>(LS_WATCH, []),
    journal: readLS<JournalEntry[]>(LS_JOURNAL, seedJournal),
    theses: readLS<Thesis[]>(LS_THESIS, seedTheses),
  }),
  getters: {
    enriched: (state) =>
      seedHoldings.map((h) => {
        const q = state.quotes[h.code];
        return { ...h, last: q?.price ?? null, changePct: q?.changePct ?? null, ...calcHolding(h, q) };
      }),
    stockRows(): ReturnType<typeof this.enriched> {
      return this.enriched.filter((h) => h.account === 'stock');
    },
    etfRows(): ReturnType<typeof this.enriched> {
      return this.enriched.filter((h) => h.account === 'etf');
    },
  },
  actions: {
    async refreshQuotes() {
      this.quoteLoading = true;
      this.quoteError = '';
      const codes = [...new Set([...seedHoldings.map((h) => h.code), ...indexes])];
      try {
        const map = await fetchQuotes(codes);
        const next: Record<string, Quote> = {};
        map.forEach((q, k) => {
          next[k] = q;
        });
        this.quotes = next;
        if (!map.size) this.quoteError = '行情暂不可用';
      } catch (e) {
        this.quoteError = e instanceof Error ? e.message : '行情暂不可用';
      } finally {
        this.quoteLoading = false;
      }
    },
    setTodoStatus(id: string, status: TodoStatus) {
      this.todos = this.todos.map((t) => (t.id === id ? { ...t, status } : t));
      localStorage.setItem(LS_TODO, JSON.stringify(this.todos));
    },
    toggleWatch(code: string) {
      this.watchlist = this.watchlist.includes(code)
        ? this.watchlist.filter((c) => c !== code)
        : [...this.watchlist, code];
      localStorage.setItem(LS_WATCH, JSON.stringify(this.watchlist));
    },
    setThesisStatus(id: string, status: ThesisStatus) {
      this.theses = this.theses.map((t) => (t.id === id ? { ...t, status } : t));
      localStorage.setItem(LS_THESIS, JSON.stringify(this.theses));
    },
    addJournal(body: string) {
      const entry: JournalEntry = {
        id: `j${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        body,
      };
      this.journal = [entry, ...this.journal];
      localStorage.setItem(LS_JOURNAL, JSON.stringify(this.journal));
    },
  },
});

export { disciplineRules };
```

`src/store/index.ts` 若有统一 export，补上 `export * from './modules/invest'`。没有就页面直接 `@/store/modules/invest`。

Getter 里 `this.enriched` 若 Pinia 对嵌套 getter 类型报错，改成在 `stockRows`/`etfRows` 里直接 filter `seedHoldings` 映射，不要用 `typeof this.enriched`。以能 `vue-tsc` 过为准。

- [ ] **Step 2: Commit**

```bash
git add src/store/modules/invest.ts src/store/index.ts
git commit -m "feat: invest store with quotes and local persistence"
```

---

### Task 7: 驾驶舱页面

**Files:**
- Create: `src/pages/dashboard/AccountPanel.vue`
- Modify: `src/pages/dashboard/index.vue`

- [ ] **Step 1: AccountPanel**

```vue
<template>
  <section class="invest-card">
    <div class="invest-muted">{{ title }}</div>
    <div class="invest-grid-2" style="margin: 12px 0">
      <div>
        <div class="invest-muted">持仓成本</div>
        <div class="invest-kpi">{{ money(costValue) }}</div>
      </div>
      <div>
        <div class="invest-muted">持仓市值</div>
        <div class="invest-kpi">{{ money(marketValue) }}</div>
      </div>
      <div>
        <div class="invest-muted">浮动盈亏</div>
        <div class="invest-kpi" :class="pnlClass(pnl)">{{ money(pnl) }}</div>
      </div>
    </div>
    <div ref="chartEl" style="height: 160px" />
    <t-table :data="rows" :columns="columns" row-key="code" size="small" stripe />
  </section>
</template>

<script setup lang="ts">
import { PieChart } from 'echarts/charts';
import { LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

echarts.use([PieChart, TooltipComponent, LegendComponent, CanvasRenderer]);

type Row = {
  code: string;
  name: string;
  quantity: number;
  cost: number;
  last: number | null;
  marketValue: number | null;
  pnl: number | null;
  pnlPct: number | null;
  health: string;
  action: string;
};

const props = defineProps<{ title: string; rows: Row[] }>();
const router = useRouter();
const chartEl = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

const healthMap: Record<string, string> = { healthy: '健康', watch: '观察', alert: '预警' };
const actionMap: Record<string, string> = { hold: '持有', add: '可加', reduce: '减仓', exit: '退出' };

const money = (n: number | null) => (n == null ? '—' : n.toLocaleString('zh-CN', { maximumFractionDigits: 0 }));
const pnlClass = (n: number | null) => (n == null ? '' : n >= 0 ? 'invest-up' : 'invest-down');

const costValue = computed(() => props.rows.reduce((s, r) => s + r.cost * r.quantity, 0));
const marketValue = computed(() =>
  props.rows.every((r) => r.marketValue == null) ? null : props.rows.reduce((s, r) => s + (r.marketValue ?? 0), 0),
);
const pnl = computed(() => (marketValue.value == null ? null : marketValue.value - costValue.value));

const columns = [
  { colKey: 'name', title: '名称', cell: (_h: unknown, { row }: { row: Row }) => `${row.name} ${row.code}` },
  { colKey: 'quantity', title: '数量' },
  { colKey: 'cost', title: '成本' },
  { colKey: 'last', title: '现价', cell: (_h: unknown, { row }: { row: Row }) => (row.last == null ? '—' : row.last) },
  { colKey: 'marketValue', title: '市值', cell: (_h: unknown, { row }: { row: Row }) => money(row.marketValue) },
  {
    colKey: 'pnl',
    title: '盈亏',
    cell: (_h: unknown, { row }: { row: Row }) => money(row.pnl),
  },
  { colKey: 'health', title: '健康度', cell: (_h: unknown, { row }: { row: Row }) => healthMap[row.health] },
  { colKey: 'action', title: '买卖点', cell: (_h: unknown, { row }: { row: Row }) => actionMap[row.action] },
];

function renderChart() {
  if (!chartEl.value) return;
  if (!chart) chart = echarts.init(chartEl.value);
  chart.setOption({
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        data: props.rows.map((r) => ({
          name: r.name,
          value: r.marketValue ?? r.cost * r.quantity,
        })),
      },
    ],
  });
}

onMounted(renderChart);
watch(() => props.rows, renderChart, { deep: true });
onUnmounted(() => chart?.dispose());
</script>
```

（AccountPanel 里 `useRouter` 若未用到就删掉，避免 lint。）

- [ ] **Step 2: 驾驶舱首页**

`src/pages/dashboard/index.vue`：

```vue
<template>
  <div class="invest-page">
    <h1 class="invest-title">投资驾驶舱</h1>
    <p class="invest-sub">
      股票与 ETF 同一套指标。现价来自腾讯行情。
      <t-button size="small" variant="outline" :loading="invest.quoteLoading" @click="invest.refreshQuotes()">
        刷新行情
      </t-button>
      <span v-if="invest.quoteError" class="invest-muted"> {{ invest.quoteError }}</span>
    </p>

    <div class="invest-card" style="margin-bottom: 12px">
      <div class="invest-grid-2">
        <div>
          <div class="invest-muted">两账户成本</div>
          <div class="invest-kpi">{{ money(totalCost) }}</div>
        </div>
        <div>
          <div class="invest-muted">两账户市值</div>
          <div class="invest-kpi">{{ money(totalMv) }}</div>
        </div>
        <div>
          <div class="invest-muted">浮动盈亏</div>
          <div class="invest-kpi" :class="pnlClass(totalPnl)">{{ money(totalPnl) }}</div>
        </div>
      </div>
    </div>

    <div class="invest-grid-2" style="margin-bottom: 12px">
      <AccountPanel title="股票账户" :rows="invest.stockRows" />
      <AccountPanel title="ETF 账户" :rows="invest.etfRows" />
    </div>

    <div class="invest-grid-2">
      <section class="invest-card">
        <div class="invest-muted">每日宏观</div>
        <div v-for="code in indexes" :key="code" style="margin-top: 8px">
          <strong>{{ invest.quotes[code]?.name || code }}</strong>
          <span :class="pnlClass(invest.quotes[code]?.changePct ?? null)">
            {{ invest.quotes[code] ? invest.quotes[code].price : '—' }}
            {{ invest.quotes[code] ? `${invest.quotes[code].changePct}%` : '' }}
          </span>
        </div>
        <p v-for="n in macroNotes" :key="n.id" class="invest-sub">{{ n.date }} · {{ n.title }} — {{ n.body }}</p>
      </section>
      <section class="invest-card">
        <div class="invest-muted">机会池</div>
        <t-table :data="opportunity" :columns="opCols" row-key="code" size="small" @row-click="goFund" />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';

import AccountPanel from './AccountPanel.vue';
import { indexes, macroNotes, opportunity } from '@/mock/invest';
import { useInvestStore } from '@/store/modules/invest';

const invest = useInvestStore();
const router = useRouter();
onMounted(() => invest.refreshQuotes());

const money = (n: number | null) => (n == null ? '—' : n.toLocaleString('zh-CN', { maximumFractionDigits: 0 }));
const pnlClass = (n: number | null) => (n == null ? '' : n >= 0 ? 'invest-up' : 'invest-down');

const totalCost = computed(() => invest.enriched.reduce((s, r) => s + r.cost * r.quantity, 0));
const totalMv = computed(() =>
  invest.enriched.every((r) => r.marketValue == null) ? null : invest.enriched.reduce((s, r) => s + (r.marketValue ?? 0), 0),
);
const totalPnl = computed(() => (totalMv.value == null ? null : totalMv.value - totalCost.value));

const opCols = [
  { colKey: 'name', title: '基金' },
  { colKey: 'yield', title: '收益' },
  { colKey: 'vix', title: '波动' },
  { colKey: 'loss', title: '回撤' },
];

function goFund({ row }: { row: { code: string } }) {
  router.push(`/funds/detail/${row.code}`);
}
</script>
```

- [ ] **Step 3: 浏览器验收**

登录后驾驶舱：合计 KPI、左右两账户、宏观指数（有数字或 —）、机会池可点进详情路由。

- [ ] **Step 4: Commit**

```bash
git add src/pages/dashboard
git commit -m "feat: cockpit with dual accounts and live quotes"
```

---

### Task 8: 公募研究三 Tab + 详情 + 对比

**Files:**
- Modify: `src/pages/funds/index.vue`
- Modify: `src/pages/funds/detail.vue`
- Modify: `src/pages/funds/compare.vue`

- [ ] **Step 1: 列表页**

三个 Tab：`智能组合` / `优质精选` / `基金数据`。

- 智能组合：`smartPortfolios` 卡片，展示名称、风险、blurb、配比。
- 优质精选：`t-select` 类型、`t-input-number` 最低星级、回撤上限（`loss` 为负数，过滤 `loss >= -limit`）；卡片点进详情；按钮加入备选池。
- 基金数据：搜索 name/code/manager；表列收益/波动/回撤/评分，`t-table` 开启 sort；勾选最多 4 只，按钮去 `/funds/compare?codes=a,b`。

空态文案：`未找到匹配的基金` / `还没有备选基金`。

- [ ] **Step 2: 详情页**

`useRoute().params.code` 在 `funds` 里找。找不到显示「基金数据暂不可用」+ 返回。找到则展示名称、经理、类型、收益/波动/回撤/评分/星级。备选池按钮调用 `invest.toggleWatch(code)`。

场外基金不强制拉腾讯行情；有 mock 字段即可。

- [ ] **Step 3: 对比页**

`codes` query 拆成数组，过滤 `funds`。少于 2 只提示「请至少选择两只基金」。表：横向对比 yield/vix/loss/score/star。

- [ ] **Step 4: 浏览器验收**

三个 Tab 能切；筛选立刻减少卡片；搜索可用；详情和对比打得开。

- [ ] **Step 5: Commit**

```bash
git add src/pages/funds
git commit -m "feat: public-fund research tabs, detail, compare"
```

实现时把完整 SFC 写入上述三个文件，不要留「占位」。精选筛选逻辑：

```ts
const filtered = computed(() =>
  funds.filter((f) => {
    if (type.value && f.type !== type.value) return false;
    if (f.star < minStar.value) return false;
    if (f.loss < -maxDrawdown.value) return false;
    return true;
  }),
);
```

搜索：

```ts
const q = keyword.value.trim();
funds.filter((f) => !q || `${f.code}${f.name}${f.manager}`.includes(q));
```

---

### Task 9: 计划与执行

**Files:**
- Modify: `src/pages/plan/index.vue`

- [ ] **Step 1: 三个区块写进同一页**

1. **调仓计划**：用 `planTargets` + `invest.etfRows`。当前权重 = 该代码市值 / ETF 账户市值（市值全是 null 则显示 —）。表列：代码、目标%、当前%、差。
2. **待办买卖**：`invest.todos` 表格；操作列按钮把 `open` ↔ `done`（`setTodoStatus`）。
3. **纪律检查**：对每条 `disciplineRules`：单票市值 / 该账户市值 > `limit` 则失败；「买入必须在待办」只展示说明（第一期不做交易录入）。用 `t-tag` 成功/失败。

- [ ] **Step 2: 浏览器验收**

能勾待办；超配规则对 mock 持仓能算出至少一条通过或失败。

- [ ] **Step 3: Commit**

```bash
git add src/pages/plan/index.vue
git commit -m "feat: plan, todos, and discipline checks"
```

---

### Task 10: 持有与复盘

**Files:**
- Modify: `src/pages/review/index.vue`

- [ ] **Step 1: 三个区块**

1. **投资组合**：两账户市值占比条 + 盈亏贡献表（用 `invest.enriched`）。
2. **论文追踪**：`invest.theses` 列表，`t-select` 改状态 `valid|watch|invalid` → `setThesisStatus`。
3. **复盘日志**：列表 + 一个 `t-textarea` 和「记下」调用 `addJournal`。空态：「还没有复盘记录」。

- [ ] **Step 2: 浏览器验收**

改论文状态、新增日志，刷新后 localStorage 仍在。

- [ ] **Step 3: Commit**

```bash
git add src/pages/review/index.vue
git commit -m "feat: portfolio review, theses, and journal"
```

---

### Task 11: 收尾验收

**Files:**
- Modify: 仅修复本轮发现的问题
- Create: `README.md`（覆盖 Starter README）

- [ ] **Step 1: 跑自动检查**

```bash
npm run check:quotes
```

Expected: `check-quotes ok`

- [ ] **Step 2: 类型**

```bash
npx vue-tsc --noEmit
```

Expected: exit 0。若 Starter 原有报错与本次无关，只修本次文件。

- [ ] **Step 3: 手验清单（规格成功标准）**

1. `xiong` / `demo` 能登录，错密码不能进
2. 四页侧栏都能开
3. 驾驶舱股票/ETF 并排、同一套指标
4. 公募研究三 Tab、详情、对比
5. 持仓现价有数字或「—」，失败有短提示
6. 内容区是白底圆角卡，不是 Starter 示例仪表盘

- [ ] **Step 4: README**

写清：

```
npm install
npm run dev
# 账号 xiong / demo
npm run check:quotes
```

生产 VPS 需要 nginx：

```
location /qt/ {
  proxy_pass https://qt.gtimg.cn/;
}
```

前端只请求同源 `/qt/q=sz000001,sh510300`。

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: how to run the invest workbench"
```

---

## Self-review vs spec

| 规格 | 任务 |
|---|---|
| TDesign Vue Next 壳 | Task 1 |
| 拾光皮肤 | Task 5 |
| 单用户登录、无注册权限 | Task 4 |
| 驾驶舱合计 + 双账户同指标 + 宏观 + 机会池 | Task 7 |
| 公募研究三 Tab / 详情 / 对比 / 备选池 | Task 8 |
| 计划、待办、纪律 | Task 9 |
| 组合、论文、日志 | Task 10 |
| 腾讯行情 + 失败态 | Task 2、6、7 |
| 持仓 mock、不接券商 | Task 3 |
| 唯一检查、无测试框架 | Task 2、11 |
| VPS 代理说明 | Task 11 |

未做（规格明确不做）：券商同步、真实量化模型、多用户、持仓编辑器、WebSocket 行情。
