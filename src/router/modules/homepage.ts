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
      title: { zh_CN: '投资驾驶舱', en_US: 'Cockpit' },
      icon: shallowRef(PreciseMonitorIcon),
      orderNo: 0,
      single: true,
    },
    children: [
      {
        path: 'index',
        name: 'DashboardIndex',
        component: () => import('@/pages/dashboard/index.vue'),
        meta: { title: { zh_CN: '投资驾驶舱', en_US: 'Cockpit' } },
      },
    ],
  },
  {
    path: '/funds',
    component: LAYOUT,
    name: 'funds',
    redirect: '/funds/index',
    meta: {
      title: { zh_CN: '公募研究', en_US: 'Funds' },
      icon: shallowRef(SearchIcon),
      orderNo: 1,
      single: true,
    },
    children: [
      {
        path: 'index',
        name: 'FundsIndex',
        component: () => import('@/pages/funds/index.vue'),
        meta: { title: { zh_CN: '公募研究', en_US: 'Funds' } },
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
    ],
  },
  {
    path: '/plan',
    component: LAYOUT,
    name: 'plan',
    redirect: '/plan/index',
    meta: {
      title: { zh_CN: '计划与执行', en_US: 'Plan' },
      icon: shallowRef(EditIcon),
      orderNo: 2,
      single: true,
    },
    children: [
      {
        path: 'index',
        name: 'PlanIndex',
        component: () => import('@/pages/plan/index.vue'),
        meta: { title: { zh_CN: '计划与执行', en_US: 'Plan' } },
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
      orderNo: 3,
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
