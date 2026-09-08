<template>
  <div class="guanlan-logo" :class="[`theme-${theme}`, { 'is-compact': compact }]">
    <!-- SVG Vector Mark -->
    <div class="logo-mark" :style="{ width: `${markSize}px`, height: `${markSize}px` }">
      <svg viewBox="0 0 44 44" width="100%" height="100%" fill="none">
        <defs>
          <linearGradient :id="`mark-bg-${uid}`" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#111f27" />
            <stop offset="50%" stop-color="#162a34" />
            <stop offset="100%" stop-color="#0c232b" />
          </linearGradient>
          <linearGradient :id="`mark-gold-${uid}`" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#f5e0a9" />
            <stop offset="45%" stop-color="#dfb56d" />
            <stop offset="100%" stop-color="#af8239" />
          </linearGradient>
          <linearGradient :id="`mark-wave-${uid}`" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#0d706d" stop-opacity="0.25" />
            <stop offset="100%" stop-color="#16815f" stop-opacity="0.65" />
          </linearGradient>
        </defs>

        <!-- Base squircle with gold border -->
        <rect width="44" height="44" rx="10" :fill="`url(#mark-bg-${uid})`" />
        <rect
          width="44"
          height="44"
          rx="10"
          :stroke="`url(#mark-gold-${uid})`"
          stroke-width="1.2"
          stroke-opacity="0.9"
        />

        <!-- Ambient wave depth -->
        <path
          d="M5 29 C 11 29, 14 23, 20 23 C 25 23, 28 27, 34 27 C 37 27, 38.5 26.5, 39 26 L 39 34 C 39 36.8, 36.8 39, 34 39 L 10 39 C 7.2 39, 5 36.8, 5 34 Z"
          :fill="`url(#mark-wave-${uid})`"
        />

        <!-- Primary wave crest -->
        <path
          d="M6 28 C 12 28, 16 19.5, 21.5 19.5 C 26.5 19.5, 30 25.5, 35 25.5 C 37 25.5, 38.2 25, 39 24.2"
          :stroke="`url(#mark-gold-${uid})`"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <!-- Horizon anchor baseline -->
        <path
          d="M9 33 C 15 33, 18 31, 24 31 C 30 31, 33 33, 37 33"
          :stroke="`url(#mark-gold-${uid})`"
          stroke-width="1.1"
          stroke-linecap="round"
          stroke-opacity="0.75"
        />

        <!-- Polaris Zenith Star -->
        <g transform="translate(31, 13)">
          <circle cx="0" cy="0" r="1.3" fill="#fff" />
          <path
            d="M0 -3 L0 3 M-3 0 L3 0"
            :stroke="`url(#mark-gold-${uid})`"
            stroke-width="0.8"
            stroke-linecap="round"
          />
        </g>
      </svg>
    </div>

    <!-- Text typography -->
    <div v-if="!compact" class="logo-text">
      <div class="brand-title">
        <span class="brand-name">观澜</span>
        <span class="brand-sep">|</span>
        <span class="brand-app">投资研究工作台</span>
      </div>
      <div v-if="showSub" class="brand-subtitle">CAPITAL &amp; CYCLE WORKBENCH</div>
    </div>
  </div>
</template>
<script setup lang="ts">
const _props = withDefaults(
  defineProps<{
    theme?: 'dark' | 'light';
    compact?: boolean;
    markSize?: number;
    showSub?: boolean;
  }>(),
  {
    theme: 'dark',
    compact: false,
    markSize: 34,
    showSub: true,
  },
);

const uid = Math.random().toString(36).substring(2, 8);
</script>
<style lang="less" scoped>
.guanlan-logo {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  user-select: none;

  .logo-mark {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    filter: drop-shadow(0 2px 8px rgb(22 42 52 / 18%));
  }

  .logo-text {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;

    .brand-title {
      display: flex;
      align-items: center;
      gap: 6px;
      line-height: 24px;
      font-size: 15px;
      font-weight: 600;
      white-space: nowrap;
      font-family: var(--td-font-family);

      .brand-name {
        letter-spacing: 0.5px;
      }

      .brand-sep {
        font-weight: 300;
        opacity: 0.6;
        font-size: 14px;
      }

      .brand-app {
        font-size: 14px;
        font-weight: 500;
        letter-spacing: 0.2px;
      }
    }

    .brand-subtitle {
      margin-top: 1px;
      font-size: 12px;
      font-weight: 400;
      letter-spacing: 1px;
      line-height: 16px;
      font-family: var(--td-font-family-mono);
    }
  }

  /* Dark Theme (e.g. for night sidebar, login left panel) */
  &.theme-dark {
    .brand-name {
      color: #fff;
    }

    .brand-sep {
      color: var(--guanlan-gold, #dfb56d);
    }

    .brand-app {
      color: #e2ebf0;
    }

    .brand-subtitle {
      color: rgb(255 255 255 / 55%);
    }
  }

  /* Light Theme (e.g. for light header, docs) */
  &.theme-light {
    .brand-name {
      color: var(--td-text-color-primary, #14212b);
    }

    .brand-sep {
      color: var(--td-brand-color, #0d706d);
    }

    .brand-app {
      color: var(--td-text-color-primary, #14212b);
    }

    .brand-subtitle {
      color: var(--td-text-color-placeholder, #5e6c76);
    }
  }
}
</style>
