import type { MacroEvent } from '@/types/invest';

import { todayCN } from './date';
import { fetchOk, withRetry } from './http.ts';
import { CATALYST_TTL_MS, marketGet, marketPut } from './market-cache';

/**
 * 解析会议或日程的准确时间戳（毫秒）
 * 兼容 "YYYY-MM-DD" 与 "MM-DD" 格式，自动处理跨年逻辑
 */
export function parseEventTimestamp(dateStr: string): number {
  if (!dateStr || typeof dateStr !== 'string') return 0;
  const now = new Date();
  const currentYear = now.getFullYear();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return new Date(`${dateStr.slice(0, 10)}T00:00:00`).getTime();
  }

  // MM-DD
  const parts = dateStr.match(/^(\d{1,2})-(\d{1,2})/);
  if (parts) {
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    const currentMonth = now.getMonth() + 1;
    // 如果当前为9~12月，但会议为1~3月，则归入下一年
    const year = currentMonth >= 9 && month <= 3 ? currentYear + 1 : currentYear;
    return new Date(year, month - 1, day).getTime();
  }

  return 0;
}

/**
 * 计算事件距离当天的倒计时或已过去天数
 */
export function getEventCountdown(dateStr: string): {
  label: string;
  diffDays: number;
  isPast: boolean;
  urgent: boolean;
} {
  const ts = parseEventTimestamp(dateStr);
  if (!ts) {
    return { label: dateStr || '近期', diffDays: 0, isPast: false, urgent: false };
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffTime = ts - todayStart;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return { label: '今日召开', diffDays: 0, isPast: false, urgent: true };
  }
  if (diffDays === 1) {
    return { label: '明日召开', diffDays: 1, isPast: false, urgent: true };
  }
  if (diffDays > 1) {
    return {
      label: `${diffDays}天后`,
      diffDays,
      isPast: false,
      urgent: diffDays <= 3,
    };
  }
  if (diffDays === -1) {
    return { label: '昨日已召开', diffDays: -1, isPast: true, urgent: false };
  }
  return {
    label: `已结束 (${Math.abs(diffDays)}天前)`,
    diffDays,
    isPast: true,
    urgent: false,
  };
}

/**
 * 重点会议与事件智能排序：
 * 1. 即将召开的日程排在最前面，按离今天最近（今日 -> 明日 -> 2天后...）升序排列
 * 2. 已结束的历史日程沉底，按时间从近到远降序排列
 */
export function sortMacroEvents(events: MacroEvent[]): MacroEvent[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const upcoming: Array<{ ev: MacroEvent; ts: number }> = [];
  const past: Array<{ ev: MacroEvent; ts: number }> = [];

  for (const ev of events) {
    const ts = parseEventTimestamp(ev.date);
    if (ts >= todayStart) {
      upcoming.push({ ev, ts });
    } else {
      past.push({ ev, ts });
    }
  }

  // 即将到来的事件：越近的排越前
  upcoming.sort((a, b) => a.ts - b.ts);
  // 已过去的事件：越近过去的排越前，较久远的垫底
  past.sort((a, b) => b.ts - a.ts);

  return [...upcoming.map((x) => x.ev), ...past.map((x) => x.ev)];
}

const KEY_TOPIC_REGEX =
  /CPI|PPI|PMI|LPR|社融|非农|GDP|发布会|峰会|大会|论坛|国债|央行|联储|政治局|苹果|台积电|财报|博览会|服贸会|外滩大会|一带一路|进博会|降准|降息|特斯拉|英伟达|华为|中特估|人形机器人|算力|低空经济/;

function inferCategory(title: string, country?: string): string {
  if (/央行|联储|议息|鲍威尔|拉加德|利率决议|加息|降息/.test(title)) return '海外央行';
  if (/大会|峰会|论坛|发布会|博览会|展会|交易会|年会/.test(title)) return '产业峰会';
  if (/CPI|PPI|PMI|GDP|社融|零售|就业|非农|失业率|进出口|贸易帐|M2/.test(title)) return '宏观数据';
  if (/国债|利率|LPR|降准|逆回购|MLF|特别国债|货币/.test(title)) return '货币金融';
  if (/政治局|国务院|改革|政策|部委|法案|预算|规划/.test(title)) return '宏观政策';
  return country === '中国' ? '宏观政策' : '全球视野';
}

