/**
 * 持仓截图识别自检：`npm run check:ocr`
 *
 * 断言用的是**真实 OCR 输出**（`scripts/fixtures/ocr-*.txt`，由 tesseract.js 跑自造同花顺
 * 截图导出），不是手写的理想文本。这一步很关键：手写的样本一定长得像我以为的样子，
 * 而真正会出问题的是 OCR 那些怪毛病 —— 汉字之间插空格、数字后面粘脏字、
 * 表头把「持仓/可用」并成一列、整段数字被读成一坨。
 * 第一版解析器就是被这三条打回的（把成本价当数量），所以样本必须来自真跑。
 *
 * 三份 fixture 对应三种真实场景：
 *   - ocr-sample：带标题栏的窄表，表头是合并列「持仓/可用」，且数字尾巴被读烂
 *   - ocr-dense ：密排 9 列（持仓/可用/成本/现价/市值/盈亏/比例），列数与表头对得上
 *   - ocr-scaled：同一张图缩到 72%，行尾的百分号粘连情况不同
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defaultAccounts } from '../src/utils/accounts.ts';
import {
  checkRows,
  cleanName,
  effectiveLevel,
  headerColumns,
  namesAgree,
  parseNumberToken,
  parseOcrText,
  rowReady,
} from '../src/utils/holdings-ocr.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const fixture = (n: string) => readFileSync(join(HERE, 'fixtures', n), 'utf8');

/* ---------- 1. 数字格的容错：该救的救，不该猜的不猜 ---------- */
assert.deepEqual(parseNumberToken('1480.500'), { value: 1480.5, polluted: false });
assert.deepEqual(parseNumberToken('1,480.50'), { value: 1480.5, polluted: false }, '千分位要吃掉');
assert.deepEqual(parseNumberToken('2.939%6'), { value: 2.939, polluted: true }, '百分号后粘连要标脏');
assert.deepEqual(parseNumberToken('1480.50Q0'), { value: 1480.5, polluted: true }, '前缀对就用，但标脏');
// 反例：`1.45%` 被读成 `1.4596` —— 它是个**合法数字**，这一层认不出错。
// 所以光靠解析不可能查全，必须再拿行情对账（见下面第 6 节的 price 比对）。
assert.deepEqual(parseNumberToken('1.4596'), { value: 1.4596, polluted: false });
assert.equal(parseNumberToken('l480.500').value, null, '字母 l 冒充 1 时**不能猜**，宁可让用户手填');
assert.equal(parseNumberToken('—').value, null);
assert.equal(parseNumberToken('').value, null);

/* ---------- 2. 表头定列序 ---------- */
assert.deepEqual(headerColumns('证券代码 证券名称 持仓数量 可用数量 成本价 现价'), [
  'code',
  'name',
  'qty',
  'avail',
  'cost',
  'price',
]);
// 关键：列序必须与出现顺序一致，否则会把可用数量当持仓数量导入
assert.deepEqual(
  headerColumns('证券代码 证券名称 持仓数量 可用数量 成本价 现价'),
  ['code', 'name', 'qty', 'avail', 'cost', 'price'],
  'qty 必须在 avail 前面',
);
// 合并列「持仓/可用」是一列，不能再拆出 avail
assert.deepEqual(headerColumns('证 券 代 码 证券名称 持仓 /可 用 成本价 现价'), [
  'code',
  'name',
  'qty',
  'cost',
  'price',
]);
assert.equal(headerColumns('成交明细 成交价格 成交量'), null, '不是持仓表头就要拒掉');

/* ---------- 3. 名称清洗 ---------- */
assert.equal(cleanName('贵州 茅台'), '贵州茅台', 'OCR 在汉字间插空格');
assert.equal(cleanName('。 贵州 茅台'), '贵州茅台', '前导标点要丢掉');
assert.equal(cleanName('”科 创 50ETF'), '科创50ETF');

/* ---------- 4. 名称对账：放过简称差异，抓住代码读错 ---------- */
assert.ok(namesAgree('沪深300ETF', '沪深300ETF华泰柏瑞'), '同花顺简称 vs 腾讯全称要放过');
assert.ok(namesAgree('证券ETF', '证券ETF国泰'), '基金公司名缀在后面');
assert.ok(namesAgree('贵州茅台', '贵州茅台'));
assert.ok(!namesAgree('贵州茅台', '五粮液'), '名字完全不同必须报警');
assert.ok(!namesAgree('证券ETF', '创业板ETF'), '同后缀不同标的必须报警');
assert.ok(namesAgree('', '贵州茅台'), '缺一边不判，不制造假警报');

