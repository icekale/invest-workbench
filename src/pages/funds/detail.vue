<template>
  <div class="invest-page">
    <t-button variant="text" @click="router.push('/funds/index')">返回列表</t-button>
    <template v-if="fund">
      <h1 class="invest-title">{{ fund.name }}</h1>
      <p class="invest-sub">{{ fund.code }} · {{ fund.manager }} · {{ fund.type }}</p>
      <section class="invest-card">
        <div class="invest-grid-2">
          <div>
            <div class="invest-muted">近一年收益</div>
            <div class="invest-kpi">{{ fund.yield }}%</div>
          </div>
          <div>
            <div class="invest-muted">波动</div>
            <div class="invest-kpi">{{ fund.vix }}</div>
          </div>
          <div>
            <div class="invest-muted">最大回撤</div>
            <div class="invest-kpi">{{ fund.loss }}%</div>
          </div>
          <div>
            <div class="invest-muted">评分 / 星级</div>
            <div class="invest-kpi">{{ fund.score }} · {{ fund.star }}星</div>
          </div>
        </div>
        <t-button style="margin-top: 12px" variant="outline" @click="invest.toggleWatch(fund.code)">
          {{ invest.watchlist.includes(fund.code) ? '移出备选池' : '加入备选池' }}
        </t-button>
      </section>
    </template>
    <p v-else class="invest-sub">基金数据暂不可用</p>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { funds } from '@/mock/invest';
import { useInvestStore } from '@/store';

defineOptions({ name: 'FundsDetail' });

const route = useRoute();
const router = useRouter();
const invest = useInvestStore();
const fund = computed(() => funds.find((f) => f.code === String(route.params.code)));
</script>
