/**
 * 持仓截图识别的解析与校验内核。
 *
 * 刻意做成纯函数：不碰 DOM、不发请求、不读 store。原因和 `position.ts` 一样 ——
 * 截图识别最容易错的不是「读图」，是「把读到的字切成对的行与列」，而这一层
 * 必须能用真实样本反复跑。所以 `scripts/check-ocr.ts` 直接喂 OCR 原文本进来断言，
 * 不需要起浏览器、不需要真图片。
 *
 * 分工：本文件只回答「这几行字是什么数字、可不可信」；
 * 取图与识别在 `ocr-local.ts` / `ocr-vision.ts`，落库在对话框里。
 *
 * ## 为什么列不靠位置猜
 *
 * 同花顺持仓页的列数会变（有的版本有「可用数量」，有的还有「参考市值」「盈亏比例」），
 * 所以「第 3 个数字是持仓数量」这种按位置写死的规则换个版本就串列 —— 串列不会报错，
 * 只会静默地把成本价当数量导入。这里改成用表头定列序：表头那行的字被 OCR 打散后
 * 仍然是**有序**的，按顺序在拼接串里找「代码 / 名称 / 持仓 / 可用 / 成本 / 现价 …」
 * 就能还原出列序，再把数据行的数字尾巴按同一个列序对齐。
 */
import type { Account, AccountId, Holding } from '@/types/invest';
import { normalizeForAccount } from '@/utils/quote';

/** OCR 读到的原始行。数字为 null 表示这一格没读出可信的数。 */
export interface OcrRawRow {
  /** 6 位代码原文，未归一化 */
  code: string;
  name: string;
  quantity: number | null;
  cost: number | null;
  /** 截图里的现价。**不导入** —— 现价永远以行情为准，它只用来和行情对账。 */
  price: number | null;
  /** 原始行文本，出问题时给用户看原文 */
  raw: string;
}

/** 列的种类。只保留到 `price` —— 后面的市值/盈亏/比例不导入，位置对不上也不影响结果。 */
type ColumnKind = 'code' | 'name' | 'qty' | 'avail' | 'cost' | 'price';

/**
 * 表头标记 → 列种类，**从左往右逐字匹配、取最长者**。
 *
 * 逐字扫描（而不是「每个标记各自找第一次出现」）是必须的：后者会打乱列序 ——
 * 表头是「持仓数量 可用数量」，而「可用」若先于「持仓数量」被匹配到，列序就成了
 * [可用, 持仓, …]，位置对齐时会把**可用数量当持仓数量**导入，且不报任何错。
 *
 * 取最长者是为了认合并列：「持仓/可用」在有的版本里是**一列**（值为持仓数量），
 * 长度 5 胜过「持仓」的 2，于是记成单个 qty 而不是 qty+avail。
 * 同理「盈亏比例」胜过「盈亏」。
 */
const HEADER_MARKS: Array<[RegExp, ColumnKind]> = [
  [/代码/, 'code'],
  [/名称|简称/, 'name'],
  // 合并列必须排在「持仓」「可用」前面，靠长度取胜
  [/持仓[／/、]?可用/, 'qty'],
  [/持仓数量|持股数量|持仓|持股|数量/, 'qty'],
  [/可用数量|可用/, 'avail'],
  [/成本价|成本/, 'cost'],
  [/现价|最新价|市价/, 'price'],
];

/** 表头行的特征：有「代码」或「名称」，且**没有** 6 位数字（数据行才有）。 */
function looksLikeHeader(line: string): boolean {
  return /代码|名称|成本|持仓/.test(line) && !/\d{6}/.test(line);
}

/**
 * 从表头还原列序。返回 null 表示这行不是可用的表头。
 *
 * OCR 会在汉字之间插空格（`证 券 代 码`），所以先把空白全去掉再扫 ——
 * 去空白不改变字的先后，这是这个办法能成立的前提。
 */
export function headerColumns(headerLine: string): ColumnKind[] | null {
  const flat = headerLine.replace(/\s+/g, '');
  if (!flat) return null;
  const cols: ColumnKind[] = [];
  let i = 0;
  while (i < flat.length) {
    let kind: ColumnKind | null = null;
    let len = 0;
    for (const [re, k] of HEADER_MARKS) {
      const m = re.exec(flat.slice(i));
      // anchored：只看当前位置，取最长匹配
      if (m && m.index === 0 && m[0].length > len) {
        kind = k;
        len = m[0].length;
      }
    }
    if (kind) {
      if (!cols.includes(kind)) cols.push(kind);
      i += len;
    } else {
      i += 1;
    }
  }
  // 认不出代码列就说明这不是持仓表头（可能是「成交明细」或别的页面）
  return cols.includes('code') && cols.includes('name') ? cols : null;
}

