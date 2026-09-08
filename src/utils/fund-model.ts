export interface SampleFund {
  code: string;
  name: string;
  type: string;
  risk: string;
  manager: string;
  company: string;
  scale: number;
  rating: number;
  quota: number;
  inst: number | null;
  shares: number;
  bonds: number;
  cash: number;
  yield: number;
  vix: number;
  loss: number;
  ret1y: number;
  valueDate: string;
}

export interface ColStats {
  mean: number;
  std: number;
  min: number;
  p5: number;
  p25: number;
  median: number;
  p75: number;
  p95: number;
  max: number;
  skew: number;
  kurt: number;
}

export interface OlsModel {
  name: string;
  y: string;
  x: string[];
  b: number[];
  r2: number;
  aic: number;
}

export interface FitMetrics {
  r2: number;
  mae: number;
  rmse: number;
}

export type RfNode = { v: number } | { f: number; t: number; l: RfNode; r: RfNode };

export interface FundModel {
  n: number;
  asOf: string;
  desc: { yield: ColStats; vix: ColStats; loss: ColStats };
  corr: { yv: number; vl: number; yl: number };
  vif: number;
  ols: OlsModel[];
  rfLoss: { trees: RfNode[]; train: FitMetrics; test: FitMetrics };
  olsLossTest: FitMetrics;
}

const TYPES = ['混合型', '股票型', '混合债', '中长债', '中短债', '指数型', '货币型', 'QDII'] as const;

function fnum(s: string | undefined): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function fopt(s: string | undefined): number | null {
  const t = (s ?? '').trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function mapCategory(category: string): string {
  const [a, b = ''] = category.split('-');
  if (a === '货币型') return '货币型';
  if (a === '债券型') {
    if (b.includes('中短债')) return '中短债';
    if (b.includes('混合一级') || b.includes('混合二级')) return '混合债';
    return '中长债';
  }
  return a || '其他';
}

export function parseStatisticalCsv(text: string): SampleFund[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (lines.length < 2) return [];
  const head = lines[0].split(',');
  const idx = (k: string) => head.indexOf(k);
  const i = {
    code: idx('code'),
    name: idx('name'),
    category: idx('category'),
    risk: idx('risk'),
    company: idx('company'),
    manager: idx('manager'),
    size: idx('size'),
    rating: idx('rating'),
    quota: idx('quota'),
    inst: idx('institutionalProportion'),
    shares: idx('shares'),
    bonds: idx('bonds'),
    cash: idx('cash'),
    yield: idx('yield'),
    vix: idx('vix'),
    loss: idx('loss'),
    last1y: idx('last1y'),
    valueDate: idx('valueDate'),
  };
  const out: SampleFund[] = [];
  for (const line of lines.slice(1)) {
    const c = line.split(',');
    const code = (c[i.code] ?? '').trim();
    const name = (c[i.name] ?? '').trim();
    if (!code || !name) continue;
    out.push({
      code,
      name,
      type: mapCategory(c[i.category] ?? ''),
      risk: (c[i.risk] ?? '').trim(),
      manager: (c[i.manager] ?? '').trim(),
      company: (c[i.company] ?? '').trim(),
      scale: fnum(c[i.size]),
      rating: fnum(c[i.rating]),
      quota: fnum(c[i.quota]),
      inst: fopt(c[i.inst]),
      shares: fnum(c[i.shares]),
      bonds: fnum(c[i.bonds]),
      cash: fnum(c[i.cash]),
      yield: fnum(c[i.yield]),
      vix: fnum(c[i.vix]),
      loss: fnum(c[i.loss]),
      ret1y: fnum(c[i.last1y]),
      valueDate: (c[i.valueDate] ?? '').trim(),
    });
  }
  return out;
}

export function quantile(xs: number[], q: number): number {
  if (!xs.length) return 0;
  const s = xs.slice().sort((a, b) => a - b);
  const p = (s.length - 1) * q;
  const i = Math.floor(p);
  const t = p - i;
  return s[i] * (1 - t) + s[Math.min(i + 1, s.length - 1)] * t;
}

export function describe(xs: number[]): ColStats {
  const n = xs.length;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const v = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  const std = Math.sqrt(v);
  const m3 = xs.reduce((a, b) => a + (b - mean) ** 3, 0) / n;
  const m4 = xs.reduce((a, b) => a + (b - mean) ** 4, 0) / n;
  return {
    mean,
    std,
    min: Math.min(...xs),
    p5: quantile(xs, 0.05),
    p25: quantile(xs, 0.25),
    median: quantile(xs, 0.5),
    p75: quantile(xs, 0.75),
    p95: quantile(xs, 0.95),
    max: Math.max(...xs),
    skew: std ? m3 / std ** 3 : 0,
    kurt: std ? m4 / std ** 4 - 3 : 0,
  };
}

export function pearson(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((x, y) => x + y, 0) / n;
  const mb = b.reduce((x, y) => x + y, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  return num / Math.sqrt(da * db);
}

function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) {
      if (Math.abs(m[r][i]) > Math.abs(m[p][i])) p = r;
    }
    [m[i], m[p]] = [m[p], m[i]];
    const piv = m[i][i];
    if (Math.abs(piv) < 1e-12) throw new Error('ols singular');
    for (let j = i; j <= n; j++) m[i][j] /= piv;
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const f = m[r][i];
      for (let j = i; j <= n; j++) m[r][j] -= f * m[i][j];
    }
  }
  return m.map((row) => row[n]);
}

