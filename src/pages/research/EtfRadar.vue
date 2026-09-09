<template>
  <!-- 宏观驱动因子 → ETF 资产配置雷达与标的建议 -->
  <t-card title="宏观因子 → ETF 资产配置雷达" subtitle="将宏观定调（弱复苏·宽货币·资产荒）精准映射至可执行标的">
    <t-row :gutter="[16, 16]">
      <t-col :xs="12" :md="4">
        <div class="radar-group">
          <div class="radar-hd">
            <span class="radar-tag defense">🛡️ 防守稳健底仓</span>
            <span class="radar-weight">建议仓位 35% ~ 45%</span>
          </div>
          <p class="radar-desc">长端利率处于历史低位，长久期国债与高股息红利构筑全天候护城河。</p>
          <div class="radar-targets">
            <div class="target-row">
              <div class="target-info">
                <span class="target-name">30年国债ETF</span>
                <span class="target-code">511090</span>
              </div>
              <t-button
                size="small"
                variant="text"
                theme="primary"
                @click="quickAddTodo('511090', '30年国债ETF', '资产荒对冲配置')"
              >
                + 待办
              </t-button>
            </div>
            <div class="target-row">
              <div class="target-info">
                <span class="target-name">红利低波ETF</span>
                <span class="target-code">512890</span>
              </div>
              <t-button
                size="small"
                variant="text"
                theme="primary"
                @click="quickAddTodo('512890', '红利低波ETF', '高股息现金流护航')"
              >
                + 待办
              </t-button>
            </div>
          </div>
        </div>
      </t-col>

      <t-col :xs="12" :md="4">
        <div class="radar-group">
          <div class="radar-hd">
            <span class="radar-tag core">⚖️ 核心大盘宽基</span>
            <span class="radar-weight">建议仓位 30% ~ 40%</span>
          </div>
          <p class="radar-desc">股债利差处于历史 84% 极值分位，大盘优质资产中长期赔率突出。</p>
          <div class="radar-targets">
            <div class="target-row">
              <div class="target-info">
                <span class="target-name">中证A500ETF</span>
                <span class="target-code">560510</span>
              </div>
              <t-button
                size="small"
                variant="text"
                theme="primary"
                @click="quickAddTodo('560510', '中证A500ETF', '新一代核心宽基底仓')"
              >
                + 待办
              </t-button>
            </div>
            <div class="target-row">
              <div class="target-info">
                <span class="target-name">沪深300ETF</span>
                <span class="target-code">510300</span>
              </div>
              <t-button
                size="small"
                variant="text"
                theme="primary"
                @click="quickAddTodo('510300', '沪深300ETF', '大盘龙头定投')"
              >
                + 待办
              </t-button>
            </div>
          </div>
        </div>
      </t-col>

      <t-col :xs="12" :md="4">
        <div class="radar-group">
          <div class="radar-hd">
            <span class="radar-tag offense">🚀 弹性成长突破</span>
            <span class="radar-weight">建议仓位 15% ~ 25%</span>
          </div>
          <p class="radar-desc">聚焦新质生产力与流动性敏感资产，博弈政策落地与科技创新周期。</p>
          <div class="radar-targets">
            <div class="target-row">
              <div class="target-info">
                <span class="target-name">科创50ETF</span>
                <span class="target-code">588000</span>
              </div>
              <t-button
                size="small"
                variant="text"
                theme="primary"
                @click="quickAddTodo('588000', '科创50ETF', '半导体新质生产力弹性')"
              >
                + 待办
              </t-button>
            </div>
            <div class="target-row">
              <div class="target-info">
                <span class="target-name">黄金ETF</span>
                <span class="target-code">518880</span>
              </div>
              <t-button
                size="small"
                variant="text"
                theme="primary"
                @click="quickAddTodo('518880', '黄金ETF', '逆全球化与货币信用对冲')"
              >
                + 待办
              </t-button>
            </div>
          </div>
        </div>
      </t-col>
    </t-row>
  </t-card>
</template>
<script setup lang="ts">
import { quickAddTodo } from './todo';
</script>
