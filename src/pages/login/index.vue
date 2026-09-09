<template>
  <div class="login-wrapper">
    <aside class="stage-left">
      <div class="stage-header">
        <guanlan-logo theme="dark" :mark-size="38" />
      </div>

      <div class="stage-body">
        <div class="stage-quote-group">
          <h1 class="stage-title">观水有术，必观其澜</h1>
          <p class="stage-subtitle">股票 / ETF 分账</p>
        </div>
        <div class="stage-art">
          <wave-illustration />
        </div>
      </div>

      <div class="stage-footer">
        <span class="footer-copy">© 2026 观澜 · 投资研究工作台</span>
      </div>
    </aside>

    <main class="stage-right">
      <div class="mobile-brand-bar">
        <guanlan-logo theme="dark" :mark-size="32" />
        <div class="mobile-tagline">观水有术 · 必观其澜</div>
      </div>

      <div class="terminal-card">
        <div class="card-header">
          <h2 class="card-title">{{ panel === 'login' ? '登录' : '注册账号' }}</h2>
        </div>
        <login v-if="panel === 'login'" @go-register="panel = 'register'" />
        <register v-else @go-login="panel = 'login'" />
      </div>
    </main>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';

import GuanlanLogo from '@/components/GuanlanLogo.vue';

import Login from './components/Login.vue';
import Register from './components/Register.vue';
import WaveIllustration from './components/WaveIllustration.vue';

const panel = ref<'login' | 'register'>('login');
</script>
<style lang="less" scoped>
@import './index.less';
</style>
