<template>
  <t-dialog
    v-model:visible="visible"
    header="从持仓截图导入"
    width="min(1000px, 96vw)"
    :footer="false"
    :close-on-overlay-click="false"
    @closed="resetAll"
  >
    <!-- 第一步：选账户 + 选图 -->
    <div class="ocr-pick">
      <div class="ocr-row">
        <span class="ocr-label">导入到</span>
        <t-radio-group v-model="account" variant="default-filled" size="small">
          <t-radio-button v-for="a in invest.activeAccounts" :key="a.id" :value="a.id">{{ a.name }}</t-radio-button>
        </t-radio-group>
        <span class="ocr-hint">截图里是哪个账户的持仓，就选哪个</span>
      </div>

      <div class="ocr-row">
        <span class="ocr-label">识别方式</span>
        <t-radio-group v-model="engine" variant="default-filled" size="small" :disabled="busy">
          <t-radio-button value="local">本地识别</t-radio-button>
          <t-radio-button value="vision">视觉模型</t-radio-button>
        </t-radio-group>
        <span class="ocr-hint">
          {{ engine === 'local' ? '在本机跑，截图不出浏览器' : `兜底用，截图会发到 ${visionModels.primary}` }}
        </span>
      </div>

      <!-- 投放区：点击选择 / 拖进来 / 直接粘贴 -->
      <div
        class="ocr-drop"
        :class="{ 'ocr-drop--over': dragOver, 'ocr-drop--busy': busy }"
        @click="pick"
        @dragover.prevent="dragOver = true"
        @dragleave.prevent="dragOver = false"
        @drop.prevent="onDrop"
      >
        <input ref="fileRef" type="file" accept="image/*" style="display: none" @change="onPick" />
        <template v-if="!file">
          <t-icon name="upload" size="28px" />
          <div class="ocr-drop__main">点击选择截图，或拖进来，或直接 Ctrl/⌘+V 粘贴</div>
          <div class="ocr-drop__sub">同花顺/券商 App 的「持仓」页整屏截图最准，记得把表头一起截进去</div>
        </template>
        <template v-else>
          <img :src="previewUrl" class="ocr-drop__thumb" alt="待识别截图" />
          <div class="ocr-drop__meta">
            <div class="ocr-drop__main">{{ file.name || '剪贴板图片' }}</div>
            <div class="ocr-drop__sub">{{ (file.size / 1024).toFixed(0) }} KB · 点这里换一张</div>
          </div>
        </template>
      </div>

      <t-alert v-if="error" theme="error" :message="error" class="ocr-alert" />

      <div class="ocr-actions">
        <t-button theme="primary" :loading="busy" :disabled="!file || busy" @click="run">
          <template #icon><t-icon name="scan" /></template>
          开始识别
        </t-button>
        <span v-if="busy" class="ocr-hint">{{ progressText }}</span>
      </div>
    </div>

    <!-- 第二步：预览 + 校验 -->
    <template v-if="checked.length || note">
      <t-divider>识别结果</t-divider>

      <div class="ocr-summary">
        <t-tag theme="primary" variant="light">共 {{ checked.length }} 行</t-tag>
        <t-tag v-if="okCount" theme="success" variant="light">{{ okCount }} 行可直接导入</t-tag>
        <t-tag v-if="warnCount" theme="warning" variant="light">{{ warnCount }} 行需核对</t-tag>
        <t-tag v-if="errCount" theme="danger" variant="light">{{ errCount }} 行缺数据</t-tag>
        <span class="ocr-hint">{{ note }}</span>
      </div>

      <t-alert
        v-if="engine === 'vision'"
        theme="warning"
        message="视觉模型在清晰截图上与本地识别同样准，但图一模糊就会编造出行。请逐行对着截图核对代码与数量。"
        class="ocr-alert"
      />

      <div class="table-wrap">
        <t-table
          :data="checked"
          :columns="columns"
          row-key="key"
          size="small"
          :pagination="undefined"
          table-layout="auto"
        >
          <template #state="{ row }">
            <t-tag size="small" :theme="stateTheme(levelOf(row))" variant="light">{{ stateText(levelOf(row)) }}</t-tag>
          </template>
          <template #codeCell="{ row }">
            <div class="dual-cell">
              <div class="dual-cell__main">{{ row.name }}</div>
              <div class="dual-cell__sub">{{ row.code }}</div>
            </div>
          </template>
          <template #qtyCell="{ row }">
            <t-input-number v-model="row.quantity" size="small" :min="0" :decimal-places="0" style="width: 116px" />
          </template>
          <template #costCell="{ row }">
            <t-input-number v-model="row.cost" size="small" :min="0" :decimal-places="4" style="width: 116px" />
          </template>
          <template #liveCell="{ row }">
            <span v-if="row.livePrice" class="tabular-nums">¥{{ row.livePrice.toFixed(3) }}</span>
            <span v-else class="ocr-hint">—</span>
          </template>
          <template #noteCell="{ row }">
            <ul v-if="row.notes.length" class="ocr-notes">
              <li v-for="(n, i) in row.notes" :key="i" :class="{ 'ocr-note--bad': levelOf(row) === 'error' }">
                {{ n }}
              </li>
            </ul>
            <span v-else class="ocr-hint">—</span>
          </template>
        </t-table>
      </div>

      <t-collapse v-if="rawText" class="ocr-raw">
        <t-collapse-panel header="识别原文（行对不上时看这里）">
          <pre class="ocr-raw__pre">{{ rawText }}</pre>
        </t-collapse-panel>
      </t-collapse>

      <div class="ocr-actions ocr-actions--end">
        <t-button variant="outline" :disabled="busy" @click="run">重新识别</t-button>
        <t-popconfirm
          :content="`将写入 ${importableCount} 条持仓到「${invest.accountName(account)}」，已有的同代码持仓会被覆盖。`"
          @confirm="doImport"
        >
          <t-button theme="primary" :disabled="!importableCount"> 导入 {{ importableCount }} 条持仓 </t-button>
        </t-popconfirm>
      </div>
    </template>
  </t-dialog>
