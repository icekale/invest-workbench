<template>
  <div class="wave-art-wrapper">
    <svg viewBox="0 0 560 300" width="100%" height="100%" fill="none" class="wave-svg">
      <defs>
        <!-- Gradients for wave ribbons -->
        <linearGradient id="wave-gold-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#dfb56d" stop-opacity="0.2" />
          <stop offset="35%" stop-color="#f8e5b8" stop-opacity="0.95" />
          <stop offset="70%" stop-color="#dfb56d" stop-opacity="0.9" />
          <stop offset="100%" stop-color="#af8239" stop-opacity="0.4" />
        </linearGradient>

        <linearGradient id="wave-teal-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#0d706d" stop-opacity="0.15" />
          <stop offset="45%" stop-color="#16815f" stop-opacity="0.8" />
          <stop offset="85%" stop-color="#0d706d" stop-opacity="0.7" />
          <stop offset="100%" stop-color="#11353c" stop-opacity="0.2" />
        </linearGradient>

        <!-- Shaded area fill under the main surge -->
        <linearGradient id="surge-area" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0d706d" stop-opacity="0.25" />
          <stop offset="60%" stop-color="#162a34" stop-opacity="0.08" />
          <stop offset="100%" stop-color="#162a34" stop-opacity="0" />
        </linearGradient>

        <linearGradient id="gold-area" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#dfb56d" stop-opacity="0.15" />
          <stop offset="100%" stop-color="#dfb56d" stop-opacity="0" />
        </linearGradient>

        <!-- Ambient Grid Dot Pattern -->
        <pattern id="dot-grid" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="#dfb56d" fill-opacity="0.12" />
        </pattern>
      </defs>

      <!-- Background Dot Grid -->
      <rect width="560" height="300" fill="url(#dot-grid)" />

      <!-- Coordinate Calibration Lines -->
      <g stroke="#dfb56d" stroke-opacity="0.12" stroke-width="1">
        <line x1="40" y1="70" x2="520" y2="70" stroke-dasharray="3 4" />
        <line x1="40" y1="140" x2="520" y2="140" stroke-dasharray="3 4" />
        <line x1="40" y1="210" x2="520" y2="210" stroke-dasharray="3 4" />
        <line x1="120" y1="40" x2="120" y2="250" stroke-dasharray="2 4" stroke-opacity="0.08" />
        <line x1="260" y1="40" x2="260" y2="250" stroke-dasharray="2 4" stroke-opacity="0.08" />
        <line x1="400" y1="40" x2="400" y2="250" stroke-dasharray="2 4" stroke-opacity="0.08" />
      </g>

      <!-- Equilibrium Baseline -->
      <line x1="30" y1="210" x2="530" y2="210" stroke="#dfb56d" stroke-opacity="0.3" stroke-width="1.2" />
      <text
        x="445"
        y="204"
        fill="#dfb56d"
        fill-opacity="0.5"
        font-family="'SF Mono', Menlo, monospace"
        font-size="9"
        letter-spacing="1"
      >
        EQUILIBRIUM
      </text>

      <!-- Wave Shaded Area -->
      <path
        d="M 30 210
           C 90 210, 130 110, 190 110
           C 250 110, 290 180, 350 180
           C 410 180, 460 80, 530 80
           L 530 250 L 30 250 Z"
        fill="url(#surge-area)"
      />

      <path
        d="M 30 210
           C 100 210, 140 150, 200 150
           C 260 150, 300 220, 360 220
           C 420 220, 470 140, 530 140
           L 530 250 L 30 250 Z"
        fill="url(#gold-area)"
      />

      <!-- Wave Ribbon 1 (Teal Momentum Surge) -->
      <path
        d="M 30 210
           C 90 210, 130 110, 190 110
           C 250 110, 290 180, 350 180
           C 410 180, 460 80, 530 80"
        stroke="url(#wave-teal-grad)"
        stroke-width="2.5"
        stroke-linecap="round"
        fill="none"
      />

      <!-- Wave Ribbon 2 (Golden Crest Tide / 澜) -->
      <path
        d="M 30 210
           C 100 210, 140 145, 200 145
           C 260 145, 300 220, 360 220
           C 420 220, 470 135, 530 135"
        stroke="url(#wave-gold-grad)"
        stroke-width="2.2"
        stroke-linecap="round"
        fill="none"
      />

      <!-- Harmonic Echo Wave (Faint Thin Line) -->
      <path
        d="M 30 225
           C 100 225, 140 170, 200 170
           C 260 170, 300 235, 360 235
           C 420 235, 470 165, 530 165"
        stroke="#dfb56d"
        stroke-opacity="0.25"
        stroke-width="1"
        stroke-dasharray="4 3"
        fill="none"
      />

      <!-- Milestone Focus Nodes -->
      <!-- Node 1: Macro Peak -->
      <g transform="translate(190, 110)">
        <circle cx="0" cy="0" r="7" fill="#dfb56d" fill-opacity="0.15" />
        <circle cx="0" cy="0" r="3.5" fill="#162a34" stroke="#dfb56d" stroke-width="1.8" />
        <circle cx="0" cy="0" r="1.5" fill="#fff" />
        <text x="8" y="-4" fill="#dfb56d" font-family="'PingFang SC', sans-serif" font-size="10" font-weight="500">
          宏观周期
        </text>
      </g>

      <!-- Node 2: Structure Anchor -->
      <g transform="translate(350, 180)">
        <circle cx="0" cy="0" r="7" fill="#16815f" fill-opacity="0.2" />
        <circle cx="0" cy="0" r="3.5" fill="#162a34" stroke="#16815f" stroke-width="1.8" />
        <circle cx="0" cy="0" r="1.5" fill="#fff" />
        <text x="8" y="14" fill="#67cfab" font-family="'PingFang SC', sans-serif" font-size="10" font-weight="500">
          结构配比
        </text>
      </g>

      <!-- Node 3: Rebalance Crest -->
      <g transform="translate(530, 80)">
        <circle cx="0" cy="0" r="8" fill="#dfb56d" fill-opacity="0.25" />
        <circle cx="0" cy="0" r="4" fill="#162a34" stroke="#f5e0a9" stroke-width="2" />
        <circle cx="0" cy="0" r="1.8" fill="#fff" />
        <text x="-48" y="-8" fill="#f5e0a9" font-family="'PingFang SC', sans-serif" font-size="10" font-weight="600">
          再平衡
        </text>
      </g>

      <!-- Polaris Guiding Star (Top Right) -->
      <g transform="translate(480, 42)">
        <circle cx="0" cy="0" r="1.8" fill="#fff" />
        <path d="M0 -6 L0 6 M-6 0 L6 0" stroke="#dfb56d" stroke-width="1" stroke-linecap="round" />
        <circle cx="0" cy="0" r="8" stroke="#dfb56d" stroke-opacity="0.25" stroke-width="0.8" stroke-dasharray="2 2" />
      </g>
    </svg>
  </div>
</template>
<style scoped>
.wave-art-wrapper {
  width: 100%;
  max-width: 560px;
  overflow: hidden;
  filter: drop-shadow(0 12px 36px rgb(0 0 0 / 25%));
}

.wave-svg {
  display: block;
}
</style>
