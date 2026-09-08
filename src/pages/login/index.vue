<template>
  <div class="login-wrapper">
    <!-- Left Stage: Deep Teal Horizon (深青夜色画卷) -->
    <aside class="stage-left">
      <!-- Top Brand Logo -->
      <div class="stage-header">
        <guanlan-logo theme="dark" :mark-size="38" />
      </div>

      <!-- Centerpiece Content -->
      <div class="stage-body">
        <div class="stage-quote-group">
          <div class="stage-badge">
            <span class="badge-dot" />
            <span class="badge-text">私人投资决策终端</span>
          </div>
          <h1 class="stage-title">观水有术，必观其澜</h1>
          <p class="stage-subtitle">以持仓结构为先，交易只服务再平衡</p>
        </div>

        <!-- Generative Vector Horizon Illustration -->
        <div class="stage-art">
          <wave-illustration />
        </div>

        <!-- Three Anchor Pillars -->
        <div class="stage-pillars">
          <div class="pillar-item">
            <div class="pillar-title">双账户双轨</div>
            <div class="pillar-desc">股票与 ETF 独立归因治理</div>
          </div>
          <div class="pillar-divider" />
          <div class="pillar-item">
            <div class="pillar-title">全穿透行情</div>
            <div class="pillar-desc">腾讯现价 × 东财公募排行</div>
          </div>
          <div class="pillar-divider" />
          <div class="pillar-item">
            <div class="pillar-title">纯本地私密</div>
            <div class="pillar-desc">不托管持仓，离线安全可用</div>
          </div>
        </div>
      </div>

      <!-- Footer Note -->
      <div class="stage-footer">
        <span class="footer-copy">© 2026 观澜 · 投资研究工作台</span>
        <span class="footer-tag">腾讯 / 东财数据通道</span>
      </div>
    </aside>

    <!-- Right Stage: Clean Lock Terminal (私密门锁) -->
    <main class="stage-right">
      <!-- Mobile Top Brand Bar (Visible only on mobile/narrow viewports) -->
      <div class="mobile-brand-bar">
        <guanlan-logo theme="dark" :mark-size="32" :show-sub="false" />
        <div class="mobile-tagline">观水有术 · 必观其澜</div>
      </div>

      <div class="terminal-card">
        <div class="card-header">
          <div class="status-indicator">
            <span class="pulse-dot" />
            <span class="status-label">终端就绪 · 通道正常</span>
          </div>
          <h2 class="card-title">开启工作台</h2>
          <p class="card-desc">输入账号，查看今日双账户仓位</p>
        </div>

        <div class="card-form">
          <login />
        </div>

        <div class="card-footer">
          <div class="safe-note">
            <t-icon name="secured" size="14px" class="safe-icon" />
            <span>本地加密存储 · 离线留存 · 无第三方上传</span>
          </div>
        </div>
      </div>

      <!-- Right Panel Footer -->
      <footer class="right-footer">
        <span>投资研究工作台 · 观澜皮肤</span>
      </footer>
    </main>
  </div>
</template>
<script setup lang="ts">
import GuanlanLogo from '@/components/GuanlanLogo.vue';

import Login from './components/Login.vue';
import WaveIllustration from './components/WaveIllustration.vue';
</script>
<style lang="less" scoped>
@import './index.less';
</style>