</template>
<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next';
import { computed, onUnmounted, ref, watch } from 'vue';

import { useInvestStore } from '@/store';
import type { AccountId } from '@/types/invest';
import type { OcrCheckedRow, OcrLevel, OcrRawRow } from '@/utils/holdings-ocr';
import { checkRows, effectiveLevel, parseOcrText, rowReady } from '@/utils/holdings-ocr';
import { recognizeLocal } from '@/utils/ocr-local';
import { recognizeVision, rowsFromModel, visionModels } from '@/utils/ocr-vision';
import { fetchAnyQuotes, normalizeCode } from '@/utils/quote';

/** 超过这个大小就别送了：本地识别会吃满内存，视觉模型也会超时 */
const MAX_BYTES = 12 * 1024 * 1024;

// 显式命名成 visible：调用方写的是 `v-model:visible`，而不带参数的 defineModel() 声明的是
// modelValue + update:modelValue，两边对不上（编译产物里能直接看到这个错位）。
// 现在它没出问题，是因为 visible 作为普通 attr 透传到了根节点的 t-dialog 上 ——
// 也就是说这份能用是「根节点刚好是 t-dialog」换来的。写明名字就不靠这个巧合了。
const visible = defineModel<boolean>('visible', { default: false });
const invest = useInvestStore();

const account = ref<AccountId>(invest.activeAccounts[0]?.id ?? 'stock');
watch(
  () => invest.activeAccounts.map((a) => a.id).join(','),
  () => {
    if (!invest.activeAccounts.some((a) => a.id === account.value)) {
      account.value = invest.activeAccounts[0]?.id ?? 'stock';
    }
  },
);

const engine = ref<'local' | 'vision'>('local');
const file = ref<File | null>(null);
const previewUrl = ref('');
const rawText = ref('');
const note = ref('');
const error = ref('');
const busy = ref(false);
const dragOver = ref(false);
const progressText = ref('');
const fileRef = ref<HTMLInputElement | null>(null);

/** 表格里可编辑，所以带的是一份可变的行副本 */
interface Row extends OcrCheckedRow {
  key: string;
}
const checked = ref<Row[]>([]);

const columns = [
  { colKey: 'state', title: '状态', width: 78 },
  { colKey: 'codeCell', title: '标的', width: 170 },
  { colKey: 'qtyCell', title: '数量', width: 128 },
  { colKey: 'costCell', title: '成本价', width: 128 },
  { colKey: 'liveCell', title: '行情现价', width: 96 },
  { colKey: 'noteCell', title: '校验提示' },
];

const stateText = (l: OcrLevel) => (l === 'ok' ? '正常' : l === 'warn' ? '待核对' : '缺数据');
/** 表格里的数量/成本可编辑，所以状态跟着当前值算，不按识别时那份冻结判定 */
const levelOf = (r: Row) => effectiveLevel(r);
const stateTheme = (l: OcrLevel) => (l === 'ok' ? 'success' : l === 'warn' ? 'warning' : 'danger');

