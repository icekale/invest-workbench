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

// https://vitejs.dev/config/
export default ({ mode }: ConfigEnv): UserConfig => {
  const { VITE_BASE_URL, VITE_API_URL_PREFIX } = loadEnv(mode, CWD);
  return {
    base: VITE_BASE_URL,
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
      },
    },
  };
};
