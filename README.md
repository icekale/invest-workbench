# 投资研究工作台

个人使用。TDesign Vue Next 壳 + 拾光研选气质。持仓为模拟数据，A 股/ETF/指数现价走腾讯行情。

```bash
npm install
npm run dev
# 账号 xiong / demo
npm run check:quotes
```

开发时 Vite 把 `/qt` 代理到 `https://qt.gtimg.cn`。生产 Nginx：

```
location /qt/ {
  proxy_pass https://qt.gtimg.cn/;
}
```

前端只请求同源 `/qt/q=sz000001,sh510300`。
