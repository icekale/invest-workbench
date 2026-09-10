import { MessagePlugin } from 'tdesign-vue-next';
import { reactive, ref } from 'vue';

import { useInvestStore } from '@/store';
import type { AccountId } from '@/types/invest';

export const todoDialogVisible = ref(false);

/** 基金/ETF 相关的待办默认落基金桶；没有基金桶或它被归档时，落第一个在用的桶。 */
export function defaultFundAccount(): AccountId {
  const list = useInvestStore().activeAccounts;
  return list.find((a) => a.kind === 'etf')?.id ?? list[0]?.id ?? 'stock';
}

export const todoForm = reactive({
  account: 'etf' as AccountId,
  code: '',
  name: '',
  side: 'buy' as 'buy' | 'sell',
  quantity: 1000,
  exec: '即期',
  reason: '',
});

/** 表单里选的桶可能刚被归档，提交前对回注册表。 */
function usableAccount(): AccountId {
  const list = useInvestStore().activeAccounts;
  return list.some((a) => a.id === todoForm.account) ? todoForm.account : defaultFundAccount();
}

export function quickAddTodo(code: string, name: string, reason: string) {
  todoForm.code = code;
  todoForm.name = name;
  todoForm.account = defaultFundAccount();
  todoForm.side = 'buy';
  todoForm.quantity = 2000;
  todoForm.exec = '即期';
  todoForm.reason = reason;
  todoDialogVisible.value = true;
}

export function openCreateTodoDialog() {
  todoForm.code = '';
  todoForm.name = '';
  // 新建待办是空白表单，别拿上一次选过的桶凑，也顺便把归档的修正掉
  todoForm.account = usableAccount();
  todoForm.side = 'buy';
  todoForm.quantity = 1000;
  todoForm.exec = '即期';
  todoForm.reason = '';
  todoDialogVisible.value = true;
}

export function confirmCreateTodo() {
  if (!todoForm.name.trim()) {
    MessagePlugin.warning('请填写标的名称');
    return;
  }
  const invest = useInvestStore();
  invest.addTodo({
    account: usableAccount(),
    code: todoForm.code.trim() || '—',
    name: todoForm.name.trim(),
    side: todoForm.side,
    quantity: todoForm.quantity,
    exec: todoForm.exec.trim() || '即期',
    reason: todoForm.reason.trim() || '投研决策执行',
  });
  todoDialogVisible.value = false;
  MessagePlugin.success(`已加入【${todoForm.name}】交易计划`);
}
