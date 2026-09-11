# 部署说明

线上地址：<https://stock.053727.xyz（Cloudflare> 橙云代理）

## 目标机器（vnrack / cpa 机）

- IP：`38.64.56.230`，`ssh -i ~/.ssh/zsxq_capture_key root@38.64.56.230`
- Debian 13；同机运行 x-ui/xray（**443 端口，REALITY，勿动**）、grok-caddy（8096）、cli-proxy-api 等
- 宿主机防火墙全开（policy ACCEPT）

## 架构

- 本机构建 `npm run build` → `dist/` 经 tar 管道上传（VPS 无 rsync）
- 源站：docker 容器 `invest-caddy`（caddy:2-alpine，只占 **80 端口**）
  - 静态站点：`/opt/invest-workbench/site`（只读挂载 /srv）
  - SPA fallback：`try_files {path} /index.html`
  - 数据源反代（浏览器同源路径 → 上游）：

    | 路径          | 上游                                                                 | 备注                                                                         |
    | ------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
    | `/qt/*`       | `https://qt.gtimg.cn`                                                | 腾讯行情，GBK 由前端解码                                                     |
    | `/em/*`       | `https://fundmobapi.eastmoney.com`                                   | 带 Referer `fund.eastmoney.com`                                              |
    | `/sina/*`     | `https://hq.sinajs.cn`                                               | 带 Referer `finance.sina.com.cn`（新浪备用行情）                             |
    | `/szse/*`     | `https://www.szse.cn`                                                | 深交所交易日历（备用数据源）                                                 |
    | `/llm/*`      | 本机 OpenAI 兼容代理（先探 cli-proxy-api，不通再用 grok-caddy:8096） | 浏览器只打同源 `/llm/v1/chat/completions`；Bearer 只写 Caddyfile             |
    | `/wscn/*`     | `https://api-one-wscn.awtmt.com`                                     | 华尔街见闻快讯/宏观日历                                                      |
    | `/xgb/*`      | `https://flash-api.xuangubao.cn`                                     | 选股宝板块异动                                                               |
    | `/em-dc/*`    | `https://datacenter-web.eastmoney.com`                               | 东财数据中心宏观报表（PMI/CPI/PPI/GDP）                                      |
    | `/push2/*`    | `https://push2delay.eastmoney.com`                                   | 东财行情列表（申万二级 f100；push2 会 302）                                  |
    | `/csindex/*`  | `https://www.csindex.com.cn`                                         | 中证指数 PE 历史真实曲线                                                     |
    | `/legulegu/*` | `https://www.legulegu.com`                                           | 申万一级 PE/分位（乐咕乐股 HTML）                                            |
    | `/sync`       | `invest-sync:3003`                                                   | 按用户拆表的账本 SQLite（`holdings`/`cash`/`transactions`/`kv`），Basic 认证 |

- Cloudflare：`stock.053727.xyz` **必须保持橙云代理 + zone SSL 模式 Flexible**（2026-09-08 设定，https 全通）。⚠️ 两勿：勿把 SSL 模式改回 Full（回源撞 xray 443 → 525）；勿关橙云加速（灰云后浏览器 https 直连 xray 握手失败 → 无法访问，且灰云久了 Universal SSL 证书会被停用，重开橙云后要等边缘重新部署，期间 https 间歇 403/TLS 错误）。

## 更新流程

```sh
npm run build
# COPYFILE_DISABLE=1：否则 macOS 的 bsdtar 会把每个带 xattr 的文件多塞一个 `._xxx`
# AppleDouble 条目，GNU tar 解包时实体化成 500+ 个垃圾文件（2026-09-10 清了 556 个）。
# 坑：本机 `tar -tf` 重列归档会把这些条目当元数据藏起来，看着是 0 个，
# 只有解到 Linux 上才现形 —— 验证必须真往返一次。
COPYFILE_DISABLE=1 tar -C dist -cf - . | ssh -i ~/.ssh/zsxq_capture_key root@38.64.56.230 \
  'tar -C /opt/invest-workbench/site -xf -'
ssh -i ~/.ssh/zsxq_capture_key root@38.64.56.230 'docker restart invest-caddy'
```

