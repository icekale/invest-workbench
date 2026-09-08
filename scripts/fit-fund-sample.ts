import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fitFundModel, parseStatisticalCsv } from '../src/utils/fund-model.ts';

const CSV_URL = 'https://7367-sglcai-d0g415ml81c9b9ed2-1317095826.cos.ap-shanghai.myqcloud.com/statistical.csv';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const res = await fetch(CSV_URL);
if (!res.ok) throw new Error(`csv http ${res.status}`);
const text = await res.text();
const funds = parseStatisticalCsv(text);
if (funds.length < 100) throw new Error(`sample too small ${funds.length}`);
const model = fitFundModel(funds);
writeFileSync(join(root, 'public/fund-statistical.csv'), text);
writeFileSync(join(root, 'public/fund-model.json'), JSON.stringify(model));
console.log(
  `fit ok n=${model.n} asOf=${model.asOf} olsR2=${model.ols[0].r2} rfTestR2=${model.rfLoss.test.r2} olsTestR2=${model.olsLossTest.r2}`,
);
