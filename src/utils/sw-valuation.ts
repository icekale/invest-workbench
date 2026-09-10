/** 乐咕乐股申万一级 PE/分位。HTML 切片，无官方 JSON。 */
import { fetchOk, withRetry } from './http.ts';
import { marketGet, marketPut } from './market-cache.ts';

export interface SwL1Row {
  code: string;
  name: string;
  count: number;
  pe: number;
  pePercentile: number;
  pb: number;
  pbPercentile: number;
  dividendYield: number;
}

function numAfter(chunk: string, marker: string): number {
  const i = chunk.indexOf(marker);
  if (i < 0) return 0;
  const m = chunk.slice(i + marker.length).match(/([\d.]+)%/);
  return m ? Number(m[1]) : 0;
}

export function parseSwL1Html(html: string): SwL1Row[] {
  const start = html.indexOf('id="level1Items"');
  const end = html.indexOf('id="level2Items"');
  const block = start >= 0 ? html.slice(start, end > start ? end : undefined) : html;
  const rows: SwL1Row[] = [];
  const idRe = /id="(80\d{4}\.SI)"/g;
  const ids: { code: string; at: number }[] = [];
  for (const m of block.matchAll(idRe)) ids.push({ code: m[1], at: m.index ?? 0 });
  for (let k = 0; k < ids.length; k++) {
    const chunk = block.slice(ids[k].at, ids[k + 1]?.at);
    const nameI = chunk.indexOf('lg-industries-item-number">');
    const nameChunk = nameI < 0 ? '' : chunk.slice(nameI + 27, nameI + 80);
    const nameM = nameChunk.match(/^([^<(]+)\((\d+)\)/);
    const values: string[] = [];
    let from = 0;
    while (values.length < 4) {
      const vi = chunk.indexOf('class="value">', from);
      if (vi < 0) break;
      const gt = chunk.indexOf('<', vi + 14);
      values.push(chunk.slice(vi + 14, gt < 0 ? undefined : gt).trim());
      from = vi + 14;
    }
    if (!nameM || values.length < 2) continue;
    rows.push({
      code: ids[k].code,
      name: nameM[1].trim(),
      count: Number(nameM[2]) || 0,
      pe: Number(values[1]) || 0,
      pePercentile: numAfter(chunk, 'peTtmQuantile">'),
      pb: Number(values[2]) || 0,
      pbPercentile: numAfter(chunk, 'pbQuantile">'),
      dividendYield: Number(values[3]) || 0,
    });
  }
  return rows;
}

export function isSwL1(item: { code: string }): boolean {
  return item.code.endsWith('.SI');
}

/**
 * 源页面约 1.17MB，而 31 行结果只有约 2KB，所以缓存的是解析后的结果而非 HTML。
 * 走项目既有的服务端缓存（/sync/cache，默认 TTL 6h），跨刷新/跨设备都命中；
 * 无同步凭据时 marketGet 退化为内存缓存，仍可正常工作。
 */
const SW_L1_CACHE_KEY = 'sw-l1-pe-v1';

export async function fetchSwL1Rows(force = false): Promise<SwL1Row[]> {
  if (!force) {
    const hit = await marketGet<SwL1Row[]>(SW_L1_CACHE_KEY);
    if (hit && hit.length >= 20) return hit;
  }
  const res = await withRetry(() =>
    fetchOk('/legulegu/stockdata/sw-industry-overview', {
      signal: AbortSignal.timeout(15000),
      headers: { Accept: 'text/html' },
    }),
  );
  const rows = parseSwL1Html(await res.text());
  if (rows.length < 20) throw new Error(`申万一级条数不足: ${rows.length}`);
  marketPut(SW_L1_CACHE_KEY, rows);
  return rows;
}