/* ---------- 5. 真实 OCR 输出：三份 fixture 逐行核对 ---------- */
const EXPECT: Record<string, Array<[string, string, number, number]>> = {
  // [代码, 名称, 持仓数量, 成本价]
  'ocr-sample.txt': [
    ['600519', '贵州茅台', 100, 1480.5],
    ['510300', '沪深300ETF', 12000, 3.856],
    ['000001', '平安银行', 3000, 11.24],
    ['512880', '证券ETF', 25000, 0.982],
    ['159915', '创业板ETF', 8000, 2.145],
  ],
  'ocr-dense.txt': [
    ['600519', '贵州茅台', 100, 1480.5],
    ['510300', '沪深300ETF', 12000, 3.856],
    // 持仓数量 3000 / 可用数量 2000 —— 必须取 3000，取到可用就是错了
    ['000001', '平安银行', 3000, 11.24],
    ['512880', '证券ETF', 25000, 0.982],
    ['159915', '创业板ETF', 8000, 2.145],
    ['588000', '科创50ETF', 5000, 1.118],
  ],
  'ocr-scaled.txt': [
    ['600519', '贵州茅台', 100, 1480.5],
    ['510300', '沪深300ETF', 12000, 3.856],
    ['000001', '平安银行', 3000, 11.24],
    ['512880', '证券ETF', 25000, 0.982],
    ['159915', '创业板ETF', 8000, 2.145],
    ['588000', '科创50ETF', 5000, 1.118],
  ],
};

for (const [file, expect] of Object.entries(EXPECT)) {
  const { rows, columns } = parseOcrText(fixture(file));
  assert.equal(rows.length, expect.length, `${file}: 行数`);
  assert.ok(columns, `${file}: 应当认出了表头列序`);

  expect.forEach(([code, name, qty, cost], i) => {
    const r = rows[i];
    assert.equal(r.code, code, `${file} 第 ${i + 1} 行代码`);
    assert.equal(r.name, name, `${file} 第 ${i + 1} 行名称`);
    assert.equal(r.quantity, qty, `${file} 第 ${i + 1} 行持仓数量（不能取到可用数量）`);
    assert.equal(r.cost, cost, `${file} 第 ${i + 1} 行成本价（不能取到现价或市值）`);
  });
  // 标题行、页脚不能被当成数据行
  assert.ok(
    rows.every((r) => !/总资产|数据来源/.test(r.raw)),
    `${file}: 标题/页脚行不能进结果`,
  );
}

/* ---------- 6. 校验分级：缺数量是 error，查不到行情只是 warn ---------- */
const accounts = defaultAccounts();
const ctx = {
  accounts,
  account: 'stock',
  quotes: new Map([
    ['sh600519', { name: '贵州茅台', price: 1523.8 }],
    ['sh510300', { name: '沪深300ETF华泰柏瑞', price: 3.912 }],
  ]),
  holdings: [],
};

const checked = checkRows(
  [
    // 好行：名称是简称、行情是全称，必须判 ok
    { code: '600519', name: '贵州茅台', quantity: 100, cost: 1480.5, price: 1523.8, raw: '' },
    { code: '510300', name: '沪深300ETF', quantity: 12000, cost: 3.856, price: 3.912, raw: '' },
    // 名称与行情对不上 → warn（多半是代码读错了）
    { code: '600519', name: '五粮液', quantity: 100, cost: 1480.5, price: 1523.8, raw: '' },
    // 没读到数量 → error，不能导入
    { code: '159915', name: '创业板ETF', quantity: null, cost: 2.145, price: 2.088, raw: '' },
    // 行情查不到 → warn，仍然可以导入
    { code: '999999', name: '不存在的票', quantity: 100, cost: 10, price: 10, raw: '' },
  ],
  ctx,
);

assert.equal(checked[0].level, 'ok', '简称差异不能报警');
assert.equal(checked[1].level, 'ok', '基金公司前后缀差异不能报警');
assert.equal(checked[2].level, 'warn', '名称对不上要提示');
assert.ok(checked[2].notes.some((n) => n.includes('对不上')));
assert.equal(checked[3].level, 'error', '缺数量必须拦住');
assert.equal(checked[4].level, 'warn', '行情查不到只是提示，不该拦');

/* ---------- 7. 可导入性看**当前值**，不看冻结的判定 ---------- */
// 识别时缺数量的行被判 error，用户在预览表里手填之后就该能导 —— 拿冻结的 level 过滤，
// 用户填完数字却按不动「导入」。
assert.equal(rowReady({ quantity: 0, cost: 1 }), false);
assert.equal(rowReady({ quantity: 1, cost: 0 }), false);
assert.equal(rowReady({ quantity: 1, cost: 1 }), true);
assert.equal(effectiveLevel({ level: 'error', quantity: 0, cost: 0 }), 'error', '还是空的就仍是缺数据');
assert.equal(effectiveLevel({ level: 'error', quantity: 100, cost: 2 }), 'warn', '补齐后降级为待核对');
assert.equal(effectiveLevel({ level: 'ok', quantity: 100, cost: 2 }), 'ok');
assert.equal(effectiveLevel({ level: 'warn', quantity: 100, cost: 2 }), 'warn');

// 代码要按账户归一化：股票账户补 sh
assert.equal(checked[0].code, 'sh600519');
// 同一账户已有持仓 → 提示会被覆盖
const withExisting = checkRows([{ code: '600519', name: '贵州茅台', quantity: 100, cost: 1, price: null, raw: '' }], {
  ...ctx,
  holdings: [{ account: 'stock', code: 'sh600519', name: '贵州茅台', quantity: 50, cost: 9 } as never],
});
assert.ok(withExisting[0].existing, '要认出已有持仓');
assert.ok(withExisting[0].notes.some((n) => n.includes('覆盖')));

console.log('check-ocr ok');
