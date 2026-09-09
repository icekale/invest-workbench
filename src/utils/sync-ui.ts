import { DialogPlugin } from 'tdesign-vue-next';

import { applyEnd, getPendingConflicts } from './cloud-sync';

export function settleConflictsIfNeeded(): Promise<void> {
  const n = getPendingConflicts().length;
  if (!n) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = async (pick: 'local' | 'remote') => {
      if (done) return;
      done = true;
      await applyEnd(pick);
      resolve();
    };
    DialogPlugin.confirm({
      header: '两端数据不一致',
      body: `${n} 条记录在本机和云端都被改过，请选择保留哪一端。`,
      confirmBtn: { content: '用本机', theme: 'primary' },
      cancelBtn: '用云端',
      closeOnOverlayClick: false,
      closeOnEscKeydown: false,
      onConfirm: () => {
        void finish('local');
      },
      onCancel: () => {
        void finish('remote');
      },
      onClose: () => {
        void finish('local');
      },
    });
  });
}
