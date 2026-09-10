/**
 * 本地 OCR 引擎：tesseract.js + 中文 LSTM 模型，全部自托管。
 *
 * 这是截图导入的**默认**通道 —— 截图不出浏览器、不联网、不花 token。识别质量实测够用：
 * 同花顺持仓页那种密排 9 列（代码/名称/持仓/可用/成本/现价/市值/盈亏/比例）能逐字读对，
 * 缩到 72% 也照样准。它读不准的是**照片**（模糊、透视、反光），那种图视觉模型同样读不准，
 * 所以照片不是「换个引擎」能解决的问题，只能靠导入前的校验拦住，见 `holdings-ocr.ts`。
 *
 * ## 三个资产为什么必须同目录，且不能是 Blob worker
 *
 * tesseract.js 默认用 Blob URL 起 worker。emscripten 胶水在 worker 里取
 * `self.location.href` 当脚本目录，而 blob URL 会命中它的 `indexOf("blob:")===0` 分支，
 * 直接把目录置空 —— 于是核心去 `/tesseract-core-*.wasm` 这种站点根路径找文件，404。
 * （`public/ocr/` 放的是**内嵌了 wasm 的** core.js，所以实际不会去取 .wasm，
 * 但这个分支行为足以说明：路径全靠 worker 的 URL 推导。）
 *
 * 所以 `workerBlobURL: false` + `workerPath` 指向 `public/ocr/worker.min.js`，
 * 三个资产全放 `public/ocr/`：worker 的 URL 决定了它同目录下能找到 core 和语言包。
 *
 * 语言包用的是 LSTM-only 的那份 `4.0.0_best_int`（2.4MB），不是默认 CDN 那份 20MB 的
 * 混合模型 —— 我们只需要 LSTM，体积只有 1/8。同理 core 用 `-lstm` 变体。
 */
import type { Worker } from 'tesseract.js';
import { createWorker } from 'tesseract.js';

/** 资产目录。跟着构建的 base 走，子路径部署也不会断。 */
const ASSET_BASE = `${import.meta.env.BASE_URL || '/'}ocr/`.replace(/\/{2,}/g, '/');

export type OcrStage = 'loading' | 'recognizing';

export interface LocalOcrOptions {
  /** 进度回调，0~1。加载模型和识别各占一段。 */
  onProgress?: (stage: OcrStage, progress: number) => void;
}

let cached: Promise<Worker> | null = null;

/**
 * 复用同一个 worker：建它要读 2.4MB 语言包（约 2 秒）。
 * 一次导入股票、一次导入 ETF 很常见，第二次不该再等一遍。
 */
function getWorker(onProgress?: LocalOcrOptions['onProgress']): Promise<Worker> {
  if (cached) return cached;
  cached = createWorker('chi_sim', 1, {
    workerPath: `${ASSET_BASE}worker.min.js`,
    // 以 .js 结尾时 tesseract.js 会当「就是这个文件」，不再自己拼 simd/lstm 后缀
    corePath: `${ASSET_BASE}tesseract-core-simd-lstm.wasm.js`,
    langPath: ASSET_BASE.replace(/\/$/, ''),
    workerBlobURL: false,
    gzip: false,
    logger: (m: { status?: string; progress?: number }) => {
      if (!onProgress || !m?.status) return;
      // tesseract 的 status 名很啰嗦，收敛成两段给界面用
      const stage: OcrStage = /recogniz/i.test(m.status) ? 'recognizing' : 'loading';
      onProgress(stage, typeof m.progress === 'number' ? m.progress : 0);
    },
  }).catch((e) => {
    // 建失败要把缓存清掉，否则用户重试会一直拿到同一个被拒绝的 promise
    cached = null;
    throw e;
  });
  return cached;
}

/** 识别一张图，返回纯文本。切行与切列都交给 `holdings-ocr.ts`。 */
export async function recognizeLocal(source: Blob | File, opts: LocalOcrOptions = {}): Promise<string> {
  const worker = await getWorker(opts.onProgress);
  opts.onProgress?.('recognizing', 0);
  try {
    const { data } = await worker.recognize(source);
    return data.text ?? '';
  } catch (e) {
    // 识别失败往往是 worker 状态坏了，丢掉缓存让下次重建
    cached = null;
    throw e;
  }
}
