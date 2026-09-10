# 截图识别用的离线资源

这三个文件是 `tesseract.js` 运行时**原样搬运**过来的，不参与构建，只被浏览器按路径取。
放在 `public/ocr/` 是必须的：tesseract 在 Web Worker 里靠 `self.location.href`
反推脚本目录去找 core 和语言包，所以三者必须同目录，且不能用默认的 Blob worker
（Blob 会让那个目录算空）。对应代码里的 `workerBlobURL: false`，见 `src/utils/ocr-local.ts`。

| 文件 | 来源 | 版本 | 许可 |
| --- | --- | --- | --- |
| `worker.min.js` | [tesseract.js](https://github.com/naptha/tesseract.js) `dist/worker.min.js` | 6.0.1 | Apache-2.0 |
| `tesseract-core-simd-lstm.wasm.js` | [tesseract.js-core](https://github.com/naptha/tesseract.js-core) | 6.1.2 | Apache-2.0 |
| `chi_sim.traineddata` | [tessdata_best](https://github.com/tesseract-ocr/tessdata_best)（经 `@tesseract.js-data/chi_sim` 的 `4.0.0_best_int`） | 4.0.0 | Apache-2.0 |

三者的完整许可文本见各自上游仓库的 `LICENSE`（均为 Apache License 2.0）。
本项目自身许可见仓库根目录 `LICENSE`（MIT）—— 上述文件按 Apache-2.0 单独授权，不受 MIT 覆盖。

## 为什么是这两个变体

- core 用 **`-lstm`** 而不是默认那份：只需要 LSTM，不必带上 legacy 引擎。
- 语言包用 **`4.0.0_best_int`**（2.4MB）而不是 CDN 默认那份（20MB）：体积只有 1/8，
  实测对同花顺持仓页的识别质量没有差别。
- core 文件名带 `.wasm.js`：**wasm 已经 base64 内嵌在这个 js 里**，
  所以不用（也不该）再单独放一个 `.wasm` 文件。

合计约 6.2MB，只在用户点「截图导入持仓 → 开始识别」时才下载，不进首屏。

## 怎么更新

```sh
npm i tesseract.js@latest
cp node_modules/tesseract.js/dist/worker.min.js public/ocr/
cp node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js public/ocr/
# 语言包从 CDN 取（留意别拿成 20MB 的默认那份）
curl -o public/ocr/chi_sim.traineddata \
  https://cdn.jsdelivr.net/npm/@tesseract.js-data/chi_sim/4.0.0_best_int/chi_sim.traineddata
```

换完跑 `npm run check:ocr` 与浏览器实测各一次 —— fixture 是**真实 OCR 输出**，
换了模型/语言包后识别文本的形态可能变，断言会立刻反映出来。

⚠️ 这三个文件名**不带构建时间戳**，和 `assets/` 不同。所以上线时务必**先上传后访问**，
否则 Caddy 的 `try_files {path} /index.html` 会把不存在的路径回成 200 + HTML，
一旦被 CF 按 immutable 缓存住，这个文件名就长期吐 HTML。详见 `DEPLOY.md`。
