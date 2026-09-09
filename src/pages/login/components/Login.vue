<template>
  <div class="login-form-wrapper">
    <t-form
      ref="form"
      class="login-password-form"
      :data="formData"
      :rules="FORM_RULES"
      label-align="top"
      :disabled="loading"
      @submit="onSubmit"
    >
      <t-form-item name="account" label="账号">
        <t-input v-model="formData.account" size="large" placeholder="请输入账号" clearable autocomplete="username">
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
          placeholder="请输入密码"
          autocomplete="current-password"
        >
          <template #prefix-icon>
            <t-icon name="lock-on" />
          </template>
          <template #suffix-icon>
            <t-icon :name="showPsw ? 'browse' : 'browse-off'" class="toggle-pwd-btn" @click="showPsw = !showPsw" />
          </template>
        </t-input>
      </t-form-item>

      <div class="btn-container">
        <t-button block size="large" theme="primary" type="submit" :loading="loading" class="login-submit-btn">
          登录
        </t-button>
      </div>
      <p class="auth-switch">没有账号？<a @click="emit('go-register')">注册</a></p>
    </t-form>
  </div>
</template>
<script setup lang="ts">
import type { FormInstanceFunctions, FormRule, SubmitContext } from 'tdesign-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useInvestStore, useUserStore } from '@/store';
import { bindCloudSync } from '@/utils/cloud-sync';
import { settleConflictsIfNeeded } from '@/utils/sync-ui';

const emit = defineEmits<{ 'go-register': [] }>();
const userStore = useUserStore();

const INITIAL_DATA = {
  account: 'xiong',
  password: 'demo',
};

const FORM_RULES = computed<Record<string, FormRule[]>>(() => ({
  account: [{ required: true, message: '请输入账号', type: 'error' }],
  password: [{ required: true, message: '请输入密码', type: 'error' }],
}));

const form = ref<FormInstanceFunctions>();
const formData = ref({ ...INITIAL_DATA });
const showPsw = ref(false);
const loading = ref(false);

const router = useRouter();
const route = useRoute();

const onSubmit = async (ctx: SubmitContext) => {
  if (ctx.validateResult === true) {
    try {
      loading.value = true;
      await userStore.login(formData.value);
      const account = String(formData.value.account || '').trim();
      useInvestStore().adoptUser(account);
      await bindCloudSync(useInvestStore());
      await settleConflictsIfNeeded();
      const redirect = route.query.redirect as string;
      router.push(redirect || '/dashboard');
    } catch (e: unknown) {
      MessagePlugin.error((e as Error).message || '账号或密码错误');
    } finally {
      loading.value = false;
    }
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
    color: var(--td-text-color-primary, #14212b);
    line-height: 1.4;
  }

  :deep(.t-input) {
    height: 44px;
    border-radius: 8px;
    background-color: var(--td-bg-color-container, #fff);
    border: 1px solid var(--guanlan-line, #e6eaed);
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
    font-size: 14px;

    &:hover {
      border-color: var(--td-brand-color, #0d706d);
    }

    &.t-is-focused {
      border-color: var(--td-brand-color, #0d706d);
      box-shadow: 0 0 0 2px rgb(13 112 109 / 15%);
    }
  }

  .toggle-pwd-btn {
    cursor: pointer;
    color: var(--td-text-color-placeholder, #5e6c76);

    &:hover {
      color: var(--td-text-color-primary, #14212b);
    }
  }
}

.btn-container {
  margin-top: 8px;

  .login-submit-btn {
    height: 46px;
    border-radius: 8px;
    background-color: var(--td-brand-color, #0d706d);
    border: none;
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.5px;
    box-shadow: 0 4px 14px rgb(13 112 109 / 25%);

    &:hover {
      background-color: #0b5f5c;
    }
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