/**
 * 把一个 OCR 出来的词转成数字。
 *
 * 返回 `polluted` 而不是直接丢：`1480.50Q0` 这种「数字后面粘了脏字」在样本里真实出现过，
 * 前缀是对的，丢掉整格反而丢数据。但必须记下来 —— 用户看到这一格被标过，才会去核对。
 *
 * 反过来，**不猜**：`l480.500`（数字 1 被读成字母 l）在这里直接算不出数，返回 null。
 * 宁可让用户手填，也不能把 1480 悄悄变成 480。
 */
export function parseNumberToken(token: string): { value: number | null; polluted: boolean } {
  // 全角句点、千分位逗号先归位；再砍掉百分号及其后的东西（`2.93%6` 只留 2.93）
  let s = token.replace(/[。．]/g, '.').replace(/[,，\s]/g, '');
  let polluted = false;
  const pct = s.search(/[%％]/);
  if (pct >= 0) {
    if (s.slice(pct + 1)) polluted = true;
    s = s.slice(0, pct);
  }
  const m = /^\d+(?:\.\d+)?/.exec(s);
  if (!m) return { value: null, polluted: s.length > 0 };
  if (s.length > m[0].length) polluted = true;
  const value = Number.parseFloat(m[0]);
  return { value: Number.isFinite(value) ? value : null, polluted };
}

/** 数字格：不能含汉字，且要么本身是干净数字，要么带小数点（脏但仍是数字）。 */
function isNumberToken(token: string): boolean {
  const t = token.trim();
  if (!t || /[\u4E00-\u9FA5]/.test(t)) return false;
  const { value, polluted } = parseNumberToken(t);
  if (value == null) return false;
  return !polluted || t.includes('.');
}

