/**
 * 视觉模型 OCR —— 本地引擎读不出来时的**兜底**通道，走已有的 `/llm` 反代。
 *
 * ## 为什么它只能是兜底，而不是主力
 *
 * 实测（自造同花顺截图，逐字比对真值）：
 *
 * | 图 | 结果 |
 * | --- | --- |
 * | 清晰截图，密排 9 列 | gemini-3-flash / claude-sonnet / grok-4.3 等 6 个模型全部 6/6 逐字正确 |
 * | 同一张图压成模糊+透视的「照片」 | 最好的 2/6，且开始**编造**：出现 128812、002594 这种图里没有的代码 |
 *
 * 也就是说，清晰图上它和本地引擎一样准；图一差，它不是「读不准」而是「编出来」——
 * 编出来的代码配上编出来的名字，肉眼不看原图分辨不了。所以这条路必须：
 * 1. 由用户显式选择，界面上讲清楚它是兜底；
 * 2. 结果同样过 `holdings-ocr.ts` 的校验 —— 代码去行情里查回来对名字，编的代码对不上名，
 *    这是唯一能自动抓住「编造」的办法（把编造降级成一条黄色提示，而不是静默入库）。
 *
 * ## 模型是**钉死**的，不跟晨会设置走
 *
 * 晨会模型可配，而设置里当前的默认 `gemini-3.8-flash-high` 实测对这条接口返回 HTTP 500。
 * 读图能力跟模型强相关（grok-4.5 在清晰图上就编了 3 行），跟着一个为「写晨会」调的
 * 旋钮走，等于让用户换晨会模型时把截图识别换坏。所以这里自带一份实测过的清单。
 */
import { authHeader } from './cloud-sync';

/** 首选：实测 6/6、约 4 秒，是这批里最快且准的。 */
const VISION_MODEL = 'gemini-3-flash';

/** 首选不通时依次退。都是清晰图上实测 6/6 的模型。 */
const FALLBACK_MODELS = ['claude-sonnet-4-6', 'gemini-3.6-flash-high'];

/** 长边压到这个像素再送。太大只是多烧 token，识别不会更准。 */
const MAX_EDGE = 2200;

const PROMPT = [
  '这是一张中国券商/同花顺 App 的持仓截图。请逐行读出持仓表，只输出 JSON，不要解释、不要用 markdown 代码块。',
  '格式：{"rows":[{"code":"600519","name":"贵州茅台","quantity":100,"cost":1480.5,"price":1523.8}]}',
  '规则：',
  '- code 是 6 位数字，原样抄，不要补前缀、不要改。',
  '- quantity 取「持仓数量」列，不是「可用数量」列。',
  '- cost 取「成本价」列，price 取「现价/最新价」列。',
  '- 数字去掉千分位逗号，不要带 % 和货币符号。',
  '- 只读你在图里真实看到的行。看不清的行整行省略，绝对不要猜测或补全。',
].join('\n');

/** 把图压到 MAX_EDGE 以内再编码成 JPEG —— 直接送原图可能几 MB，且模型不需要那个分辨率。 */
async function toJpegDataUrl(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('画布不可用，无法压缩截图');
  // 白底：截图的透明区域直接转 JPEG 会变黑，黑底上的字模型读不出来
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', 0.92);
}

/** 从模型返回里抠出 JSON。它爱包 ```json 围栏或加解释，所以只取最外层花括号。 */
export function extractJson(content: string): unknown {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('模型没有返回 JSON');
  return JSON.parse(content.slice(start, end + 1));
}

/**
 * 模型返回 → 宽松的行对象数组。
 *
 * 这里**不**做 normalizeCode 之外的加工：模型给什么代码就是什么，
 * 校验和归一化由 `holdings-ocr.ts` 统一做，避免两条通道各有一套规则。
 */
export function rowsFromModel(content: string): Array<Record<string, unknown>> {
  const parsed = extractJson(content) as { rows?: unknown };
  const rows = Array.isArray(parsed?.rows) ? parsed.rows : [];
  return rows.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object');
}

/** 单次读图最多等这么久。读图比写晨会慢，但也不能让界面无限转。 */
const CALL_TIMEOUT_MS = 90_000;

async function callModel(model: string, dataUrl: string): Promise<string> {
  const res = await fetch('/llm/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: 'system', content: '你是券商持仓截图解析器，只输出 JSON。' },
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('模型没有返回内容');
  return content;
}

/**
 * 识别一张图，返回模型的原始 JSON 文本。
 *
 * 首选不通（500 / 超时 / 该账号没有这个模型）就依次退到备选 —— 实测这条链路上
 * 单个模型随时可能 500（设置里当前的默认模型就是），而识别本身只要有一个能答就行。
 * 所以**不在这里重试同一个模型**：换模型就是重试，重试同一个只是把等待翻倍。
 */
export async function recognizeVision(
  file: Blob,
  opts: { onProgress?: (note: string) => void } = {},
): Promise<{ content: string; model: string }> {
  const dataUrl = await toJpegDataUrl(file);
  const models = [VISION_MODEL, ...FALLBACK_MODELS];
  let lastError: unknown = null;
  for (const model of models) {
    opts.onProgress?.(`正在用 ${model} 识别…`);
    try {
      const content = await callModel(model, dataUrl);
      return { content, model };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('视觉模型识别失败');
}

/** 供界面显示：当前用的是哪个模型、备选有哪些。 */
export const visionModels = { primary: VISION_MODEL, fallbacks: FALLBACK_MODELS };
