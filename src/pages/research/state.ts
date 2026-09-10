import { ref } from 'vue';

import { useInvestStore } from '@/store';
import type { DailyBriefing } from '@/types/invest';
import { allocation } from '@/utils/book';
import { readCachedBriefing } from '@/utils/briefing';
import { todayCN } from '@/utils/date';
import { bareCode, fetchSwClass, swGroupOf } from '@/utils/sw-industry';
import type { PctDelta } from '@/utils/val-history';
import { deltasFor, recordPctSnapshot } from '@/utils/val-history';
import type { IndexValuationItem } from '@/utils/valuation';
import { fetchIndexValuations } from '@/utils/valuation';

export const bargainCount = ref(0);
export const macroState = ref<'never' | 'loading' | 'ok' | 'error'>('never');
export const valuationItems = ref<IndexValuationItem[]>([]);

/** 各标的近一月分位变化（正 = 变贵）。历史不足 10 天的标的不在此表中。 */
export const valuationDeltas = ref<Record<string, PctDelta>>({});

/**
 * 股票仓内各申万一级行业占比(%)，键与估值行名称一致（如「农林牧渔」）。
 * 估值表用它标「持仓」，晨报把它喂给 LLM —— 没有这个数字，模型分不清
 * 「低估但空仓」和「低估但已经超配」，只能复述分位。
 */
export const heldIndustryWeights = ref<Record<string, number>>({});

let valuationInflight: Promise<void> | null = null;

/** 记录当日分位快照并刷新方向表。纯自积累：攒够 MIN_SPAN_DAYS 天才有方向可看。 */
async function stampValuationDeltas() {
  const list = valuationItems.value;
  if (!list.length) return;
  const day = todayCN();
  const hist = await recordPctSnapshot(day, list).catch(() => null);
  if (hist) {
    valuationDeltas.value = deltasFor(
      hist,
      day,
      list.map((i) => i.name),
    );
  }
}

export async function ensureValuations(force = false) {
  if (!force && valuationItems.value.length) {
    // 已有估值时只补方向，不重复打接口
    if (!Object.keys(valuationDeltas.value).length) void stampValuationDeltas();
    return;
  }
  if (!force && valuationInflight) return valuationInflight;
  valuationInflight = (async () => {
    try {
      const list = await fetchIndexValuations(force);
      valuationItems.value = list;
      bargainCount.value = list.filter((v) => v.pePercentile < 40).length;
      await stampValuationDeltas();
    } finally {
      valuationInflight = null;
    }
  })();
  return valuationInflight;
}

/** 拉取持仓的申万一级归属并算出各行业占比。上游失败则不标持仓，不阻塞估值。 */
export async function ensureHeldIndustryWeights() {
  // 按账户性质取，不是按 id：注册表里叫什么都不影响这里
  const rows = useInvestStore().rowsByKind('stock');
  if (!rows.length) {
    heldIndustryWeights.value = {};
    return;
  }
  try {
    const sw = await fetchSwClass(rows.map((h) => h.code));
    // 未归类到申万一级的持仓不参与占比，否则会凭空多出一个「未知」行业
    const known = rows.filter((r) => sw[bareCode(r.code)]);
    if (!known.length) {
      heldIndustryWeights.value = {};
      return;
    }
    const out: Record<string, number> = {};
    for (const a of allocation(known, 0, [], (p) => swGroupOf(p, sw, 'l1'))) {
      if (a.pct > 0) out[a.name] = Math.round(a.pct * 1000) / 10;
    }
    heldIndustryWeights.value = out;
  } catch {
    /* 上游失败就不标持仓 */
  }
}

export const briefing = ref<DailyBriefing | null>(null);
export const briefingStatus = ref<'idle' | 'loading' | 'ready' | 'fail'>('idle');

if (typeof localStorage !== 'undefined') {
  const cached = readCachedBriefing(localStorage, todayCN());
  if (cached) {
    briefing.value = cached;
    briefingStatus.value = 'ready';
  }
}