/** 名称列：OCR 会在汉字间插空格，还会粘上 `。，""` 这类噪声。 */
export function cleanName(raw: string): string {
  return raw
    .replace(/\s+/g, '')
    .replace(/[。，、,.“”"'‘’（）()[\]【】|丨!！?？~～^*_+=—]/g, '')
    .trim();
}

/**
 * 解析 OCR 全文 → 持仓行。
 *
 * 逐行处理：先认出表头定列序，再对每个含 6 位代码的行切列。
 * 认不出表头（用户把表头裁掉了）时退回一套保守的启发式，见 `pickByGuess`。
 */
export function parseOcrText(text: string): { rows: OcrRawRow[]; columns: ColumnKind[] | null; note: string } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let columns: ColumnKind[] | null = null;
  let guessed = false;
  const rows: OcrRawRow[] = [];

  for (const line of lines) {
    // 只有真的解析出列序才算找到表头。标题行（「同花顺 我的持仓 总资产 …」）也含「持仓」，
    // 若把它当表头，下面真正的表头就被跳过了 —— 所以解析不出来就继续往下找。
    if (!columns && looksLikeHeader(line)) {
      const cols = headerColumns(line);
      if (cols) {
        columns = cols;
        continue;
      }
    }

    // 代码是整行的锚：6 位数字。电话号码、金额、日期都不会正好是 6 位裸数字。
    const tokens = line.split(/\s+/).filter(Boolean);
    let codeIdx = -1;
    let glued = ''; // 代码和名字粘在一起的情况：`600519贵州茅台`
    for (let k = 0; k < tokens.length; k++) {
      // 第 7 位必须是**非数字**：`总资产 486.320.55` 去掉小数点会变成 `48632055`，
      // 不卡这一位就会被读成代码 486320 混进持仓（实测踩过）。
      const m = /^\d{6}(\D.*)?$/.exec(cleanName(tokens[k]));
      if (m) {
        codeIdx = k;
        glued = m[1] ?? '';
        break;
      }
    }
    if (codeIdx < 0) continue;

    const code = /^\d{6}/.exec(cleanName(tokens[codeIdx]))![0];
    // 名称 = 代码之后、第一个数字之前的连续非数字词
    const nameParts: string[] = glued ? [glued] : [];
    let i = codeIdx + 1;
    for (; i < tokens.length; i++) {
      if (isNumberToken(tokens[i])) break;
      nameParts.push(tokens[i]);
    }
    const name = cleanName(nameParts.join(''));
    // 数据行只有代码、名称却是空的 → 这行不是持仓行（可能识别散了）
    if (!name) continue;

    const tail = tokens.slice(i).map((t) => t.trim());
    if (!columns) guessed = true;
    rows.push({ code, name, ...pickColumns(tail, columns), raw: line });
  }

  const note = columns
    ? `按表头识别列序：${columns.join(' / ')}`
    : guessed
      ? '没找到表头，改用保守推断（把表头一起截进来更准）'
      : '表头认不出列序，改用保守推断';
  return { rows, columns, note };
}

/**
 * 把数字尾巴按列序取值。
 *
 * 有列序、且数字个数不少于列数时按**下标**取。长度不等就退回保守推断 ——
 * 实测 `持仓/可用` 这种合并列会让表头列数和数据列数对不上（表头 3 列、数据 2 个数），
 * 硬按位置取会把成本价当数量。
 *
 * 只取到 `price` 为止，后面的市值/盈亏压根不参与，所以 OCR 把它们粘成一坨也不影响。
 */
function pickColumns(
  tail: string[],
  columns: ColumnKind[] | null,
): { quantity: number | null; cost: number | null; price: number | null } {
  if (!columns) return pickByGuess(tail);
  // 显式标注：TS 的推断型谓词会把 filter 结果收窄成四个子集，indexOf(ColumnKind) 就不过了
  const numericCols: ColumnKind[] = columns.filter((c) => c !== 'code' && c !== 'name');
  if (tail.length < numericCols.length) return pickByGuess(tail);

  const nums = tail.map((t) => parseNumberToken(t));
  const at = (kind: ColumnKind): number | null => {
    const idx = numericCols.indexOf(kind);
    return idx < 0 ? null : nums[idx].value;
  };
  return { quantity: at('qty'), cost: at('cost'), price: at('price') };
}

/**
 * 没有列序时的保守推断。
 *
 * 只依赖两条在「持仓 / 可用 / 成本 / 现价」各种排列下都成立的观察：
 * 数量是整数，成本价带小数。所以取**第一个纯整数**当数量、**第一个带小数点的数**当成本价。
 * 同花顺的「可用数量」排在「持仓数量」后面，所以第一个整数是持仓数量而不是可用，
 * 这正是我们要导入的那个数（可用数量只影响当天能不能卖，不是仓位）。
 */
function pickByGuess(tail: string[]): { quantity: number | null; cost: number | null; price: number | null } {
  let quantity: number | null = null;
  let cost: number | null = null;
  for (const t of tail) {
    const { value } = parseNumberToken(t);
    if (value == null) continue;
    if (!t.includes('.')) {
      quantity ??= value;
    } else {
      cost ??= value;
    }
  }
  return { quantity, cost, price: null };
}

/* ------------------------------------------------------------------ */
/* 校验：把「读到的」和「行情里的」「账本里的」对起来                    */
/* ------------------------------------------------------------------ */

export type OcrLevel = 'ok' | 'warn' | 'error';

export interface OcrCheckedRow {
  raw: OcrRawRow;
  /** 按账户归一化后的代码（场内补 sh/sz/bj，场外补 of） */
  code: string;
  name: string;
  quantity: number;
  cost: number;
  level: OcrLevel;
  /** 逐条说明，界面上直接列出来 */
  notes: string[];
  /** 行情查到的名字与现价，用来和截图对账 */
  liveName?: string;
  livePrice?: number;
  /** 该账户里已存在同代码持仓时的旧值 */
  existing?: { quantity: number; cost: number };
}

/**
 * 名称对账。
 *
 * **不能要求相等**：同花顺显示简称（`沪深300ETF`），腾讯返回全称（`沪深300ETF华泰柏瑞`），
 * 它把基金公司名缀在后面。所以判据是「一个是另一个的前缀 / 互相包含」，
 * 这能放过正常的简称差异，又能抓住「代码读错所以名字对不上」这个真正危险的情况。
 */
export function namesAgree(a: string, b: string): boolean {
  const x = cleanName(a).toLowerCase();
  const y = cleanName(b).toLowerCase();
  if (!x || !y) return true; // 缺一边就不判，不制造假警报
  if (x.includes(y) || y.includes(x)) return true;
  // `沪深300ETF` vs `沪深300ETF华泰柏瑞` 已由上面覆盖；再兜一层公共前缀，
  // 防 OCR 在名字中间吃掉一个字（`创业板ETF` → `创业ETF`）
  let n = 0;
  while (n < x.length && n < y.length && x[n] === y[n]) n++;
  return n >= Math.min(x.length, y.length) - 1 && n >= 3;
}

export interface CheckContext {
  accounts: Account[];
  account: AccountId;
  /** 该代码对应的行情。查不到就是 undefined，会成为一条提示而不是错误。 */
  quotes: Map<string, { name: string; price: number }>;
  /** 当前账户已有持仓，用于识别覆盖 */
  holdings: Holding[];
  /**
   * 整批行情都没取到（上游挂了/没登录）。
   *
   * 要和「这一个代码查不到」分开说：前者说「行情暂不可用」，后者才该怀疑代码读错了。
   * 混成一句话会让上游一挂，满屏都在指控用户的代码有问题。
   */
  quotesUnavailable?: boolean;
}

/**
 * 逐行校验。
 *
 * 分级的原则：**能导入但可能不对**的记 warn，**导进去一定是错的**才记 error。
 * 所以「行情查不到」只是 warn —— 可能是刚上市、或者腾讯没有这个名字；
 * 而「没读到数量」是 error，因为数量缺失的持仓行进去就是 0 成本的垃圾数据。
 */
export function checkRows(rows: OcrRawRow[], ctx: CheckContext): OcrCheckedRow[] {
  const seen = new Set<string>();
  return rows.map((raw) => {
    const notes: string[] = [];
    let level: OcrLevel = 'ok';
    const warn = (t: string) => {
      notes.push(t);
      if (level === 'ok') level = 'warn';
    };
    const fail = (t: string) => {
      notes.push(t);
      level = 'error';
    };

    const code = normalizeForAccount(ctx.accounts, ctx.account, raw.code);
    const quantity = raw.quantity ?? 0;
    const cost = raw.cost ?? 0;

    if (raw.quantity == null || raw.quantity <= 0) fail('没读到持仓数量，请手工填写');
    if (raw.cost == null || raw.cost <= 0) fail('没读到成本价，请手工填写');

    // 同一张图里出现两次同一个代码：一张截图不会有两只一样的票，多半是识别重复
    if (seen.has(code)) warn('这张图里出现了两次，确认不是重复识别');
    seen.add(code);

    const quote = ctx.quotes.get(code);
    if (quote) {
      if (!namesAgree(raw.name, quote.name)) {
        warn(`截图名称「${raw.name}」与行情名称「${quote.name}」对不上，请核对代码`);
      }
      // 现价只做对账、不导入。差得离谱通常意味着数字被吃了一位（`1523.8` → `523.8`）
      if (raw.price != null && quote.price > 0) {
        const ratio = raw.price / quote.price;
        if (ratio > 5 || ratio < 0.2) {
          warn(`截图现价 ${raw.price} 与行情 ${quote.price} 差得离谱，数字可能被读错`);
        }
      }
    } else if (ctx.quotesUnavailable) {
      warn('行情暂不可用，这次没能核对代码与名称');
    } else if (code) {
      warn('行情里查不到这个代码，请确认');
    }

    const existing = ctx.holdings.find((h) => h.account === ctx.account && h.code === code);
    if (existing) warn('该账户已有此持仓，导入会覆盖数量与成本');

    return {
      raw,
      code,
      name: raw.name,
      quantity,
      cost,
      level,
      notes,
      liveName: quote?.name,
      livePrice: quote?.price,
      existing: existing ? { quantity: existing.quantity, cost: existing.cost } : undefined,
    };
  });
}

/**
 * 行是否可导入：只看**当前**的数量与成本。
 *
 * 刻意不看上面那个 `level` —— 识别时缺数量的行被判成 error，但用户在预览表里手填之后
 * 它就齐了。拿冻结的判定去过滤，会让用户填完数字却按不动「导入」（实测的坑）。
 */
export function rowReady(row: { quantity: number; cost: number }): boolean {
  return row.quantity > 0 && row.cost > 0;
}

/**
 * 界面上显示的状态：手改补齐后「缺数据」自动降级为「待核对」。
 *
 * 降级到 warn 而不是 ok —— 数字是人填的，仍然值得对着截图再看一眼。
 */
export function effectiveLevel(row: { level: OcrLevel; quantity: number; cost: number }): OcrLevel {
  if (!rowReady(row)) return 'error';
  return row.level === 'ok' ? 'ok' : 'warn';
}
