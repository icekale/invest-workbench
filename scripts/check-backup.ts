import assert from 'node:assert/strict';

import { cniHistoryUrl, csiFile, parseSinaBody, parseSzseMonth } from '../src/utils/backup.ts';

const sina = parseSinaBody(
  `var hq_str_sh510300="沪深300ETF,4.616,4.600,4.634,4.649,4.612,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2026-09-07,15:00:00,00,";
var hq_str_sz159919="";`,
);
const q = sina.get('sh510300');
assert.ok(q);
assert.equal(q.name, '沪深300ETF');
assert.equal(q.price, 4.634);
assert.equal(q.changePct, ((4.634 - 4.6) / 4.6) * 100);
assert.equal(sina.size, 1);

const days = parseSzseMonth(
  {
    data: [
      { jyrq: '2026-02-01', jybz: '0' },
      { jyrq: '2026-02-02', jybz: '1' },
      { jyrq: '2026-02-03', jybz: '1' },
      { jyrq: '2026-02-04', jybz: '1' },
      { jyrq: '2026-02-05', jybz: '1' },
      { jyrq: '2026-02-06', jybz: '1' },
      { jyrq: '2026-02-07', jybz: '0' },
      { jyrq: '2026-02-08', jybz: '0' },
      { jyrq: '2026-02-09', jybz: '1' },
      { jyrq: '2026-02-10', jybz: '1' },
      { jyrq: '2026-02-11', jybz: '1' },
      { jyrq: '2026-02-12', jybz: '1' },
      { jyrq: '2026-02-13', jybz: '1' },
      { jyrq: '2026-02-14', jybz: '0' },
      { jyrq: '2026-02-15', jybz: '0' },
      { jyrq: '2026-02-16', jybz: '1' },
      { jyrq: '2026-02-17', jybz: '1' },
      { jyrq: '2026-02-18', jybz: '1' },
      { jyrq: '2026-02-19', jybz: '1' },
      { jyrq: '2026-02-20', jybz: '1' },
      { jyrq: '2026-02-21', jybz: '0' },
      { jyrq: '2026-02-22', jybz: '0' },
      { jyrq: '2026-02-23', jybz: '1' },
      { jyrq: '2026-02-24', jybz: '1' },
      { jyrq: '2026-02-25', jybz: '1' },
      { jyrq: '2026-02-26', jybz: '1' },
      { jyrq: '2026-02-27', jybz: '1' },
      { jyrq: '2026-02-28', jybz: '0' },
    ],
  },
  2026,
  2,
);
assert.equal(days.length, 28);
assert.equal(days[0].open, false);
assert.equal(days[1].open, true);

assert.throws(() => parseSzseMonth({ data: [{ jyrq: '2026-02-01', jybz: '1' }] }, 2026, 2));
assert.equal(csiFile('000300', 'cons').includes('000300cons.xls'), true);
assert.equal(cniHistoryUrl('399006').includes('indexcode=399006'), true);

console.log('check-backup ok');
