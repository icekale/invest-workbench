<template>
  <div class="invest-page">
    <h1 class="invest-title">公募研究</h1>
    <p class="invest-sub">智能组合、优质精选、基金数据。第一期为模拟评分。</p>

    <t-tabs v-model="tab">
      <t-tab-panel value="smart" label="智能组合">
        <div class="invest-grid-2" style="margin-top: 12px">
          <section v-for="p in smartPortfolios" :key="p.id" class="invest-card">
            <div class="invest-kpi">{{ p.name }}</div>
            <div class="invest-muted">风险 {{ p.risk }}</div>
            <p class="invest-sub">{{ p.blurb }}</p>
            <div v-for="f in p.funds" :key="f.code">{{ fundName(f.code) }} · {{ Math.round(f.weight * 100) }}%</div>
          </section>
        </div>
      </t-tab-panel>

      <t-tab-panel value="pick" label="优质精选">
        <t-space style="margin: 12px 0">
          <t-select v-model="type" clearable placeholder="类型" :options="typeOptions" style="width: 140px" />
          <t-input-number v-model="minStar" :min="1" :max="5" theme="column" label="最低星级" />
          <t-input-number v-model="maxDrawdown" :min="1" :max="80" theme="column" label="回撤上限%" />
        </t-space>
        <p v-if="!picked.length" class="invest-muted">未找到匹配的基金</p>
        <div class="invest-grid-2">
          <section v-for="f in picked" :key="f.code" class="invest-card">
            <div class="invest-kpi" style="cursor: pointer" @click="goDetail(f.code)">{{ f.name }}</div>
            <div class="invest-muted">{{ f.manager }} · {{ f.type }} · {{ f.star }}星</div>
            <p>收益 {{ f.yield }}% · 波动 {{ f.vix }} · 回撤 {{ f.loss }}%</p>
            <t-button size="small" variant="outline" @click="invest.toggleWatch(f.code)">
              {{ invest.watchlist.includes(f.code) ? '移出备选池' : '加入备选池' }}
            </t-button>
          </section>
        </div>
        <section class="invest-card" style="margin-top: 12px">
          <div class="invest-muted">我的备选池</div>
          <p v-if="!watchFunds.length" class="invest-muted">还没有备选基金</p>
          <div v-for="f in watchFunds" :key="f.code">
            <t-link @click="goDetail(f.code)">{{ f.name }}</t-link>
          </div>
        </section>
      </t-tab-panel>

      <t-tab-panel value="data" label="基金数据">
        <t-space style="margin: 12px 0">
          <t-input v-model="keyword" placeholder="搜索名称 / 代码 / 经理" clearable />
          <t-button :disabled="selected.length < 2" @click="goCompare">对比已选</t-button>
        </t-space>
        <p v-if="!searched.length" class="invest-muted">未找到匹配的基金</p>
        <t-table
          v-else
          :data="searched"
          :columns="dataCols"
          row-key="code"
          size="small"
          hover
          :selected-row-keys="selected"
          @select-change="onSelect"
        />
      </t-tab-panel>
    </t-tabs>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { funds, smartPortfolios } from '@/mock/invest';
import { useInvestStore } from '@/store';

defineOptions({ name: 'FundsIndex' });

const invest = useInvestStore();
const router = useRouter();
const tab = ref('smart');
const type = ref<string | undefined>();
const minStar = ref(3);
const maxDrawdown = ref(40);
const keyword = ref('');
const selected = ref<string[]>([]);

const typeOptions = [...new Set(funds.map((f) => f.type))].map((v) => ({ label: v, value: v }));

const picked = computed(() =>
  funds.filter((f) => {
    if (type.value && f.type !== type.value) return false;
    if (f.star < minStar.value) return false;
    if (f.loss < -maxDrawdown.value) return false;
    return true;
  }),
);

const searched = computed(() => {
  const q = keyword.value.trim();
  return funds.filter((f) => !q || `${f.code}${f.name}${f.manager}`.includes(q));
});

const watchFunds = computed(() => funds.filter((f) => invest.watchlist.includes(f.code)));

const dataCols = [
  { colKey: 'row-select', type: 'multiple' as const, width: 46 },
  { colKey: 'code', title: '代码' },
  { colKey: 'name', title: '名称' },
  { colKey: 'manager', title: '经理' },
  { colKey: 'yield', title: '收益', sorter: true },
  { colKey: 'vix', title: '波动', sorter: true },
  { colKey: 'loss', title: '回撤', sorter: true },
  { colKey: 'score', title: '评分', sorter: true },
];

function fundName(code: string) {
  return funds.find((f) => f.code === code)?.name || code;
}
function goDetail(code: string) {
  router.push(`/funds/detail/${code}`);
}
function onSelect(keys: (string | number)[]) {
  selected.value = keys.map(String).slice(0, 4);
}
function goCompare() {
  router.push({ path: '/funds/compare', query: { codes: selected.value.join(',') } });
}
</script>