上传是「解包覆盖」，不删旧文件：每次构建的旧哈希产物会一直留在 `site/assets/`（现有 13 份历史 `index-*.js`）。它不影响正确性，只是占地方，累积多了再一次性清。

### `site/ocr/` 是**不带哈希**的静态资源

持仓截图识别（本地 OCR）要三个文件，全在 `public/ocr/`，随构建原样进 `dist/ocr/`：`worker.min.js`、`tesseract-core-simd-lstm.wasm.js`（内嵌 wasm，不用再单独传 .wasm）、`chi_sim.traineddata`（2.4MB，LSTM-only 小模型）。共约 6.2MB，**只在用户点「截图导入持仓 → 开始识别」时才下载**，不进首屏。

三个文件必须同目录、且不能改用 Blob worker：tesseract 在 worker 里拿 `self.location.href` 反推脚本目录去找 core 和语言包，Blob URL 会让这个目录算空、找不到文件。所以 `workerBlobURL: false`，路径由 worker 的 URL 决定。

⚠️ 这三个名字**不带构建时间戳**（不像 `assets/` 那样每次换名），所以正好落进本文开头那个坑：万一在上传完成前就有人访问 `/ocr/worker.min.js`，Caddy 的 `try_files {path} /index.html` 会回 200 + HTML，若再被 CF 按 immutable 缓存，这个文件名就长期吐 HTML，识别全挂。**先上传、后使用**，或上传后按上面「验证必须在**上传之后**」的办法逐个 `cmp` 一次：

```sh
for f in worker.min.js tesseract-core-simd-lstm.wasm.js chi_sim.traineddata; do
  curl -s "https://stock.053727.xyz/ocr/$f" -o /tmp/live.bin && cmp "dist/ocr/$f" /tmp/live.bin && echo "$f ok"
done
```

### 验证必须在**上传之后**

不要先 `curl` 未来版本的文件名再看 200 —— 那不是验证，是下毒。Caddyfile 里：

```caddy
try_files {path} /index.html      # 缺失的 /assets/x.js 回退成 index.html，状态码 200
header @immutable Cache-Control "public, max-age=31536000, immutable"   # 该头按请求路径匹配
```

两者叠加，一个不存在的 `/assets/x.js` 会以 **200 + HTML + immutable** 应答，CF 橙云会把这坨 HTML 缓存**一年**。之后真文件传上去，该 URL 仍然吐 HTML，浏览器按 MIME 拒执行 → 白屏。一个提前探测就能永久锁死一个产物文件名（2026-09-10 踩过，四个文件）。

所以：

- 验证放在上传 + 重启之后；
- 用字节比对而不是看状态码：`curl -s URL -o /tmp/live.bin && cmp dist/<file> /tmp/live.bin`（`curl -o /dev/null -w %{http_code}` 对 SPA 回退也会回 200，毫无信息量）；
- **`index.html` 永远比不过**，只能比 md5。CF 会往 HTML 里注入 bot 挑战脚本（`/cdn-cgi/challenge-platform/...`，~940 字节），curl 没有浏览器指纹时必然命中。比 origin 才准：

```sh
openssl md5 -r dist/index.html          # 本机（macOS 无 md5sum）
ssh -i ~/.ssh/zsxq_capture_key root@38.64.56.230 'md5sum /opt/invest-workbench/site/index.html'
```

哈希产物（`/assets/*`）不受影响，仍然逐字节比。另外要确认线上 HTML 指向的是新产物名（`rg -o 'index-[A-Za-z0-9_]+-b[A-Za-z0-9]+\.js' /tmp/live.html`）—— 字节比对查不出引用是不是更新了。

