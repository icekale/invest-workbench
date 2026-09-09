import { defineStore } from 'pinia';

import { t } from '@/locales';
import { usePermissionStore } from '@/store';
import type { UserInfo } from '@/types/interface';
import { basicToken, loginAgainstSync, parseBasic, setSyncCreds } from '@/utils/cloud-sync';

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
      const account = String(userInfo.account || '').trim();
      const password = String(userInfo.password || '');
      if (!account || !password) {
        throw new Error(t('pages.login.validation.passwordError'));
      }
      try {
        await loginAgainstSync(account, password);
      } catch (e) {
        throw e instanceof Error ? e : new Error(t('pages.login.validation.passwordError'));
      }
      this.token = basicToken(account, password);
      this.userInfo = { name: account, roles: ['all'] };
    },
    async getUserInfo() {
      if (this.token === 'main_token') {
        const u = import.meta.env.VITE_AUTH_USER || 'xiong';
        const p = import.meta.env.VITE_AUTH_PASS || 'demo';
        this.token = basicToken(u, p);
        setSyncCreds(u, p);
      }
      const creds = parseBasic(this.token);
      this.userInfo = { name: creds?.user || 'user', roles: ['all'] };
      if (creds) setSyncCreds(creds.user, creds.pass);
    },
    async logout() {
      this.token = '';
      this.userInfo = { ...InitUserInfo };
      setSyncCreds('', '');
      const { useInvestStore } = await import('./invest');
      useInvestStore().adoptUser();
    },
  },
  persist: {
    afterHydrate: () => {
      const permissionStore = usePermissionStore();
      permissionStore.initRoutes();
    },
    key: 'user',
    pick: ['token'],
    storage: typeof sessionStorage === 'undefined' ? undefined : sessionStorage,
  },
});