function inferLevel(importance: number, title: string): '重大' | '关键' | '关注' {
  if (
    importance >= 4 ||
    /政治局|国务院|中央经济工作|两会|全会|美联储|FOMC|利率决议|降准|降息|LPR|CPI|GDP|非农/.test(title) ||
    /苹果.*发布会|英伟达.*GTC/.test(title)
  ) {
    return '重大';
  }
  if (
    importance >= 3 ||
    /PPI|PMI|社融|M2|贸易帐|进出口|国债|特别国债|外滩大会|服贸会|进博会|峰会|大会|发布会|财报|台积电/.test(title)
  ) {
    return '关键';
  }
  return '关注';
}

function inferBeneficiaries(title: string): string[] {
  const list: string[] = [];
  if (/CPI|PPI|零售|消费/.test(title)) list.push('消费ETF', '顺周期龙头');
  if (/国债|特别国债|LPR|降息|货币/.test(title)) list.push('红利低波ETF', '银行ETF');
  if (/外滩大会|人工智能|AI|大模型|Inclusion|算力/.test(title)) list.push('人工智能ETF', '科创50', '算力龙头');
  if (/一带一路|基建/.test(title)) list.push('中字头央企', '工程机械');
  if (/服贸会|进博会|贸易/.test(title)) list.push('跨境电商', '物流龙头');
  if (/苹果|发布会|iPhone|消费电子/.test(title)) list.push('消费电子', '立讯精密', '电子ETF');
  if (/太空|卫星|SpaceX|航天/.test(title)) list.push('卫星互联网', '军工ETF');
  if (/半导体|台积电|芯片/.test(title)) list.push('半导体ETF', '芯片龙头');
  if (/美联储|美元|外围|海外/.test(title)) list.push('恒生科技ETF', '黄金ETF');
  if (/车|新能源|电池|特斯拉/.test(title)) list.push('新能源车ETF', '电池龙头');

  return list.slice(0, 3);
}

/**
 * 实时从华尔街见闻公共财经日历与大事接口抓取近期重点会议与宏观事件
 */
function shanghaiDayStartUnix() {
  return Math.floor(new Date(`${todayCN()}T00:00:00+08:00`).getTime() / 1000);
}

async function fetchMacrodatas(start: number, end: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    return await fetchOk(`/wscn/apiv1/finance/macrodatas?start=${start}&end=${end}`, {
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchLiveMacroEvents(days = 30, force = false): Promise<MacroEvent[]> {
  const cacheKey = `invest-wscn:events:v3:${days}`;
  const hit = await marketGet<MacroEvent[]>(cacheKey, CATALYST_TTL_MS, force);
  if (hit?.length) return hit;
  const start = shanghaiDayStartUnix();
  const end = start + 86400 * Math.max(7, days);

  try {
    const res = await withRetry(() => fetchMacrodatas(start, end));
    const json = await res.json();
    interface RawItem {
      id: number;
      title?: string;
      public_date?: number;
      importance?: number;
      calendar_type?: string;
      country?: string;
    }
    const items: RawItem[] = json?.data?.items || [];
    const results: MacroEvent[] = [];
    const seenTitles = new Set<string>();

    for (const it of items) {
      const title = (it.title || '').trim();
      if (!title || seenTitles.has(title) || !it.public_date) continue;

      const imp = it.importance || 1;
      const isFE = it.calendar_type === 'FE';
      const hasKw = KEY_TOPIC_REGEX.test(title);

      // 仅收录高信号事件（会议事件且权重>=2，或含高关注关键词）
      if ((isFE && imp >= 2) || (hasKw && imp >= 2) || imp >= 3) {
        seenTitles.add(title);
        const d = new Date(it.public_date * 1000);
        const dateStr = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        const country = (it.country || '').trim();
        results.push({
          id: `wscn_${it.id}`,
          date: dateStr,
          title,
          category: inferCategory(title, it.country),
          level: inferLevel(imp, title),
          impact: country ? `${country} · ${title}` : title,
          beneficiaries: inferBeneficiaries(title),
          account: 'all',
        });
      }
    }

    const rows = results.slice(0, 40);
    if (rows.length) marketPut(cacheKey, rows, CATALYST_TTL_MS);
    return rows;
  } catch (err) {
    throw err instanceof Error ? err : new Error('华尔街见闻宏观日历拉取失败');
  }
}