- 产物名带构建时间戳（`vite.config.ts` 的 `BUILD_STAMP`），每次构建换一批 URL，这类污染就碰不到真文件；
- **上传本身要先验成**：远端解包必须以 0 退出（`ssh … 'tar … -xf -; echo $?'`）。**别把远端 tar 的 stderr 接给 `head`/`grep`** —— 提前关管会给 tar 发 SIGPIPE，解包写到一半就死，症状是 `index.html` 已更新而它引用的 `assets/*` 还不存在；这就是上面那个坑的入口，而且看起来像「上传打了 UPLOADED」（2026-09-11 踩过）。两次部署重叠也会产生同样的窗口——上传完先全量比对一遍再算完；
- **全量比对别用 `md5sum`**：macOS 没有 `md5sum`（也没 `md5`），`find dist -exec md5sum {} \;` 会安静地输出空列表，于是「本地 ∅ vs 远端」对下来得到假的「一致」——验证看起来通过了，其实什么都没比（2026-09-11 踩过）。用两边都有的 sha256：

  ```bash
  find dist -type f -exec shasum -a 256 {} \; | sed 's|dist/||' | sort -k2 > /tmp/local.sha
  ssh -i ~/.ssh/zsxq_capture_key root@38.64.56.230 \
    'cd /opt/invest-workbench/site && find . -type f ! -name "._*" -exec sha256sum {} \;' | sed 's|\./||' | sort -k2 > /tmp/remote.sha
  # 子集方向：每个本地文件都必须在远端存在且哈希相同（远端会积压历史产物，多出来是正常的）
  ```

  别忘了 `! -name "._*"`：macOS 的 AppleDouble 残件会被 tar 带上源站。幂等性用 `diff` 自己比会把 1200+ 历史文件当成「差异」；看 `missing`/`mismatch` 两个数归零才算过。

- 万一已中毒：该 URL 无人引用就无需处理；若被引用，只能在 CF 后台 Purge（本机无 CF API token）。

改 Caddyfile 后 `docker restart invest-caddy` 即可；改配置无需重新上传站点。

## 持仓 SQLite 同步

容器 `invest-sync`（`python:3-alpine` + `scripts/sync-server.py`），库文件 `/opt/invest-workbench/data/invest.db`。Caddy `handle /sync*` 反代到 `invest-sync:3003`。登录走 `/sync` Basic；注册走 `POST /sync/register`。每个用户独立 `holdings`/`cash`/`transactions`/`kv`。账本只信 SQLite。慢数据走 `/sync/cache`（宏观 6h，催化 15min）。社融全表 `GET /sync/afre`（增量）与 `?kind=stock`（存量，万亿元+同比），央行 xlsx，6h。宽基/创业板 PE 月频序列 `GET /sync/lg-pe`（乐咕乐股，缓存 ≤24h，**无鉴权**——所以前端 `fetchOk('/sync/lg-pe')` 不带 authHeader 才通）。

### 改 `scripts/sync-server.py` 必须单独部署（别只传站点）

站点部署 **不会**带上它：`/opt/invest-workbench/sync-server.py` 是**独立 bind-mount**进容器的只读文件（`docker inspect invest-sync` 可见 `Source:/opt/invest-workbench/sync-server.py` → `Destination:/app/sync-server.py, ro`），跟 `site/` 无关。只传 `dist/` 会让前端指向一个**不存在的路由**——典型症状是 `curl -o /dev/null -w '%{http_code}' /sync/<新接口>` 得 **404**，而老接口得 **401**（401 = 路由在但要求鉴权，404 = 根本没这个路由），前端静默掉兜底分支、看起来“功能没生效”而控制台无红字。2026-09-11 就这样漏了 `/sync/lg-pe`：前端已上线，后端还停在旧版。

```sh
# 1) 先在**容器自己的解释器**里过语法（python:3-alpine 是 3.14，宿主可能不同）
docker run --rm -v /opt/invest-workbench:/w python:3-alpine python -m py_compile /w/sync-server.py.new
# 2) 原子替换前先比对哈希，别用“传上去了”当验证
sha256sum /opt/invest-workbench/sync-server.py.new   # 必须等于本地 shasum -a 256 scripts/sync-server.py
cp -p sync-server.py sync-server.py.bak-$(date +%Y%m%d-%H%M%S) && mv sync-server.py.new sync-server.py
docker restart invest-sync
```

冒烟：新接口要真回 **200** 且**载荷里有数据**（别只看状态码——`{}` 也是 200）：

```sh
curl -s -o /tmp/x.json -w '%{http_code}\n' https://stock.053727.xyz/sync/lg-pe
python3 -c "import json;d=json.load(open('/tmp/x.json'));print(len(d),{k:len(v) for k,v in d.items()})"
```

加用户（VPS）：

```sh
docker exec -e SYNC_DB=/data/invest.db invest-sync python /app/sync-server.py --add-user NAME PASS
```

