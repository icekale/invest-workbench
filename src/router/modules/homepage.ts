import { ChartIcon, EditIcon, PreciseMonitorIcon, SearchIcon } from 'tdesign-icons-vue-next';
import { shallowRef } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

import { LAYOUT } from '@/utils/route/constant';

export default [
  {
    path: '/dashboard',
    component: LAYOUT,
    name: 'dashboard',
    redirect: '/dashboard/index',
    meta: {
      title: { zh_CN: '仓位总览', en_US: 'Overview' },
      icon: shallowRef(PreciseMonitorIcon),
      orderNo: 0,
      single: true,
    },
    children: [
      {
        path: 'index',
        name: 'DashboardIndex',
        component: () => import('@/pages/dashboard/index.vue'),
        meta: { title: { zh_CN: '仓位总览', en_US: 'Overview' } },
      },
    ],
  },
  {
    path: '/funds',
    component: LAYOUT,
    name: 'funds',
    redirect: '/funds/index',
    meta: {
      title: { zh_CN: '研究与决策', en_US: 'Research' },
      icon: shallowRef(SearchIcon),
      orderNo: 1,
      single: true,
    },
    children: [
      {
        path: 'index',
        name: 'FundsIndex',
        component: () => import('@/pages/funds/index.vue'),
        meta: { title: { zh_CN: '研究与决策', en_US: 'Research' } },
      },
      {
        path: 'detail/:code',
        name: 'FundsDetail',
        component: () => import('@/pages/funds/detail.vue'),
        meta: { title: { zh_CN: '基金详情', en_US: 'Fund' }, hidden: true },
      },
      {
        path: 'compare',
        name: 'FundsCompare',
        component: () => import('@/pages/funds/compare.vue'),
        meta: { title: { zh_CN: '基金对比', en_US: 'Compare' }, hidden: true },
      },
      {
        path: 'research',
        name: 'FundsResearch',
        component: () => import('@/pages/funds/research.vue'),
        meta: { title: { zh_CN: '方法论', en_US: 'Research' }, hidden: true },
      },
      {
        path: 'recommend',
        name: 'FundsRecommend',
        component: () => import('@/pages/funds/recommend.vue'),
        meta: { title: { zh_CN: '优质精选', en_US: 'Picks' }, hidden: true },
      },
      {
        path: 'database',
        name: 'FundsDatabase',
        component: () => import('@/pages/funds/database.vue'),
        meta: { title: { zh_CN: '基金数据', en_US: 'Database' }, hidden: true },
      },
      {
        path: 'portfolios',
        name: 'FundsPortfolios',
        component: () => import('@/pages/funds/portfolios.vue'),
        meta: { title: { zh_CN: '策略组合', en_US: 'Portfolios' }, hidden: true },
      },
    ],
  },
  {
    path: '/plan',
    component: LAYOUT,
    name: 'plan',
    redirect: '/plan/index',
    meta: {
      title: { zh_CN: '账户与数据', en_US: 'Accounts' },
      icon: shallowRef(EditIcon),
      orderNo: 3,
      single: true,
    },
    children: [
      {
        path: 'index',
        name: 'PlanIndex',
        component: () => import('@/pages/plan/index.vue'),
        meta: { title: { zh_CN: '账户与数据', en_US: 'Accounts' } },
      },
    ],
  },
  {
    path: '/review',
    component: LAYOUT,
    name: 'review',
    redirect: '/review/index',
    meta: {
      title: { zh_CN: '持有与复盘', en_US: 'Review' },
      icon: shallowRef(ChartIcon),
      orderNo: 2,
      single: true,
    },
    children: [
      {
        path: 'index',
        name: 'ReviewIndex',
        component: () => import('@/pages/review/index.vue'),
        meta: { title: { zh_CN: '持有与复盘', en_US: 'Review' } },
      },
    ],
  },
] satisfies RouteRecordRaw[];
