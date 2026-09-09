import type { MacroBrief } from '@/types/invest';

import { fetchOk, withRetry } from './http.ts';

const LIVE_URL = 'https://api-one-wscn.awtmt.com/apiv1/content/lives/pc?channel=global-channel&limit=30';
const STRONG = /央行|CPI|PPI|PMI|社融|LPR|降准|降息|MLF|逆回购|政治局|国务院|FOMC|非农|GDP|M2|社零|SHIBOR|国债|财政/;
const SKIP = /早餐|提醒：日内请重点关注/;

interface WscnLiveItem {
  id: number;
  title?: string;
  content?: string;
  content_text?: string;
  display_time?: number;
  score?: number;
}

export function stripHtml(html: string) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function inferBriefTopic(text: string): string {
  if (/美联储|FOMC|非农|美元|欧央行|鲍威尔|海外|纳指|标普/.test(text)) return '海外';
  if (/逆回购|MLF|LPR|降准|降息|SHIBOR|资金面|M2|社融|流动性/.test(text)) return '流动性';
  if (/政治局|国务院|财政|两会|规划|政策/.test(text)) return '政策';
  return '增长';
}

export function inferBriefTone(text: string): string {
  if (/降准|降息|加码|超预期|回升|宽松|好于预期/.test(text)) return '利多';
  if (/加息|收紧|不及预期|下滑|风险|地缘|制裁/.test(text)) return '警惕';
  return '中性';
}

export function toMacroBrief(item: WscnLiveItem): MacroBrief | null {
  const body = stripHtml(item.content_text || item.content || '');
  const title = (item.title || '').trim() || body.slice(0, 36);
  if (!title || body.length < 8) return null;
  const blob = `${title} ${body}`;
  if (SKIP.test(blob)) return null;
  if ((item.score || 0) < 2 && !STRONG.test(blob)) return null;

  const ts = item.display_time ? item.display_time * 1000 : Date.now();
  const d = new Date(ts);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  return {
    id: `live_${item.id}`,
    time,
    title: title.slice(0, 48),
    body: body.slice(0, 220),
    topic: inferBriefTopic(blob),
    tone: inferBriefTone(blob),
    account: 'all',
  };
}

export function parseLiveBriefs(payload: unknown): MacroBrief[] {
  const data = (payload as { data?: Record<string, { items?: WscnLiveItem[] }> })?.data || {};
  const seen = new Set<number>();
  const out: MacroBrief[] = [];
  for (const ch of ['a_stock', 'global', 'forex', 'commodity']) {
    for (const it of data[ch]?.items || []) {
      if (!it?.id || seen.has(it.id)) continue;
      const row = toMacroBrief(it);
      if (!row) continue;
      seen.add(it.id);
      out.push(row);
      if (out.length >= 15) return out;
    }
  }
  return out;
}

export async function fetchLiveMacroBriefs(): Promise<MacroBrief[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await withRetry(() => fetchOk(LIVE_URL, { signal: controller.signal }));
    return parseLiveBriefs(await res.json());
  } finally {
    clearTimeout(timer);
  }
}
