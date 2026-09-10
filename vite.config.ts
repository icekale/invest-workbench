import { execFileSync } from 'node:child_process';
import path from 'node:path';

import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import { TDesignResolver } from 'unplugin-vue-components/resolvers';
import Components from 'unplugin-vue-components/vite';
import type { ConfigEnv, UserConfig } from 'vite';
import { loadEnv } from 'vite';
import { viteMockServe } from 'vite-plugin-mock';
import svgLoader from 'vite-svg-loader';

const CWD = process.cwd();

/** 每次构建一个标识，只为让产物文件名不复用。 */
const BUILD_STAMP = Date.now().toString(36);

/**
 * 「线上跑的是哪一版」只有构建时知道，否则就得去看产物文件名猜。
 * sv-SE 的本地化格式正好是 `2026-09-10 09:22:31`（本地时区），省掉手写补零。
 */
const BUILD_TIME = new Date().toLocaleString('sv-SE').slice(0, 16);

function gitShortSha(): string {
  try {
    const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim();
    if (!sha) return 'dev';
    // 带未提交改动时只显示 SHA 会直接骗人 —— 那版代码根本不在这个提交里
    const dirty = execFileSync('git', ['status', '--porcelain']).toString().trim();
    return sha + (dirty ? '-dirty' : '');
  } catch {
    // 非 git 环境（CI 打镜像、源码包构建）不该让构建失败
    return 'dev';
  }
}

// https://vitejs.dev/config/
export default ({ mode }: ConfigEnv): UserConfig => {
  const { VITE_BASE_URL, VITE_API_URL_PREFIX } = loadEnv(mode, CWD);
  return {
    base: VITE_BASE_URL,
    define: {
      __BUILD_TIME__: JSON.stringify(BUILD_TIME),
      __GIT_SHA__: JSON.stringify(gitShortSha()),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    css: {
      preprocessorOptions: {
        less: {
          modifyVars: {
            hack: `true; @import (reference) "${path.resolve('src/style/variables.less')}";`,
          },
          math: 'strict',
          javascriptEnabled: true,
        },
      },
    },

    plugins: [
      vue(),
      vueJsx(),
      viteMockServe({
        mockPath: 'mock',
        enable: true,
      }),
      svgLoader(),
      Components({
        dts: false,
        resolvers: [TDesignResolver({ library: 'vue-next', esm: true })],
      }),
    ],

    server: {
      port: 3002,
      host: '0.0.0.0',
      allowedHosts: true,
      proxy: {
        [VITE_API_URL_PREFIX]: 'http://127.0.0.1:3000/',
        '/qt': {
          target: 'https://qt.gtimg.cn',
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/qt/, ''),
        },
        '/em': {
          target: 'https://fundmobapi.eastmoney.com',
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/em/, ''),
          configure(proxy) {
            proxy.on('proxyReq', (req) => {
              req.setHeader('Host', 'fundmobapi.eastmoney.com');
              req.setHeader('User-Agent', 'EFund/6.5.5 (iPhone; iOS 17.4; Scale/3.00)');
              req.setHeader('Referer', 'https://fund.eastmoney.com/');
            });
          },
        },
        '/push2': {
          target: 'https://push2delay.eastmoney.com',
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/push2/, ''),
          configure(proxy) {
            proxy.on('proxyReq', (req) => {
              req.setHeader('Host', 'push2delay.eastmoney.com');
              req.setHeader('Referer', 'https://quote.eastmoney.com/');
            });
          },
        },
        '/sina': {
          target: 'https://hq.sinajs.cn',
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/sina/, ''),
          configure(proxy) {
            proxy.on('proxyReq', (req) => {
              req.setHeader('Referer', 'https://finance.sina.com.cn/');
            });
          },
        },
        '/sync': {
          target: 'http://127.0.0.1:3003',
          changeOrigin: true,
        },
        '/wscn': {
          target: 'https://api-one-wscn.awtmt.com',
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/wscn/, ''),
          configure(proxy) {
            proxy.on('proxyReq', (req) => {
              req.setHeader('Host', 'api-one-wscn.awtmt.com');
              req.setHeader('Referer', 'https://wallstreetcn.com/');
            });
          },
        },
        '/xgb': {
          target: 'https://flash-api.xuangubao.cn',
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/xgb/, ''),
          configure(proxy) {
            proxy.on('proxyReq', (req) => {
              req.setHeader('Host', 'flash-api.xuangubao.cn');
              req.setHeader('Referer', 'https://xuangubao.cn/');
              req.setHeader('Accept', 'application/json');
            });
          },
        },
        '/legulegu': {
          target: 'https://www.legulegu.com',
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/legulegu/, ''),
          configure(proxy) {
            proxy.on('proxyReq', (req) => {
              req.setHeader('Host', 'www.legulegu.com');
              req.setHeader('Referer', 'https://www.legulegu.com/');
            });
          },
        },
        '/szse': {
          target: 'https://www.szse.cn',
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/szse/, ''),
          configure(proxy) {
            proxy.on('proxyReq', (req) => {
              req.setHeader('Referer', 'https://www.szse.cn/');
            });
          },
        },
        '/llm': {
          target: 'http://127.0.0.1:8096',
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/llm/, ''),
        },
      },
    },

    // https://github.com/vueuse/vueuse/issues/5387#issuecomment-4734186040
    build: {
      rolldownOptions: {
        onLog(level, log, defaultHandler) {
          if (log.code === 'INVALID_ANNOTATION') return null;
          else defaultHandler(level, log);
        },
        output: {
          // 文件名带构建时间戳。这不是洁癖：Caddy 的 `try_files {path} /index.html`
          // 会让「还不存在的 /assets/xxx.js」回 200 + HTML，而 immutable 头又让 CF
          // 把这份 HTML 缓存一年 —— 一次提前探测就能把一个真实文件永久锁成 HTML。
          // 每次构建换一批文件名，这类污染就碰不到真实产物。
          entryFileNames: `assets/[name]-[hash]-b${BUILD_STAMP}.js`,
          chunkFileNames: `assets/[name]-[hash]-b${BUILD_STAMP}.js`,
          assetFileNames: `assets/[name]-[hash]-b${BUILD_STAMP}[extname]`,
        },
      },
    },
  };
};