const okCount = computed(() => checked.value.filter((r) => levelOf(r) === 'ok').length);
const warnCount = computed(() => checked.value.filter((r) => levelOf(r) === 'warn').length);
const errCount = computed(() => checked.value.filter((r) => levelOf(r) === 'error').length);
const readyRows = computed(() => checked.value.filter(rowReady));
const importableCount = computed(() => readyRows.value.length);

function pick() {
  if (busy.value) return;
  fileRef.value?.click();
}

function setFile(f: File | null) {
  error.value = '';
  checked.value = [];
  rawText.value = '';
  note.value = '';
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = '';
  file.value = null;
  if (!f) return;
  if (!f.type.startsWith('image/')) {
    error.value = '只能识别图片（PNG / JPG / WebP）';
    return;
  }
  if (f.size > MAX_BYTES) {
    error.value = `图片 ${(f.size / 1024 / 1024).toFixed(1)}MB 太大了（上限 ${MAX_BYTES / 1024 / 1024}MB），先裁掉无关部分`;
    return;
  }
  file.value = f;
  previewUrl.value = URL.createObjectURL(f);
}

function onPick(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0] ?? null;
  setFile(f);
  // 复位，否则同一张图选第二次不触发 change
  if (fileRef.value) fileRef.value.value = '';
}

function onDrop(e: DragEvent) {
  dragOver.value = false;
  setFile(e.dataTransfer?.files?.[0] ?? null);
}

/**
 * 支持直接粘贴。
 *
 * 截图之后 Ctrl+V 是最顺的手 —— 不用先存成文件再找路径。所以监听的是整个文档：
 * 对话框开着就接住粘贴事件（并 preventDefault，免得图片被塞进别处）。
 */
function onPaste(e: ClipboardEvent) {
  if (!visible.value || busy.value) return;
  const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
  if (!item) return;
  const f = item.getAsFile();
  if (!f) return;
  e.preventDefault();
  setFile(f);
}

watch(
  visible,
  (v) => {
    if (v) document.addEventListener('paste', onPaste);
    else document.removeEventListener('paste', onPaste);
  },
  // immediate 不能省：对话框若一开始就是打开的，watch 不触发，粘贴监听就永远挂不上。
  // （线上是从 false 翻到 true，所以不写也能跑 —— 正是这种「靠调用方习惯才成立」的写法最坑。）
  { immediate: true },
);
onUnmounted(() => {
  document.removeEventListener('paste', onPaste);
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
});

async function run() {
  if (!file.value || busy.value) return;
  busy.value = true;
  error.value = '';
  checked.value = [];
  note.value = '';
  rawText.value = '';
  try {
    let raw: string;
    let parsed: OcrRawRow[];

    if (engine.value === 'local') {
      progressText.value = '正在加载识别模型（首次约 2 秒）…';
      raw = await recognizeLocal(file.value, {
        onProgress: (stage, p) => {
          progressText.value =
            stage === 'loading' ? `正在加载识别模型 ${Math.round(p * 100)}%` : `正在识别文字 ${Math.round(p * 100)}%`;
        },
      });
      if (!raw.trim()) throw new Error('这张图没读出任何文字，换一张更清晰的试试');
      rawText.value = raw;
      const res = parseOcrText(raw);
      note.value = res.note;
      parsed = res.rows;
    } else {
      progressText.value = '正在调用视觉模型…';
      const { content, model } = await recognizeVision(file.value, { onProgress: (n) => (progressText.value = n) });
      rawText.value = content;
      note.value = `由 ${model} 识别`;
      parsed = rowsFromModel(content).map((r) => ({
        code: String(r.code ?? '')
          .replace(/\D/g, '')
          .slice(0, 6),
        name: String(r.name ?? '').trim(),
        quantity: Number.isFinite(Number(r.quantity)) ? Number(r.quantity) : null,
        cost: Number.isFinite(Number(r.cost)) ? Number(r.cost) : null,
        price: Number.isFinite(Number(r.price)) ? Number(r.price) : null,
        raw: JSON.stringify(r),
      }));
    }

    if (!parsed.length) {
      error.value = '没从这张图里认出持仓行。确认截的是「持仓」页，并把表头一起截进来。';
      return;
    }

    // 拿行情对账：名称对不上就说明代码大概率读错了 —— 这是唯一能自动抓住「编造」的办法。
    // 代码必须先按账户归一化再查：腾讯只认 sh/sz/bj 前缀，拿 OCR 出来的裸 6 位码去查
    // 会一条都查不回来，然后整批静默退化成「行情里查不到」（踩过）。
    const codes = [...new Set(parsed.map((r) => normalizeCode(r.code)).filter(Boolean))];
    const quotes = new Map<string, { name: string; price: number }>();
    let quotesUnavailable = false;
    try {
      const q = await fetchAnyQuotes(codes);
      q.forEach((v, k) => quotes.set(k, { name: v.name, price: v.price }));
      quotesUnavailable = quotes.size === 0;
    } catch {
      quotesUnavailable = true;
    }
    checked.value = checkRows(parsed, {
      accounts: invest.accounts,
      account: account.value,
      quotes,
      holdings: invest.holdings,
      quotesUnavailable,
    }).map((r, i) => ({ ...r, key: `${r.code}-${i}` }));
  } catch (e) {
    error.value = e instanceof Error ? e.message : '识别失败';
  } finally {
    busy.value = false;
    progressText.value = '';
  }
}