查持仓：`sqlite3 /opt/invest-workbench/data/invest.db "SELECT user, account, code, quantity FROM holdings;"`

## 容器 DNS（勿用中国解析器，会投毒）

宿主机 DNS 在 `/etc/netplan/60-public.yaml`，现为 **`8.8.8.8` + `1.1.1.1`**。

**⚠️ 切勿把 223.5.5.5 / 119.29.29.29 等中国解析器设为首选。**这台机器在美国，用中国解析器查「在中国被墙的域名」会拿到 GFW 伪造答案，实测：

| 查询             | 1.1.1.1 / 8.8.8.8                               | 223.5.5.5                                                    |
| ---------------- | ----------------------------------------------- | ------------------------------------------------------------ |
| `api.x.ai`       | `104.18.18.80`（Cloudflare）                    | `31.13.95.34`、`2a03:2880:f12c:183:face:b00c`（Facebook 段） |
| `api.openai.com` | `172.66.0.243`、`162.159.140.245`（Cloudflare） | `2a03:2880:...:face:b00c`、`104.244.46.185`                  |

`face:b00c` 是 Facebook 的招牌段，见到就是被投毒。这会直接打挂 `cli-proxy-api`（它无上游代理，纯靠 DNS 直连 `api.x.ai` / `api.openai.com`）。

历史教训：曾用 223.5.5.5 打头解决了 `/wscn` 的慢解析，却把全机境外解析投毒了 —— **在两个区各测一半就下结论**是错的。

### 为什么最终选 8.8.8.8（而非 1.1.1.1）打头

反代按域名回源，**每次新建连接都要解析**，容器内嵌 DNS 转发超时约 3s，超时即 `502` + 日志 `dial tcp: lookup <domain>: i/o timeout`。1.1.1.1 对 `awtmt.com` 是病态的：

| 上游                                | 1.1.1.1              | 8.8.8.8              |
| ----------------------------------- | -------------------- | -------------------- |
| `api-one-wscn.awtmt.com`（`/wscn`） | **3174ms**（超时！） | 522ms（最差 1112ms） |
| `www.csindex.com.cn`                | 663ms                | **129ms**            |
| `flash-api.xuangubao.cn`            | 439ms（最差 689ms）  | 343ms                |
| 其余 7 个上游                       | 108–300ms            | 108–362ms            |

8.8.8.8 是唯一同时满足「境外答案干净」+「所有中文上游 ≤1112ms（离 3s 有 3 倍余量）」的选择，所以**无需改 Caddyfile、无需给容器单独配 DNS**。

### 改宿主 DNS 后必须重启受影响的容器

Docker 在**容器启动时**记下 `ExtServers`（取自宿主机 resolv.conf），之后改宿主机 DNS **对已运行的容器不生效**。所以：

```sh
netplan apply && systemctl restart systemd-resolved
docker restart invest-caddy        # 必需的容器要重启才吃到新 DNS
```

判断某容器是否还在用旧 DNS：`docker exec <c> getent hosts api.x.ai` —— 出现 `face:b00c` 就是还拉着旧上游。

### 验证

```sh
# 境外解析必须干净（不得出现 face:b00c）
docker exec invest-caddy getent hosts api.x.ai
# 我的上游必须 <1200ms（awtmt 是历史上最慢的那个）
s=$(date +%s%N); docker exec invest-caddy nslookup api-one-wscn.awtmt.com >/dev/null; echo $(( ($(date +%s%N)-s)/1000000 ))ms
```

## 排障

- `525`：CF 在尝试 TLS 回源 443（SSL 模式不是 Flexible，或 xray 变更）
- `521/522`：invest-caddy 容器没起来（`docker ps | grep invest`、`docker logs invest-caddy`）
- `502` 且日志报 `lookup ... i/o timeout` → 看上面「容器 DNS」
- `502` 且日志报 `connection reset by peer` → 上游自己掐连接（`/szse` 常见），重试即可
- 境外 API 报连不上 / 连到莫名其妙的 IP → 查是否误用了中国解析器（看上面投毒表）
- 行情接口报错：在 VPS 上直接 `curl -H "Host: stock.053727.xyz" http://127.0.0.1/qt/q=sh000001` 区分是代理层还是上游问题
