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
      <t-form-item name="account" label="工作台账号">
        <t-input
          v-model="formData.account"
          size="large"
          placeholder="请输入管理员账号"
          clearable
          autocomplete="username"
        >
          <template #prefix-icon>
            <t-icon name="user" />
          </template>
        </t-input>
      </t-form-item>

      <t-form-item name="password" label="访问凭证">
        <t-input
          v-model="formData.password"
          size="large"
          :type="showPsw ? 'text' : 'password'"
          clearable
          placeholder="请输入访问凭证"
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

      <!-- Quick Demo Account Fill -->
      <div class="demo-quick-bar">
        <span class="demo-tip">演示环境就绪</span>
        <button type="button" class="demo-fill-btn" @click="fillDemoAccount">快速填入 (xiong / demo)</button>
      </div>

      <div class="btn-container">
        <t-button block size="large" theme="primary" type="submit" :loading="loading" class="login-submit-btn">
          <span>进入工作台</span>
        </t-button>
      </div>
    </t-form>
  </div>
</template>
<script setup lang="ts">
import type { FormInstanceFunctions, FormRule, SubmitContext } from 'tdesign-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useUserStore } from '@/store';

const userStore = useUserStore();

const INITIAL_DATA = {
  account: 'xiong',
  password: 'demo',
};

const FORM_RULES = computed<Record<string, FormRule[]>>(() => ({
  account: [{ required: true, message: '请输入工作台账号', type: 'error' }],
  password: [{ required: true, message: '请输入访问凭证', type: 'error' }],
}));

const form = ref<FormInstanceFunctions>();
const formData = ref({ ...INITIAL_DATA });
const showPsw = ref(false);
const loading = ref(false);

const router = useRouter();
const route = useRoute();

const fillDemoAccount = () => {
  formData.value.account = 'xiong';
  formData.value.password = 'demo';
  MessagePlugin.info('已填入管理员演示凭证');
};

const onSubmit = async (ctx: SubmitContext) => {
  if (ctx.validateResult === true) {
    try {
      loading.value = true;
      await userStore.login(formData.value);
      MessagePlugin.success('欢迎进入观澜投资工作台');
      const redirect = route.query.redirect as string;
      router.push(redirect || '/dashboard');
    } catch (e: unknown) {
      MessagePlugin.error((e as Error).message || '账号或凭证错误');
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
    transition: all 0.2s ease;
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
    transition: color 0.2s;

    &:hover {
      color: var(--td-text-color-primary, #14212b);
    }
  }
}

.demo-quick-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: -6px;
  margin-bottom: 24px;
  font-size: 12px;

  .demo-tip {
    color: var(--td-text-color-secondary, #4f5d67);
  }

  .demo-fill-btn {
    border: none;
    background: transparent;
    color: var(--td-brand-color, #0d706d);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    transition: background-color 0.2s;

    &:hover {
      background-color: rgb(13 112 109 / 8%);
      text-decoration: underline;
    }
  }
}

.btn-container {
  margin-top: 10px;

  .login-submit-btn {
    height: 46px;
    border-radius: 8px;
    background-color: var(--td-brand-color, #0d706d);
    border: none;
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.5px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow: 0 4px 14px rgb(13 112 109 / 25%);
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

    &:hover {
      background-color: #0b5f5c;
      transform: translateY(-1px);
      box-shadow: 0 6px 18px rgb(13 112 109 / 32%);
    }

    &:active {
      transform: translateY(0);
    }
  }
}
</style>
