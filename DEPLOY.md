# 部署说明

线上地址：https://stock.053727.xyz（Cloudflare 橙云代理）

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
    | 路径 | 上游 | 备注 |
    | --- | --- | --- |
    | `/qt/*` | `https://qt.gtimg.cn` | 腾讯行情，GBK 由前端解码 |
    | `/em/*` | `https://fundmobapi.eastmoney.com` | 带 Referer `fund.eastmoney.com` |
    | `/sina/*` | `https://hq.sinajs.cn` | 带 Referer `finance.sina.com.cn`（新浪备用行情） |
    | `/szse/*` | `https://www.szse.cn` | 深交所交易日历（备用数据源） |
    | `/llm/*` | 本机 OpenAI 兼容代理（先探 cli-proxy-api，不通再用 grok-caddy:8096） | 浏览器只打同源 `/llm/v1/chat/completions`；Bearer 只写 Caddyfile |
    | `/wscn/*` | `https://api-one-wscn.awtmt.com` | 华尔街见闻快讯/宏观日历 |
    | `/xgb/*` | `https://flash-api.xuangubao.cn` | 选股宝板块异动 |
    | `/em-dc/*` | `https://datacenter-web.eastmoney.com` | 东财数据中心宏观报表（PMI/CPI/PPI/GDP） |
    | `/push2/*` | `https://push2delay.eastmoney.com` | 东财行情列表（申万二级 f100；push2 会 302） |
    | `/csindex/*` | `https://www.csindex.com.cn` | 中证指数 PE 历史真实曲线 |
    | `/legulegu/*` | `https://www.legulegu.com` | 申万一级 PE/分位（乐咕乐股 HTML） |
    | `/sync` | `invest-sync:3003` | 按用户拆表的账本 SQLite（`holdings`/`cash`/`transactions`/`kv`），Basic 认证 |
- Cloudflare：`stock.053727.xyz` **必须保持橙云代理 + zone SSL 模式 Flexible**（2026-09-08 设定，https 全通）。⚠️ 两勿：勿把 SSL 模式改回 Full（回源撞 xray 443 → 525）；勿关橙云加速（灰云后浏览器 https 直连 xray 握手失败 → 无法访问，且灰云久了 Universal SSL 证书会被停用，重开橙云后要等边缘重新部署，期间 https 间歇 403/TLS 错误）。

## 更新流程

```sh
npm run build
tar -C dist -cf - . | ssh -i ~/.ssh/zsxq_capture_key root@38.64.56.230 \
  'tar -C /opt/invest-workbench/site -xf -'
ssh -i ~/.ssh/zsxq_capture_key root@38.64.56.230 'docker restart invest-caddy'
```

改 Caddyfile 后 `docker restart invest-caddy` 即可；改配置无需重新上传站点。

## 持仓 SQLite 同步

容器 `invest-sync`（`python:3-alpine` + `scripts/sync-server.py`），库文件 `/opt/invest-workbench/data/invest.db`。Caddy `handle /sync*` 反代到 `invest-sync:3003`。登录走 `/sync` Basic；注册走 `POST /sync/register`。每个用户独立 `holdings`/`cash`/`transactions`/`kv`。账本只信 SQLite。慢数据走 `/sync/cache`（宏观 6h，催化 15min）。社融全表 `GET /sync/afre`（增量）与 `?kind=stock`（存量，万亿元+同比），央行 xlsx，6h。

加用户（VPS）：

```sh
docker exec -e SYNC_DB=/data/invest.db invest-sync python /app/sync-server.py --add-user NAME PASS
```

查持仓：`sqlite3 /opt/invest-workbench/data/invest.db "SELECT user, account, code, quantity FROM holdings;"`

## 排障

- `525`：CF 在尝试 TLS 回源 443（SSL 模式不是 Flexible，或 xray 变更）
- `521/522`：invest-caddy 容器没起来（`docker ps | grep invest`、`docker logs invest-caddy`）
- 行情接口报错：在 VPS 上直接 `curl -H "Host: stock.053727.xyz" http://127.0.0.1/qt/q=sh000001` 区分是代理层还是上游问题
