import assert from 'node:assert/strict';

import {
  BAND_COUNT,
  bands,
  briefingModel,
  DEFAULT_BANDS,
  DEFAULT_MODEL,
  isBandOverridden,
  isBandsOverridden,
  isModelOverridden,
  normalizeBands,
  resetBands,
  resetModel,
  saveBands,
  saveModel,
} from '../src/utils/research-settings.ts';
import { initialRows, SOURCES } from '../src/utils/source-health.ts';
import { bandIndexOf, deriveValuationSignal } from '../src/utils/valuation.ts';

const deep = (a: unknown, b: unknown, msg: string) => assert.deepEqual(a, b, msg);

/* ---------- normalizeBands：坏输入不能把估值表打乱 ---------- */

deep(normalizeBands(undefined), DEFAULT_BANDS, 'undefined 应回落默认');
deep(normalizeBands(null), DEFAULT_BANDS, 'null 应回落默认');
deep(normalizeBands('abc'), DEFAULT_BANDS, '字符串应回落默认');
deep(normalizeBands(42), DEFAULT_BANDS, '数字应回落默认');
deep(normalizeBands([]), DEFAULT_BANDS, '空数组应回落默认');

// 只有一档时，其余按默认补齐
deep(
  normalizeBands([{ max: 30 }]),
  [
    { max: 30, label: '偏低', tilt: '+10% ~ +15%' },
    DEFAULT_BANDS[1],
    DEFAULT_BANDS[2],
    DEFAULT_BANDS[3],
    DEFAULT_BANDS[4],
  ],
  '缺项应按默认补齐',
);

// 上限降到负值 → 抬到 1；上限给 999 → 压到 96 给后面 4 档留位置
assert.equal(normalizeBands([{ max: -5 }])[0]!.max, 1, '负上限应抬到 1');
assert.equal(normalizeBands([{ max: 999 }])[0]!.max, 96, '超大上限应压到 96');

// 非递增必须被修成严格递增，否则中间那档永远不可达
const flat = normalizeBands([{ max: 50 }, { max: 30 }, { max: 40 }, { max: 50 }]);
for (let i = 1; i < BAND_COUNT; i++) {
  assert.ok(flat[i]!.max > flat[i - 1]!.max, `第 ${i} 档应严格大于上一档：${JSON.stringify(flat)}`);
}
assert.equal(flat[1]!.max, 51, '回落时应贴紧上一档 +1');

// 空格文案回落到默认，不留空标签
const blank = normalizeBands([{ max: 20, label: '   ', tilt: '' }]);
assert.equal(blank[0]!.label, '偏低', '空白标签应回落默认');
assert.equal(blank[0]!.tilt, '+10% ~ +15%', '空白建议应回落默认');

// 最后一档永远兜 100，改它没意义
assert.equal(
  normalizeBands([{ max: 20 }, { max: 40 }, { max: 60 }, { max: 80 }, { max: 50 }])[4]!.max,
  100,
  '末档固定 100',
);

// 任意脏数组都不炸、且永远 5 档
for (const junk of [[{}], [{ max: 'x' }], [1, 2, 3, 4, 5, 6, 7], [null, undefined, {}]]) {
  const out = normalizeBands(junk);
  assert.equal(out.length, BAND_COUNT, `脏输入应仍产出 5 档：${JSON.stringify(junk)}`);
}

/* ---------- 分档边界：区间是「＜上限」，上限本身落到下一档 ---------- */

const def = DEFAULT_BANDS.map((b) => b.max);
assert.equal(bandIndexOf(-1, DEFAULT_BANDS), 0, '负分位进第一档');
assert.equal(bandIndexOf(19.99, DEFAULT_BANDS), 0);
assert.equal(bandIndexOf(20, DEFAULT_BANDS), 1, '上限本身属于下一档');
assert.equal(bandIndexOf(40, DEFAULT_BANDS), 2);
assert.equal(bandIndexOf(60, DEFAULT_BANDS), 3);
assert.equal(bandIndexOf(80, DEFAULT_BANDS), 4);
assert.equal(bandIndexOf(100, DEFAULT_BANDS), 4, '满分位进末档');
assert.equal(def.length, BAND_COUNT);

/* ---------- 改档位真的会改信号，恢复默认真的会回默认 ---------- */

assert.equal(deriveValuationSignal(5).label, '偏低');
assert.equal(deriveValuationSignal(5).signal, 'STRONG_BUY');

saveBands([
  { max: 10, label: '极低', tilt: '+20%' },
  { max: 30, label: '低', tilt: '+10%' },
  { max: 55, label: '中', tilt: '0%' },
  { max: 85, label: '高', tilt: '-10%' },
  { max: 100, label: '极高', tilt: '-25%' },
]);
assert.ok(isBandsOverridden(), '改过之后应标记为已改动');
assert.equal(isBandOverridden(0), true, '第 0 档应显示已改');
assert.equal(bands.value[0]!.max, 10);
assert.equal(deriveValuationSignal(5).label, '极低', '改档位应立刻改变标签');
assert.equal(deriveValuationSignal(5).tilt, '+20%', '改档位应立刻改变仓位建议');
assert.equal(deriveValuationSignal(5).advice, '分位极低', 'advice 应跟着标签走');
// 视觉表达按档位序号固定，不跟着文案跑
assert.equal(deriveValuationSignal(5).signal, 'STRONG_BUY', '第 0 档信号不随文案变');
assert.equal(deriveValuationSignal(5).color, '#16815f', '第 0 档颜色不随文案变');
assert.equal(deriveValuationSignal(5).statusTag, 'success');
// 边界随新档位走
assert.equal(bandIndexOf(10), 1, '10 应按新档位落到第 1 档');
assert.equal(deriveValuationSignal(10).label, '低');
assert.equal(deriveValuationSignal(90).label, '极高');
assert.equal(deriveValuationSignal(90).signal, 'SELL');

resetBands();
assert.equal(isBandsOverridden(), false, '恢复默认后不该再标已改');
assert.equal(deriveValuationSignal(5).label, '偏低', '恢复默认应回到出厂档位');

/* ---------- 模型 ---------- */

assert.equal(briefingModel.value, DEFAULT_MODEL);
assert.equal(isModelOverridden(), false);
saveModel('  gemini-3.9-pro  ');
assert.equal(briefingModel.value, 'gemini-3.9-pro', '模型应去掉首尾空格');
assert.ok(isModelOverridden());
saveModel('   ');
assert.equal(briefingModel.value, DEFAULT_MODEL, '空模型应回落默认');
resetModel();
assert.equal(isModelOverridden(), false);

/* ---------- 自检表：注册表不能有重复 id，行要能完整生成 ---------- */

const ids = SOURCES.map((s) => s.id);
assert.equal(new Set(ids).size, ids.length, `源 id 不能重复：${ids.join(',')}`);
for (const s of SOURCES) {
  assert.ok(s.name && s.path && s.ttl, `${s.id} 缺 name/path/ttl`);
  assert.equal(typeof s.probe, 'function', `${s.id} 缺 probe`);
}
const rows = initialRows();
assert.equal(rows.length, SOURCES.length, '行数应与源数一致');
assert.ok(
  rows.every((r) => r.status === 'idle' && r.detail === ''),
  '初始行应全是未测状态',
);

console.log('check-research-settings ✓');
