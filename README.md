# 投资研究工作台

个人使用。TDesign Vue Next 壳。股票/ETF 现价走腾讯行情，公募排行走东财。

```bash
npm install
npm run dev
# 账号 xiong / demo
npm run check:quotes
npm run check:fund
npm run fit:funds
npm run check:backup
```

开发时 Vite 把 `/qt` 代理到 `https://qt.gtimg.cn`。生产 Nginx：

```
location /qt/ {
  proxy_pass https://qt.gtimg.cn/;
}
location /em/ {
  proxy_pass https://fundmobapi.eastmoney.com/;
  proxy_set_header Referer https://fund.eastmoney.com/;
}
location /sina/ {
  proxy_pass https://hq.sinajs.cn/;
  proxy_set_header Referer https://finance.sina.com.cn/;
}
location /szse/ {
  proxy_pass https://www.szse.cn/;
  proxy_set_header Referer https://www.szse.cn/;
}
```

前端只请求同源 `/qt`、`/em`、`/sina`、`/szse`。
