import { register } from 'node:module';

// import.meta.url 本身就是 URL 字符串，直接作为父 URL 解析 ./ts-resolve.mjs
register('./ts-resolve.mjs', import.meta.url);
