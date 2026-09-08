---
name: 熊总投资工作台
description: 观澜皮肤——墨绿金标侧栏，纸面卡片落在浅灰地面，tabular 数字是主角
colors:
  brand: "#0d706d"
  brand-hover: "#0b5f5c"
  brand-active: "#094e4c"
  brand-light: "#e7f4f2"
  page: "#f6f7f9"
  container: "#ffffff"
  surface-soft: "#f8fafb"
  text-primary: "#14212b"
  text-secondary: "#4f5d67"
  text-placeholder: "#5e6c76"
  border: "#e6eaed"
  stroke: "#e6eaed"
  sidebar: "#162a34"
  gold: "#dfb56d"
  gain: "#b8433e"
  loss: "#16815f"
  warning: "#b8782d"
  info: "#3569bb"
typography:
  display:
    fontFamily: "Microsoft YaHei, PingFang SC, Noto Sans SC, sans-serif"
    fontSize: "27px"
    fontWeight: 600
    lineHeight: "31px"
    letterSpacing: "-0.02em"
  hero:
    fontFamily: "Microsoft YaHei, PingFang SC, Noto Sans SC, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "32px"
    variant: "tabular-nums"
  headline:
    fontFamily: "Microsoft YaHei, PingFang SC, Noto Sans SC, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "32px"
  title:
    fontFamily: "Microsoft YaHei, PingFang SC, Noto Sans SC, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: "24px"
  body:
    fontFamily: "Microsoft YaHei, PingFang SC, Noto Sans SC, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "22px"
  label:
    fontFamily: "Microsoft YaHei, PingFang SC, Noto Sans SC, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "20px"
  code:
    fontFamily: "ui-monospace, Menlo, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "20px"
rounded:
  sm: "7px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  card: "10px"
  pill: "999px"
  scrollbar: "4px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.brand-hover}"
    textColor: "#ffffff"
  card-surface:
    backgroundColor: "{colors.container}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.card}"
    padding: "16px 24px"
    border: "1px solid {colors.border}"
    shadow: "0 8px 30px rgba(24, 40, 51, 0.05)"
  input:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    height: "32px"
---

# Design System: 熊总投资工作台

## Overview

**Creative North Star: 「观澜」（墨绿金标侧栏 × 纸面卡片）**

给一个人看两个账户的工作台。侧栏是夜色港湾（`#162a34` + 金标），内容是浅灰地面上的白卡片。打开仓位总览 = 看仓位结构，不是看仪表盘皮肤。组件只用 TDesign Vue Next；观澜是 token 与 chrome，不是第二套 UI。

**Key Characteristics:**
- 组件库：TDesign Vue Next，皮肤在 `src/style/guanlan.less`
- 侧栏 220px 夜色，当前项 `#24434b` + 3px 金嵌线 `#dfb56d`
- 品牌墨绿 `#0d706d` 只给可交互；金只给当前导航与品牌标
- 数字主角：市值/盈亏走 24px `.num-hero`、`tabular-nums`
- 涨红跌绿只出现在数字与 Tag（A 股习惯，红涨 `#b8433e` / 绿跌 `#16815f`）
- 卡片：10px 圆角 + `0 8px 30px rgba(24,40,51,.05)`，不是扁平发车板
- 一次入场：内容区 240ms 微升淡入（`prefers-reduced-motion` 时关闭）

## Colors

中性灰承担结构。墨绿做动作，金做当前位置，红绿只做涨跌。

### Primary
- **观澜绿** (`{colors.brand}` `#0d706d`): 主按钮、链接、选中控件。同一屏不要大面积墨绿底。

### Chrome
- **侧栏** (`{colors.sidebar}` `#162a34`): 夜色导航
- **金标** (`{colors.gold}` `#dfb56d`): 品牌方标、当前项左嵌线
- **信息蓝** (`{colors.info}` `#3569bb`): 偏离/信息芯片，不当品牌色

### Neutral
- **页面灰** (`{colors.page}` `#f6f7f9`)
- **容器白** (`{colors.container}`) / **软底** (`{colors.surface-soft}` `#f8fafb`)
- **主文** `#14212b` / **次文** `#4f5d67`（≥4.5:1）/ **占位** `#5e6c76`
- **描边** `#e6eaed`

