import type { GlobalConfigProvider } from 'tdesign-vue-next';
import { computed } from 'vue';

import type { SupportedLocale } from '@/locales/index';
import { i18n, supportedLocales } from '@/locales/index';
import { useNotificationStore } from '@/store/modules/notification';

export function useLocale() {
  const locale = computed({
    get: () => i18n.global.locale.value,
    set: (val: string) => {
      i18n.global.locale.value = val;
    },
  });

  const changeLocale = (lang: string) => {
    const validLang = supportedLocales.includes(lang as SupportedLocale) ? (lang as SupportedLocale) : 'zh_CN';
    locale.value = validLang;
    useNotificationStore().refreshMsgData();
  };

  const getComponentsLocale = computed(() => {
    return (i18n.global.getLocaleMessage(locale.value) as Record<string, any>).componentsLocale as GlobalConfigProvider;
  });

  return {
    changeLocale,
    getComponentsLocale,
    locale,
  };
}
