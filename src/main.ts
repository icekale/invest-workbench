/* eslint-disable simple-import-sort/imports */
import { createApp } from 'vue';

import App from './App.vue';
import router from './router';
import { store } from './store';
import i18n from './locales';

import 'tdesign-vue-next/es/style/index.css';
import '@/style/index.less';
import './permission';
import { useInvestStore } from '@/store';

import { bindCloudSync } from './utils/cloud-sync';
import { runStorageHygiene } from './utils/storage';

document.documentElement.setAttribute('data-skin', 'guanlan');
runStorageHygiene();

const app = createApp(App);

app.use(store);
app.use(router);
app.use(i18n);

app.mount('#app');
void bindCloudSync(useInvestStore());
