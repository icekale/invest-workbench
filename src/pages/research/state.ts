import { ref } from 'vue';

export const bargainCount = ref(0);
export const macroState = ref<'never' | 'loading' | 'ok' | 'error'>('never');
