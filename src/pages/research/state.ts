import { ref } from 'vue';

import type { DailyBriefing } from '@/types/invest';
import { readCachedBriefing } from '@/utils/briefing';
import { todayCN } from '@/utils/date';
import type { IndexValuationItem } from '@/utils/valuation';

export const bargainCount = ref(0);
export const macroState = ref<'never' | 'loading' | 'ok' | 'error'>('never');
export const valuationItems = ref<IndexValuationItem[]>([]);
export const briefing = ref<DailyBriefing | null>(null);
export const briefingStatus = ref<'idle' | 'loading' | 'ready' | 'fail'>('idle');

if (typeof localStorage !== 'undefined') {
  const cached = readCachedBriefing(localStorage, todayCN());
  if (cached) {
    briefing.value = cached;
    briefingStatus.value = 'ready';
  }
}
