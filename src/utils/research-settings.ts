/**
 * 研判参数：分位档位线、仓位建议、晨会模型。
 *
 * 这三样是随市场 regime 变的判断，不是常数。写死在代码里意味着改一个数字也要
 * npm run build + 上传 + 重启容器，客户端 hash 全变、所有人重新下载。
 *
 * 存 localStorage（每设备一份）：这类偏好不值得为它引入一次 /sync 异步往返，
 * 而设置又是渲染路径上的东西 —— 同步读比异步读少一整类「首屏闪一下默认值」的 bug。
 * 哪天要跨设备，把 read/persist 换成 market-cache，其他代码不用动。
 *
 * 代价要认：读代码看到 20 不再等于「当前生效值是 20」。所以 isBandOverridden()
 * 让界面显式标出「已改动」，配合 resetBands() 一键回默认 —— 不标出来，
 * 下次排查「为什么显示偏高」时会先怀疑代码、实际是设置。
 */
import { computed, ref } from 'vue';

export interface ValuationBand {
  /** 分位上限（不含）。最后一档忽略，它天然兜住 100。 */
  max: number;
  /** 展示名，如「偏低」「中性」 */
  label: string;
  /** 仓位建议，如「+10% ~ +15%」 */
  tilt: string;
}

export const BAND_COUNT = 5;

export const DEFAULT_BANDS: ValuationBand[] = [
  { max: 20, label: '偏低', tilt: '+10% ~ +15%' },
  { max: 40, label: '偏低', tilt: '+5% ~ +10%' },
  { max: 60, label: '中性', tilt: '标配 (0%)' },
  { max: 80, label: '偏高', tilt: '-5% ~ -10%' },
  { max: 100, label: '偏高', tilt: '-10% ~ -20%' },
];

export const DEFAULT_MODEL = 'gemini-3.8-flash-high';

const KEY = 'research-settings-v1';

interface Stored {
  bands?: ValuationBand[];
  model?: string;
}

function read(): Stored {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Stored) : {};
  } catch {
    return {};
  }
}

const state = ref<Stored>(read());

function persist() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state.value));
  } catch {
    /* 隐私模式/配额满：设置失效但界面仍按内存里的值走 */
  }
}

/**
 * 把任意输入洗成 5 档合法配置。
 * 坏的输入不抛错也不静默丢弃 —— 逐档回落到默认值，保证估值表永远有 5 档可用。
 */
export function normalizeBands(input: unknown): ValuationBand[] {
  const src: unknown[] = Array.isArray(input) ? input : [];
  const out: ValuationBand[] = [];
  let prev = 0;
  for (let i = 0; i < BAND_COUNT; i++) {
    const def = DEFAULT_BANDS[i]!;
    const raw = (src[i] ?? {}) as Partial<ValuationBand>;

    const label = typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim() : def.label;
    const tilt = typeof raw.tilt === 'string' && raw.tilt.trim() ? raw.tilt.trim() : def.tilt;

    let max = def.max;
    const n = Number(raw.max);
    if (Number.isFinite(n)) max = Math.round(n);

    if (i === BAND_COUNT - 1) {
      max = 100; // 最后一档兜底，不可改
    } else {
      // 必须严格递增：两档同一条线会让中间那档永远不可达
      max = Math.min(Math.max(max, prev + 1), 100 - (BAND_COUNT - 1 - i));
      prev = max;
    }
    out.push({ max, label, tilt });
  }
  return out;
}

/** 当前生效的 5 档。 */
export const bands = computed<ValuationBand[]>(() => normalizeBands(state.value.bands));

/** 当前生效的晨会模型。 */
export const briefingModel = computed<string>(() => {
  const m = state.value.model;
  return typeof m === 'string' && m.trim() ? m.trim() : DEFAULT_MODEL;
});

export function saveBands(next: ValuationBand[]) {
  state.value = { ...state.value, bands: normalizeBands(next) };
  persist();
}

export function saveModel(model: string) {
  state.value = { ...state.value, model: model.trim() };
  persist();
}

export function resetBands() {
  const { bands: _drop, ...rest } = state.value;
  state.value = rest;
  persist();
}

export function resetModel() {
  const { model: _drop, ...rest } = state.value;
  state.value = rest;
  persist();
}

/** 第 idx 档是否被改过（用于界面标「已改」）。 */
export function isBandOverridden(idx: number): boolean {
  const cur = bands.value[idx];
  const def = DEFAULT_BANDS[idx];
  if (!cur || !def) return false;
  return cur.max !== def.max || cur.label !== def.label || cur.tilt !== def.tilt;
}

export function isBandsOverridden(): boolean {
  return DEFAULT_BANDS.some((_, i) => isBandOverridden(i));
}

export function isModelOverridden(): boolean {
  return briefingModel.value !== DEFAULT_MODEL;
}
