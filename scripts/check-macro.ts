import assert from 'node:assert/strict';

import { inferBriefTone, inferBriefTopic, parseLiveBriefs } from '../src/utils/briefs.ts';
import { parseCpi, parseGdp, parsePmi, parsePpi } from '../src/utils/macro-cn.ts';

const pmiRows = [
  { REPORT_DATE: '2026-08-01 00:00:00', MAKE_INDEX: 49.8 },
  { REPORT_DATE: '2026-07-01 00:00:00', MAKE_INDEX: 49.2 },
  { REPORT_DATE: '2026-06-01 00:00:00', MAKE_INDEX: 50.3 },
];
const pmi = parsePmi(pmiRows);
assert.ok(pmi);
assert.equal(pmi.latestValue, 49.8);
assert.equal(pmi.previousValue, 49.2);
assert.equal(pmi.change, 0.6);
assert.equal(pmi.dates[0], '2026-06'); // 正序：最早在前
assert.equal(pmi.dates.at(-1), '2026-08');

const cpi = parseCpi([{ REPORT_DATE: '2026-07-01 00:00:00', NATIONAL_SAME: 0.5 }]);
assert.ok(cpi);
assert.equal(cpi.latestValue, 0.5);

const ppi = parsePpi([{ REPORT_DATE: '2026-07-01 00:00:00', BASE_SAME: -0.6 }]);
assert.ok(ppi);
assert.equal(ppi.latestValue, -0.6);

const gdp = parseGdp([{ REPORT_DATE: '2026-06-30 00:00:00', SUM_SAME: 5.2 }]);
assert.ok(gdp);
assert.equal(gdp.latestValue, 5.2);
assert.equal(gdp.freq, '季');

// 空数据 / 缺字段 → null，不造数据
assert.equal(parsePmi([]), null);
assert.equal(parseCpi([{ REPORT_DATE: '2026-07-01 00:00:00' }]), null);

assert.equal(inferBriefTopic('央行下调 MLF 利率'), '流动性');
assert.equal(inferBriefTone('降准落地，流动性宽松'), '利多');
const briefs = parseLiveBriefs({
  data: {
    a_stock: {
      items: [
        {
          id: 101,
          title: '央行开展逆回购操作',
          content_text: '人民银行今日开展 1000 亿元 7 天期逆回购，维护流动性合理充裕。',
          display_time: 1710000000,
          score: 3,
        },
        {
          id: 102,
          title: '早餐',
          content_text: '提醒：日内请重点关注非农',
          display_time: 1710000060,
          score: 4,
        },
      ],
    },
  },
});
assert.equal(briefs.length, 1);
assert.equal(briefs[0].id, 'live_101');
assert.equal(briefs[0].topic, '流动性');
assert.equal(parseLiveBriefs({ data: {} }).length, 0);

console.log('check-macro ok');
