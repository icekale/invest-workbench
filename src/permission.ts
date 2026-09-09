import 'nprogress/nprogress.css'; // progress bar style

import NProgress from 'nprogress'; // progress bar
import { MessagePlugin } from 'tdesign-vue-next';
import type { RouteRecordRaw } from 'vue-router';

import router from '@/router';
import { getPermissionStore, useUserStore } from '@/store';

NProgress.configure({ showSpinner: false });

router.beforeEach(async (to, from, next) => {
  NProgress.start();

  const permissionStore = getPermissionStore();
  const { whiteListRouters } = permissionStore;

  const userStore = useUserStore();

  if (userStore.token) {
    if (to.path === '/login') {
      next();
      return;
    }
    try {
      if (!userStore.userInfo?.name) await userStore.getUserInfo();

      if (permissionStore.asyncRoutes.length === 0) {
        const routeList = await permissionStore.buildAsyncRoutes();
        routeList.forEach((item: RouteRecordRaw) => {
          router.addRoute(item);
        });
      }
      if (to.name && router.hasRoute(to.name)) {
        next();
      } else {
        next(`/`);
      }
    } catch (error) {
      MessagePlugin.error((error as Error).message);
      next({
        path: '/login',
        query: { redirect: to.fullPath },
      });
      NProgress.done();
    }
  } else {
    /* white list router */
    if (whiteListRouters.includes(to.path)) {
      next();
    } else {
      next({
        path: '/login',
        query: { redirect: to.fullPath },
      });
    }
    NProgress.done();
  }
});

router.afterEach((to) => {
  if (to.path === '/login') {
    const userStore = useUserStore();
    const permissionStore = getPermissionStore();

    userStore.logout();
    permissionStore.restoreRoutes();
  }
  NProgress.done();
});