async function doImport() {
  const rows = readyRows.value;
  if (!rows.length) return;
  busy.value = true;
  try {
    // 名称以行情为准（和「手工校准」一致）：截图里的简称不是权威，行情名才是
    const quotes = await fetchAnyQuotes(rows.map((r) => r.code)).catch(() => new Map());
    let done = 0;
    for (const r of rows) {
      const q = quotes.get(r.code);
      const prev = invest.holdings.find((h) => h.account === account.value && h.code === r.code);
      invest.upsertHolding({
        account: account.value,
        code: r.code,
        name: q?.name || r.name,
        quantity: r.quantity,
        cost: r.cost,
        health: prev?.health ?? 'healthy',
        action: prev?.action ?? 'hold',
        thesisId: prev?.thesisId ?? '',
      });
      done++;
    }
    await invest.refreshQuotes();
    MessagePlugin.success(`已导入 ${done} 条持仓到「${invest.accountName(account.value)}」`);
    visible.value = false;
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : '导入失败');
  } finally {
    busy.value = false;
  }
}

function resetAll() {
  setFile(null);
  error.value = '';
  progressText.value = '';
  busy.value = false;
}
</script>
<style scoped lang="less">
.ocr-pick {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ocr-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
}

.ocr-label {
  color: var(--td-text-color-secondary);
  font-size: 13px;
  flex-shrink: 0;
}

.ocr-hint {
  color: var(--td-text-color-placeholder);
  font-size: 12px;
}

.ocr-drop {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  min-height: 132px;
  padding: 16px;
  border: 1px dashed var(--td-component-stroke);
  border-radius: 6px;
  background: var(--td-bg-color-container-hover);
  color: var(--td-text-color-secondary);
  cursor: pointer;
  transition: all 0.2s;

  &:hover,
  &--over {
    border-color: var(--td-brand-color);
    background: var(--td-brand-color-light);
  }

  &--busy {
    cursor: progress;
    opacity: 0.7;
  }
}

.ocr-drop__main {
  font-size: 14px;
  color: var(--td-text-color-primary);
}

.ocr-drop__sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}

.ocr-drop__thumb {
  max-width: 168px;
  max-height: 108px;
  border: 1px solid var(--td-component-stroke);
  border-radius: 4px;
  object-fit: contain;
}

.ocr-drop__meta {
  text-align: left;
}

.ocr-alert {
  margin-top: 4px;
}

.ocr-actions {
  display: flex;
  align-items: center;
  gap: 12px;

  &--end {
    justify-content: flex-end;
    margin-top: 16px;
  }
}

.ocr-summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.ocr-notes {
  margin: 0;
  padding-left: 16px;
  font-size: 12px;
  color: var(--td-text-color-secondary);

  li + li {
    margin-top: 2px;
  }
}

.ocr-note--bad {
  color: var(--td-error-color);
}

.ocr-raw {
  margin-top: 12px;
}

.ocr-raw__pre {
  max-height: 220px;
  margin: 0;
  overflow: auto;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 20px;
  white-space: pre-wrap;
  word-break: break-all;
}

@media (width <= 767px) {
  .ocr-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .ocr-drop {
    flex-direction: column;
    text-align: center;
  }

  .ocr-drop__meta {
    text-align: center;
  }
}
</style>
