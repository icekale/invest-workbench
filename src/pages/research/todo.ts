import { MessagePlugin } from 'tdesign-vue-next';
import { reactive, ref } from 'vue';

import { useInvestStore } from '@/store';
import type { AccountId } from '@/types/invest';

export const todoDialogVisible = ref(false);
export const todoForm = reactive({
  account: 'etf' as AccountId,
  code: '',
  name: '',
  side: 'buy' as 'buy' | 'sell',
  quantity: 1000,
  exec: '即期',
  reason: '',
});

export function quickAddTodo(code: string, name: string, reason: string) {
  todoForm.code = code;
  todoForm.name = name;
  todoForm.account = 'etf';
  todoForm.side = 'buy';
  todoForm.quantity = 2000;
  todoForm.exec = '即期';
  todoForm.reason = reason;
  todoDialogVisible.value = true;
}

export function openCreateTodoDialog() {
  todoForm.code = '';
  todoForm.name = '';
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
    account: todoForm.account,
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