### Semantic
- **涨 / 盈** (`{colors.gain}` `#b8433e`，白底约 5.4:1)
- **跌 / 亏** (`{colors.loss}` `#16815f`)
- **观察** (`{colors.warning}` `#b8782d`)

**The 10% Accent Rule.** 墨绿只出现在可交互的东西上。金只出现在侧栏当前位置。统计数字、卡片标题一律墨色。

## Typography

**Display / Body Font:** Microsoft YaHei, PingFang SC, Noto Sans SC
**Numeric:** 继承正文字体，强制 `tabular-nums`

### Hierarchy
- **Display** (600, 27px, -0.02em): 顶栏产品名
- **Hero** (600, 24/32, tabular): `.num-hero`
- **Title** (600, 15/24): 卡片标题
- **Body** (400, 14 / 1.55): 表格、列表
- **Label** (400, 12/20): 表头、侧栏分组、辅助说明；代码片段可用系统等宽（Menlo/Consolas），只用于公式与指标名

**The Paired Scale Rule.** 字号必须带对应行高。

## Layout

TDesign Starter 侧栏 + 顶栏。侧栏 220px，顶栏 64px。内容区内边距 22×24×28。桌面双栏（股票 | ETF），≤767px 单列：底栏四入口，顶栏汉堡打开侧栏抽屉，内容全宽。粗指针按钮高度 44px。

仓位总览阅读顺序：动作行 → 双账户总览带 → 两块持仓板 → 指数行 → 公募研究入口。

**The Band Rule.** 同一语义的数字排成一条带：两账户市值/盈亏/成本在同一张卡内左右两栏。

**Browser Surfaces.** 滚动条 8px、圆角 4px；文字选区用品牌浅青；`accent-color` 跟品牌色。

## Elevation & Depth

| 档 | 用法 | 实现 |
| --- | --- | --- |
| Paper | 页面卡片、表格、KPI | 1px `{colors.border}` + `{card.shadow}` |
| Raised | 可点卡片 hover | `--td-shadow-2` |
| Floating | 下拉、气泡 | `--td-shadow-2` |
| Overlay | 对话框、抽屉、Toast | `--td-shadow-3` + 遮罩 |

z-index 只允许 6 档：内容 0 · 悬停 10 · 下拉 20 · 顶栏/侧栏 40 · 弹窗 50 · Toast 60。

**The One Surface Rule.** 禁止卡片套卡片。

## Shapes

圆角三档：按钮 7px、输入/导航 8px、卡片 10px。Tag 走胶囊 999px。一个界面不超过这三种。

## Components

### Buttons
- **Primary:** 墨绿底白字，圆角 7px，一屏最多一个主按钮
- **Hover / Focus:** `--td-brand-color-hover` / `--td-brand-color-focus`

### Cards / Containers
- 白底、10px 圆角、浅阴影、1px `#e6eaed`
- Header 1px 下缘线；标题 Title 级

### Tables
- 表头 Label 级 400 次文色
- 全表 `tabular-nums`；涨红跌绿只上数字和 Tag

### 信号灯（健康度）
- 7px 圆点：绿=健康、黄=观察、红=预警
- 只出现在持仓名称前

### Navigation
- 侧栏夜色 + 观澜波澜天际线金标 + 分组小标
- 当前项深青底 + 金嵌线，不加蓝色高亮
- 顶栏：27px 产品名左、日期与搜索右；无页脚
- 手机：底栏四键（仓位 / 研究 / 复盘 / 账户），顶栏只留标题和头像；子页仍走页内跳转

## Do's and Don'ts

### Do:
- **Do** 用 TDesign 组件和 CSS 变量（观澜 token 已写入 `--td-*`）。
- **Do** 关键数字上 `.num-hero`（24px tabular）。
- **Do** 同一语义数字放进一条带。

### Don't:
- **Don't** 嵌套 `t-card`，或给每个 KPI 单独一张卡。
- **Don't** 用品牌绿表示涨跌，或给非交互文字上绿。
- **Don't** 再引入一套组件库，或把参考站的 React/lucide 搬进来。
- **Don't** 随手写 z-index 或纯黑大阴影。
- **Don't** 把涨跌幅传给 ×100 的百分比格式化函数——两类「百分比」单位不同（changePct 已是百分数，pnlPct 是小数比例）。
