import { defineStore } from 'pinia';

import { t } from '@/locales';
import { usePermissionStore } from '@/store';
import type { UserInfo } from '@/types/interface';

const InitUserInfo: UserInfo = {
  name: '',
  roles: [],
};

export const useUserStore = defineStore('user', {
  state: () => ({
    token: '',
    userInfo: { ...InitUserInfo },
  }),
  getters: {
    roles: (state) => {
      return state.userInfo?.roles;
    },
  },
  actions: {
    async login(userInfo: Record<string, unknown>) {
      const account = String(userInfo.account || '');
      const password = String(userInfo.password || '');
      const user = import.meta.env.VITE_AUTH_USER || 'xiong';
      const pass = import.meta.env.VITE_AUTH_PASS || 'demo';
      if (account !== user || password !== pass) {
        throw new Error(t('pages.login.validation.passwordError'));
      }
      this.token = 'main_token';
    },
    async getUserInfo() {
      this.userInfo = { name: '熊总', roles: ['all'] };
    },
    async logout() {
      this.token = '';
      this.userInfo = { ...InitUserInfo };
    },
  },
  persist: {
    afterHydrate: () => {
      const permissionStore = usePermissionStore();
      permissionStore.initRoutes();
    },
    key: 'user',
    pick: ['token'],
  },
});
