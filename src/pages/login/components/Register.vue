<template>
  <div class="login-form-wrapper">
    <t-form
      class="login-password-form"
      :data="formData"
      :rules="FORM_RULES"
      label-align="top"
      :disabled="loading"
      @submit="onSubmit"
    >
      <t-form-item name="account" label="账号">
        <t-input
          v-model="formData.account"
          size="large"
          placeholder="字母数字 ._- ，最多 32 位"
          clearable
          autocomplete="username"
        >
          <template #prefix-icon>
            <t-icon name="user" />
          </template>
        </t-input>
      </t-form-item>
      <t-form-item name="password" label="密码">
        <t-input
          v-model="formData.password"
          size="large"
          :type="showPsw ? 'text' : 'password'"
          clearable
          placeholder="至少 4 位"
          autocomplete="new-password"
        >
          <template #prefix-icon>
            <t-icon name="lock-on" />
          </template>
          <template #suffix-icon>
            <t-icon :name="showPsw ? 'browse' : 'browse-off'" class="toggle-pwd-btn" @click="showPsw = !showPsw" />
          </template>
        </t-input>
      </t-form-item>
      <t-form-item name="confirm" label="确认密码">
        <t-input
          v-model="formData.confirm"
          size="large"
          :type="showPsw ? 'text' : 'password'"
          clearable
          placeholder="再输入一次密码"
          autocomplete="new-password"
        >
          <template #prefix-icon>
            <t-icon name="lock-on" />
          </template>
        </t-input>
      </t-form-item>
      <div class="btn-container">
        <t-button block size="large" theme="primary" type="submit" :loading="loading" class="login-submit-btn"
          >注册并进入</t-button
        >
      </div>
      <p class="auth-switch">已有账号？<a @click="emit('go-login')">去登录</a></p>
    </t-form>
  </div>
</template>
<script setup lang="ts">
import type { FormRule, SubmitContext } from 'tdesign-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useInvestStore, useUserStore } from '@/store';
import { bindCloudSync, registerAccount } from '@/utils/cloud-sync';

const emit = defineEmits<{ 'go-login': [] }>();
const userStore = useUserStore();
const router = useRouter();
const route = useRoute();

const formData = ref({ account: '', password: '', confirm: '' });
const showPsw = ref(false);
const loading = ref(false);

const FORM_RULES = computed<Record<string, FormRule[]>>(() => ({
  account: [
    { required: true, message: '请输入账号', type: 'error' },
    { pattern: /^[\w.-]{1,32}$/, message: '账号须为字母数字 ._-', type: 'error' },
  ],
  password: [
    { required: true, message: '请输入密码', type: 'error' },
    { min: 4, message: '密码至少 4 位', type: 'error' },
  ],
  confirm: [
    { required: true, message: '请再次输入密码', type: 'error' },
    {
      validator: (val: string) => val === formData.value.password,
      message: '两次密码不一致',
      type: 'error',
    },
  ],
}));

const onSubmit = async (ctx: SubmitContext) => {
  if (ctx.validateResult !== true) return;
  try {
    loading.value = true;
    const account = formData.value.account.trim();
    await registerAccount(account, formData.value.password);
    await userStore.login({ account, password: formData.value.password });
    useInvestStore().adoptUser(account);
    await bindCloudSync(useInvestStore());
    router.push((route.query.redirect as string) || '/dashboard');
  } catch (e: unknown) {
    MessagePlugin.error((e as Error).message || '注册失败');
  } finally {
    loading.value = false;
  }
};
</script>
<style lang="less" scoped>
.login-form-wrapper {
  width: 100%;
}

.login-password-form {
  :deep(.t-form__item) {
    margin-bottom: 20px;
  }

  :deep(.t-form__label) {
    padding-bottom: 6px;
    font-size: 12px;
    font-weight: 500;
  }

  :deep(.t-input) {
    height: 44px;
    border-radius: 8px;
  }
}

.btn-container {
  margin-top: 8px;

  .login-submit-btn {
    height: 46px;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
  }
}

.auth-switch {
  margin-top: 16px;
  text-align: center;
  font-size: 13px;
  color: var(--td-text-color-secondary, #73808a);

  a {
    color: var(--td-brand-color, #0d706d);
    cursor: pointer;
  }
}
</style>
