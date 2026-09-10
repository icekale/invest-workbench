import assert from 'node:assert/strict';

import { parseSwL1Html } from '../src/utils/sw-valuation.ts';

const html = `
<div id="level1Items">
  <div id="801010.SI" class="lg-industries-item">
    <div class="lg-industries-item-chinese-title">801010.SI</div>
    <div class="lg-industries-item-number">农林牧渔(104)</div>
    <div class="lg-sw-industries-item-value">
      <span class="value">34.0</span><span class="quantile peQuantile"> 51.21%</span>
      <span class="value">35.98</span><span class="quantile peTtmQuantile"> 61.92%</span>
      <span class="value"> 2.16</span><span class="quantile pbQuantile"> 40.00%</span>
      <span class="value">2.41</span><span class="quantile gxlQuantile"> 94.23%</span>
    </div>
  </div>
  <div id="801780.SI" class="lg-industries-item">
    <div class="lg-industries-item-chinese-title">801780.SI</div>
    <div class="lg-industries-item-number">银行(42)</div>
    <div class="lg-sw-industries-item-value">
      <span class="value">6.5</span><span class="quantile peQuantile"> 90.21%</span>
      <span class="value">7.26</span><span class="quantile peTtmQuantile"> 90.61%</span>
      <span class="value"> 0.68</span><span class="quantile pbQuantile"> 80.00%</span>
      <span class="value">5.1</span><span class="quantile gxlQuantile"> 10.00%</span>
    </div>
  </div>
</div>
<div id="level2Items">
  <div id="801016.SI" class="lg-industries-item">
    <div class="lg-industries-item-chinese-title">801016.SI</div>
    <div class="lg-industries-item-number">种植业(20)</div>
    <div class="lg-sw-industries-item-value">
      <span class="value">1</span><span class="quantile peQuantile"> 1%</span>
      <span class="value">2</span><span class="quantile peTtmQuantile"> 2%</span>
      <span class="value">3</span><span class="quantile pbQuantile"> 3%</span>
      <span class="value">4</span><span class="quantile gxlQuantile"> 4%</span>
    </div>
  </div>
</div>
`;

const rows = parseSwL1Html(html);
assert.equal(rows.length, 2);
assert.equal(rows[0].code, '801010.SI');
assert.equal(rows[0].name, '农林牧渔');
assert.equal(rows[0].count, 104);
assert.equal(rows[0].pe, 35.98);
assert.equal(rows[0].pePercentile, 61.92);
assert.equal(rows[1].name, '银行');
assert.equal(rows[1].pe, 7.26);
assert.equal(rows[1].pePercentile, 90.61);

console.log('check-sw-valuation ok');
