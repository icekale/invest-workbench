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
- Cloudflare：`stock.053727.xyz` **必须保持橙云代理 + zone SSL 模式 Flexible**（2026-09-08 设定，https 全通）。⚠️ 两勿：勿把 SSL 模式改回 Full（回源撞 xray 443 → 525）；勿关橙云加速（灰云后浏览器 https 直连 xray 握手失败 → 无法访问，且灰云久了 Universal SSL 证书会被停用，重开橙云后要等边缘重新部署，期间 https 间歇 403/TLS 错误）。

## 更新流程

```sh
npm run build
tar -C dist -cf - . | ssh -i ~/.ssh/zsxq_capture_key root@38.64.56.230 \
  'tar -C /opt/invest-workbench/site -xf -'
ssh -i ~/.ssh/zsxq_capture_key root@38.64.56.230 'docker restart invest-caddy'
```

改 Caddyfile 后 `docker restart invest-caddy` 即可；改配置无需重新上传站点。

## 排障

- `525`：CF 在尝试 TLS 回源 443（SSL 模式不是 Flexible，或 xray 变更）
- `521/522`：invest-caddy 容器没起来（`docker ps | grep invest`、`docker logs invest-caddy`）
- 行情接口报错：在 VPS 上直接 `curl -H "Host: stock.053727.xyz" http://127.0.0.1/qt/q=sh000001` 区分是代理层还是上游问题
