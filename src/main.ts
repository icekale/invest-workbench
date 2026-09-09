/* eslint-disable simple-import-sort/imports */
import { createApp } from 'vue';

import App from './App.vue';
import router from './router';
import { store } from './store';
import i18n from './locales';

import 'tdesign-vue-next/es/style/index.css';
import '@/style/index.less';
import './permission';
import { useInvestStore, useUserStore } from '@/store';

import { bindCloudSync, parseBasic, setSyncCreds } from './utils/cloud-sync';
import { runStorageHygiene } from './utils/storage';

document.documentElement.setAttribute('data-skin', 'guanlan');
runStorageHygiene();

const app = createApp(App);

app.use(store);
app.use(router);
app.use(i18n);

app.mount('#app');
const session = useUserStore();
if (session.token === 'main_token') {
  const u = import.meta.env.VITE_AUTH_USER || 'xiong';
  const p = import.meta.env.VITE_AUTH_PASS || 'demo';
  session.token = `Basic ${btoa(`${u}:${p}`)}`;
}
const creds = parseBasic(session.token);
if (creds) {
  setSyncCreds(creds.user, creds.pass);
  useInvestStore().adoptUser(creds.user);
  void bindCloudSync(useInvestStore());
}
