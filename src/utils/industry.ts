import type { IndustryFocus } from '@/types/invest';

import { CATALYST_TTL_MS, marketGet, marketPut } from './market-cache';

/**
 * 题材板块到对应场内主流 ETF 的映射字典
 */
const ETF_MAP: Record<string, { code: string; name: string }> = {
  光通信: { code: '515050', name: '5GETF' },
  '6G': { code: '515050', name: '5GETF' },
  通信: { code: '515050', name: '5GETF' },
  国产芯片: { code: '512760', name: '半导体ETF' },
  芯片: { code: '512760', name: '半导体ETF' },
  半导体: { code: '512480', name: '半导体设备ETF' },
  液冷服务器: { code: '515880', name: '通信ETF' },
  机器人: { code: '562500', name: '机器人ETF' },
  大农业: { code: '159825', name: '农业ETF' },
  农业: { code: '159825', name: '农业ETF' },
  医药: { code: '512010', name: '医药ETF' },
  创新药: { code: '159992', name: '创新药ETF' },
  传媒: { code: '512980', name: '传媒ETF' },
  房地产: { code: '512200', name: '房地产ETF' },
  大消费: { code: '515170', name: '食品饮料ETF' },
  消费: { code: '510150', name: '消费ETF' },
  有色金属: { code: '512400', name: '有色金属ETF' },
  石油化工: { code: '159930', name: '能源ETF' },
  油服: { code: '159930', name: '能源ETF' },
  银行: { code: '512800', name: '银行ETF' },
  券商: { code: '512000', name: '券商ETF' },
  '短剧/互动影游': { code: '516010', name: '游戏ETF' },
};

export function inferIndustryCategory(name: string): '科技制造' | '医药消费' | '周期资源' | '金融地产' | '综合主题' {
  if (/光通信|液冷|芯片|半导体|AI|算力|机器人|6G|通信|服务器|电子|软硬件|信息|智能/.test(name)) return '科技制造';
  if (/医药|生物|创新药|医疗|消费|食品|白酒|家电|传媒|短剧|影游|零售|文娱/.test(name)) return '医药消费';
  if (/有色|金属|铜|铝|黄金|石油|化工|油服|煤炭|能源|农业|大农业|农牧|资源|电力|钢铁/.test(name)) return '周期资源';
  if (/银行|券商|保险|地产|房地产|金融/.test(name)) return '金融地产';
  return '综合主题';
}

function inferCycleStage(limitUpCount: number, changeRate: number): string {
  if (limitUpCount >= 5 || changeRate >= 2.5) return '爆发主升';
  if (changeRate >= 1.0) return '景气上行';
  if (limitUpCount >= 1) return '政策催化';
  if (changeRate <= -1.5) return '超跌反弹';
  return '趋势轮动';
}

interface XuangubaoPlateItem {
  id: number;
  name: string;
  description?: string;
}

interface XuangubaoPlateDetail {
  plate_id: number;
  plate_name?: string;
  fund_flow?: number;
  rise_count?: number;
  fall_count?: number;
  limit_up_count?: number;
  core_avg_pcp?: number;
  top_n_stocks?: {
    items?: Array<{
      symbol: string;
      stock_chi_name: string;
      change_percent?: number;
      price_change?: number;
    }>;
  };
}

/**
 * 实时从选股宝 / 核心题材库采集产业风口与重大催化信息
 */
export async function fetchLiveIndustryCatalysts(): Promise<IndustryFocus[]> {
  const hit = await marketGet<IndustryFocus[]>('invest-xgb:plates', CATALYST_TTL_MS);
  if (hit?.length) return hit;
  try {
    const res = await fetch('/xgb/api/surge_stock/plates', {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const items: XuangubaoPlateItem[] = json?.data?.items || [];

    // 过滤掉占位或无催化说明的板块
    const validItems = items.filter(
      (item) => item.id && item.id > 0 && item.description && item.description.trim() !== '',
    );

    if (!validItems.length) return [];

    // 批量抓取前 15 个核心题材板块的行情与领涨标的
    const targetItems = validItems.slice(0, 15);
    const pids = targetItems.map((i) => i.id).join(',');
    const detailUrl = `/xgb/api/plate/data?plates=${pids}&fields=plate_id,plate_name,fund_flow,rise_count,fall_count,limit_up_count,core_avg_pcp,top_n_stocks`;

    let detailsMap: Record<string, XuangubaoPlateDetail> = {};
    try {
      const detailRes = await fetch(detailUrl, {
        headers: { Accept: 'application/json' },
      });
      if (detailRes.ok) {
        const detailJson = await detailRes.json();
        detailsMap = detailJson?.data || {};
      }
    } catch (err) {
      console.warn('Failed to fetch plate details, using basic info', err);
    }

    const now = new Date();
    const timeStr = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const list: IndustryFocus[] = targetItems.map((item) => {
      const detail = detailsMap[String(item.id)] || {};
      const name = detail.plate_name || item.name;
      const changeRate = Number(((detail.core_avg_pcp || 0) * 100).toFixed(2));
      const limitUpCount = detail.limit_up_count || 0;
      const cycleStage = inferCycleStage(limitUpCount, changeRate);

      // 计算热度分 (55 - 98)
      let heat = 60 + limitUpCount * 4 + Math.round(changeRate * 3);
      if (heat > 98) heat = 98;
      if (heat < 55) heat = 55;

      const trend: 'up' | 'stable' | 'down' =
        changeRate > 0.5 || limitUpCount >= 2 ? 'up' : changeRate < -1.0 && limitUpCount === 0 ? 'down' : 'stable';

      const keyTargets: Array<{
        code: string;
        name: string;
        type: 'ETF' | '个股';
        changePercent?: number;
      }> = [];

      // 提取领涨个股
      const stocks = detail.top_n_stocks?.items || [];
      stocks.slice(0, 3).forEach((st) => {
        const cleanCode = st.symbol ? st.symbol.replace(/\.(SZ|SH|SS|BJ)$/i, '') : '';
        if (cleanCode && st.stock_chi_name) {
          keyTargets.push({
            code: cleanCode,
            name: st.stock_chi_name,
            type: '个股',
            changePercent: st.change_percent != null ? Number((st.change_percent * 100).toFixed(2)) : undefined,
          });
        }
      });

      // 匹配对应行业 ETF
      const matchedEtf = ETF_MAP[name];
      if (matchedEtf && !keyTargets.some((t) => t.code === matchedEtf.code)) {
        keyTargets.push({
          code: matchedEtf.code,
          name: matchedEtf.name,
          type: 'ETF',
        });
      }

      const category = inferIndustryCategory(name);
      const isTech = category === '科技制造';

      return {
        id: `plate_${item.id}`,
        name,
        cycleStage,
        heat,
        trend,
        catalyst: item.description || '',
        category,
        keyTargets,
        tactic: '',
        account: isTech ? 'stock' : 'all',
        updatedAt: timeStr,
        source: '选股宝实时题材',
        changeRate,
        limitUpCount,
        riseCount: detail.rise_count || 0,
        fallCount: detail.fall_count || 0,
        fundFlow: detail.fund_flow || 0,
      };
    });

    if (list.length) marketPut('invest-xgb:plates', list, CATALYST_TTL_MS);
    return list;
  } catch (err) {
    throw err instanceof Error ? err : new Error('选股宝板块异动拉取失败');
  }
}
