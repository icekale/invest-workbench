import { ref } from 'vue';

import type { DailyBriefing } from '@/types/invest';
import { readCachedBriefing } from '@/utils/briefing';
import { todayCN } from '@/utils/date';
import type { IndexValuationItem } from '@/utils/valuation';
import { fetchIndexValuations } from '@/utils/valuation';

export const bargainCount = ref(0);
export const macroState = ref<'never' | 'loading' | 'ok' | 'error'>('never');
export const valuationItems = ref<IndexValuationItem[]>([]);

let valuationInflight: Promise<void> | null = null;

export async function ensureValuations(force = false) {
  if (!force && valuationItems.value.length) return;
  if (!force && valuationInflight) return valuationInflight;
  valuationInflight = (async () => {
    try {
      const list = await fetchIndexValuations();
      valuationItems.value = list;
      bargainCount.value = list.filter((v) => v.pePercentile < 40).length;
    } finally {
      valuationInflight = null;
    }
  })();
  return valuationInflight;
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