export function olsFit(y: number[], cols: number[][]): { b: number[]; r2: number; aic: number; yhat: number[] } {
  const n = y.length;
  const k = cols.length + 1;
  const X = y.map((_, i) => [1, ...cols.map((c) => c[i])]);
  const XtX: number[][] = [];
  const XtY: number[] = [];
  for (let i = 0; i < k; i++) {
    XtY.push(0);
    const row: number[] = [];
    for (let j = 0; j < k; j++) row.push(0);
    XtX.push(row);
  }
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < k; a++) {
      XtY[a] += X[i][a] * y[i];
      for (let b = 0; b < k; b++) XtX[a][b] += X[i][a] * X[i][b];
    }
  }
  const b = solve(XtX, XtY);
  const yhat = X.map((row) => row.reduce((s, v, j) => s + v * b[j], 0));
  const met = fitMetrics(y, yhat);
  const rss = y.reduce((s, yi, i) => s + (yi - yhat[i]) ** 2, 0);
  const aic = n * Math.log(rss / n) + 2 * k;
  return { b, r2: met.r2, aic, yhat };
}

export function fitMetrics(y: number[], yhat: number[]): FitMetrics {
  const n = y.length;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sse = 0;
  let sst = 0;
  let abs = 0;
  for (let i = 0; i < n; i++) {
    const e = y[i] - yhat[i];
    sse += e * e;
    sst += (y[i] - my) ** 2;
    abs += Math.abs(e);
  }
  return { r2: 1 - sse / sst, mae: abs / n, rmse: Math.sqrt(sse / n) };
}

interface Row {
  x: number[];
  y: number;
}

function meanY(rows: Row[]): number {
  return rows.reduce((s, r) => s + r.y, 0) / rows.length;
}

function bestSplit(rows: Row[], minLeaf: number): { f: number; t: number; L: Row[]; R: Row[] } | null {
  let best: { f: number; t: number; loss: number; L: Row[]; R: Row[] } | null = null;
  const nf = rows[0].x.length;
  for (let f = 0; f < nf; f++) {
    const sorted = rows.slice().sort((a, b) => a.x[f] - b.x[f]);
    let sumL = 0;
    let sum2L = 0;
    let nL = 0;
    const sumAll = sorted.reduce((s, r) => s + r.y, 0);
    const sum2All = sorted.reduce((s, r) => s + r.y * r.y, 0);
    for (let i = 0; i < sorted.length - minLeaf; i++) {
      sumL += sorted[i].y;
      sum2L += sorted[i].y * sorted[i].y;
      nL += 1;
      if (nL < minLeaf) continue;
      if (sorted[i].x[f] === sorted[i + 1].x[f]) continue;
      const nR = sorted.length - nL;
      if (nR < minLeaf) break;
      const t = (sorted[i].x[f] + sorted[i + 1].x[f]) / 2;
      const sumR = sumAll - sumL;
      const sum2R = sum2All - sum2L;
      const loss = sum2L - (sumL * sumL) / nL + (sum2R - (sumR * sumR) / nR);
      if (!best || loss < best.loss) {
        const L = sorted.slice(0, nL);
        const R = sorted.slice(nL);
        best = { f, t, loss, L, R };
      }
    }
  }
  return best ? { f: best.f, t: best.t, L: best.L, R: best.R } : null;
}

export function fitTree(rows: Row[], depth: number, minLeaf: number): RfNode {
  if (depth <= 0 || rows.length < minLeaf * 2) return { v: meanY(rows) };
  const sp = bestSplit(rows, minLeaf);
  if (!sp) return { v: meanY(rows) };
  return { f: sp.f, t: sp.t, l: fitTree(sp.L, depth - 1, minLeaf), r: fitTree(sp.R, depth - 1, minLeaf) };
}

export function predictTree(node: RfNode, x: number[]): number {
  if ('v' in node) return node.v;
  return x[node.f] <= node.t ? predictTree(node.l, x) : predictTree(node.r, x);
}

export function predictForest(trees: RfNode[], x: number[]): number {
  return trees.reduce((s, t) => s + predictTree(t, x), 0) / trees.length;
}

function rng(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function fitForest(rows: Row[], nTrees = 20, depth = 5, minLeaf = 25, seed = 1): RfNode[] {
  const rand = rng(seed);
  const trees: RfNode[] = [];
  for (let t = 0; t < nTrees; t++) {
    const bag: Row[] = [];
    for (let i = 0; i < rows.length; i++) bag.push(rows[Math.min(rows.length - 1, Math.floor(rand() * rows.length))]);
    trees.push(fitTree(bag, depth, minLeaf));
  }
  return trees;
}

function round(n: number, d = 4): number {
  const p = 10 ** d;
  return Math.round(n * p) / p;
}

function roundStats(s: ColStats): ColStats {
  const o: ColStats = { ...s };
  (Object.keys(o) as (keyof ColStats)[]).forEach((k) => {
    o[k] = round(o[k], 4);
  });
  return o;
}

export function fitFundModel(funds: SampleFund[]): FundModel {
  const rows = funds.filter((f) => Number.isFinite(f.yield) && Number.isFinite(f.vix) && Number.isFinite(f.loss));
  const Y = rows.map((f) => f.yield);
  const V = rows.map((f) => f.vix);
  const L = rows.map((f) => f.loss);
  const lossM = olsFit(L, [Y, V]);
  const vixM = olsFit(V, [Y, L]);
  const yieldM = olsFit(Y, [V, L]);
  const yv = pearson(Y, V);
  const rand = rng(2);
  const idx = rows.map((_, i) => i).sort(() => rand() - 0.5);
  const cut = Math.floor(idx.length * 0.8);
  const tr = idx.slice(0, cut);
  const te = idx.slice(cut);
  const trainRows: Row[] = tr.map((i) => ({ x: [Y[i], V[i]], y: L[i] }));
  const testX = te.map((i) => [Y[i], V[i]]);
  const testY = te.map((i) => L[i]);
  const trees = fitForest(trainRows, 20, 5, 25, 1);
  const trainHat = trainRows.map((r) => predictForest(trees, r.x));
  const testHat = testX.map((x) => predictForest(trees, x));
  const olsTestHat = te.map((i) => lossM.b[0] + lossM.b[1] * Y[i] + lossM.b[2] * V[i]);
  return {
    n: rows.length,
    asOf: rows[0]?.valueDate || '',
    desc: { yield: roundStats(describe(Y)), vix: roundStats(describe(V)), loss: roundStats(describe(L)) },
    corr: { yv: round(yv, 4), vl: round(pearson(V, L), 4), yl: round(pearson(Y, L), 4) },
    vif: round(1 / (1 - yv * yv), 4),
    ols: [
      {
        name: 'Loss ~ Yield + Vix',
        y: 'Loss',
        x: ['Yield', 'Vix'],
        b: lossM.b.map((x) => round(x, 4)),
        r2: round(lossM.r2, 4),
        aic: round(lossM.aic, 1),
      },
      {
        name: 'Vix ~ Yield + Loss',
        y: 'Vix',
        x: ['Yield', 'Loss'],
        b: vixM.b.map((x) => round(x, 4)),
        r2: round(vixM.r2, 4),
        aic: round(vixM.aic, 1),
      },
      {
        name: 'Yield ~ Vix + Loss',
        y: 'Yield',
        x: ['Vix', 'Loss'],
        b: yieldM.b.map((x) => round(x, 4)),
        r2: round(yieldM.r2, 4),
        aic: round(yieldM.aic, 1),
      },
    ],
    rfLoss: {
      trees,
      train: {
        r2: round(
          fitMetrics(
            trainRows.map((r) => r.y),
            trainHat,
          ).r2,
          4,
        ),
        mae: round(
          fitMetrics(
            trainRows.map((r) => r.y),
            trainHat,
          ).mae,
          4,
        ),
        rmse: round(
          fitMetrics(
            trainRows.map((r) => r.y),
            trainHat,
          ).rmse,
          4,
        ),
      },
      test: {
        r2: round(fitMetrics(testY, testHat).r2, 4),
        mae: round(fitMetrics(testY, testHat).mae, 4),
        rmse: round(fitMetrics(testY, testHat).rmse, 4),
      },
    },
    olsLossTest: {
      r2: round(fitMetrics(testY, olsTestHat).r2, 4),
      mae: round(fitMetrics(testY, olsTestHat).mae, 4),
      rmse: round(fitMetrics(testY, olsTestHat).rmse, 4),
    },
  };
}

export function predictOlsLoss(model: FundModel, yld: number, vix: number): number {
  const b = model.ols[0].b;
  return b[0] + b[1] * yld + b[2] * vix;
}

export function lossResidual(model: FundModel, f: SampleFund): number {
  return f.loss - predictOlsLoss(model, f.yield, f.vix);
}

export function isAShare(name: string): boolean {
  return /(?:人民币|美元)?A$/.test(name);
}

export function fundStem(name: string): string {
  return name.replace(/(?:人民币|美元)?[ACEIHB]$/, '');
}

export function buyable(f: SampleFund): boolean {
  return f.quota < 0 || f.quota >= 1000;
}

/** 官网优质精选条件 */
export function isRecommend(f: SampleFund): boolean {
  const t = f.type === '指数型' || (f.inst ?? 0) >= 50;
  const n = f.type === '货币型' || Math.round(f.rating) === 5;
  const r = f.scale > 10;
  const i = f.yield > Math.abs(f.loss);
  return t && n && r && i && buyable(f);
}

export function riskProfile(maxLoss: number): { label: string; risk: string } {
  const t = Math.abs(maxLoss);
  if (t <= 1) return { label: '保守型', risk: '低风险' };
  if (t <= 3) return { label: '稳健型', risk: '中低风险' };
  if (t <= 5) return { label: '平衡型', risk: '中风险' };
  if (t <= 15) return { label: '积极型', risk: '中高风险' };
  return { label: '激进型', risk: '高风险' };
}

export function matchPortfolio(funds: SampleFund[], maxLoss: number): SampleFund[] {
  const picked = new Map<string, { f: SampleFund; isA: boolean }>();
  for (const f of funds) {
    if (!buyable(f)) continue;
    if (Math.abs(f.loss) > maxLoss) continue;
    const key = fundStem(f.name);
    const isA = isAShare(f.name);
    const prev = picked.get(key);
    if (!prev || (!prev.isA && isA)) picked.set(key, { f, isA });
  }
  return [...picked.values()].map((x) => x.f);
}

export function portfolioStats(funds: SampleFund[]) {
  const avg = (pick: (f: SampleFund) => number | null | undefined) => {
    const xs = funds.map(pick).filter((v): v is number => v != null && Number.isFinite(v));
    if (!xs.length) return 0;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  };
  return {
    yield: avg((f) => f.yield),
    vix: avg((f) => f.vix),
    loss: avg((f) => f.loss),
    ret1y: avg((f) => f.ret1y),
    inst: avg((f) => f.inst),
    shares: avg((f) => f.shares),
    bonds: avg((f) => f.bonds),
    cash: avg((f) => f.cash),
  };
}

export const FUND_TYPES = TYPES;

let sampleCache: SampleFund[] | null = null;
let modelCache: FundModel | null = null;

function publicUrl(file: string): string {
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL || '/';
  return `${base.endsWith('/') ? base : `${base}/`}${file}`;
}

export async function loadSample(): Promise<SampleFund[]> {
  if (sampleCache) return sampleCache;
  const res = await fetch(publicUrl('fund-statistical.csv'));
  if (!res.ok) throw new Error('全样本未就绪，请先 npm run fit:funds');
  sampleCache = parseStatisticalCsv(await res.text());
  return sampleCache;
}

export async function loadFundModel(): Promise<FundModel> {
  if (modelCache) return modelCache;
  const res = await fetch(publicUrl('fund-model.json'));
  if (!res.ok) throw new Error('模型未就绪，请先 npm run fit:funds');
  modelCache = (await res.json()) as FundModel;
  return modelCache;
}
