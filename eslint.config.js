import antfu from '@antfu/eslint-config';
import { globalIgnores } from 'eslint/config';
import prettier from 'eslint-plugin-prettier/recommended';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import vueCss from 'eslint-plugin-vue-scoped-css';
import globals from 'globals';
import typescript from 'typescript-eslint';

export default antfu(
  {
    typescript: true,
    vue: true,
    jsonc: false,
    yaml: false,
    markdown: false,
    formatters: false,
  },
  [
    ...vueCss.configs['flat/recommended'],
    prettier,
    {
      languageOptions: {
        globals: {
          ...globals.browser,
          ...globals.node,
          ...globals.jest,
          defineProps: 'readonly',
          defineEmits: 'readonly',
        },
        ecmaVersion: 6,
        sourceType: 'module',

        parserOptions: {
          parser: typescript.parser,
          allowImportExportEverywhere: true,

          ecmaFeatures: {
            jsx: true,
          },
        },
      },

      plugins: {
        'simple-import-sort': simpleImportSort,
      },

      settings: {
        'import/extensions': ['.js', '.jsx', '.ts', '.tsx'],
      },

      rules: {
        /* Closed due to template running
         * (Recommended to open!)
         */
        'no-console': 'off',
        'ts/no-explicit-any': 'off',

        /* Disallow person rules */
        'antfu/top-level-function': 'off',
        'antfu/if-newline': 'off',
        'n/prefer-global/process': 'off',

        /* If you need control the imports sequence, must be off
         *  https://github.com/vuejs/vue-eslint-parser/issues/58
         */
        'import/first': 'off',

        /* Allow start with _ */
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
          },
        ],
        'vue/no-unused-vars': [
          'error',
          {
            ignorePattern: '^_',
          },
        ],
        // Using ts/no-unused-vars instead
        'no-unused-vars': 'off',

        /* Some variables are initialized in the function */
        '@typescript-eslint/no-use-before-define': 'off',
        'no-use-before-define': 'off',

        /* Disable antfu sort, use simple sort import */
        'perfectionist/sort-imports': 'off',
        'perfectionist/sort-named-imports': 'off',
        'simple-import-sort/imports': 'error',
        'simple-import-sort/exports': 'error',
        // Disable unused-imports rules in other presets
        'unused-imports/no-unused-imports': 'off',
        'unused-imports/no-unused-vars': 'off',
      },
    },
    {
      files: ['**/*.vue'],

      rules: {
        'vue/component-name-in-template-casing': ['error', 'kebab-case'],
        'vue/custom-event-name-casing': ['error', 'kebab-case'],
        'vue/block-order': [
          'error',
          {
            order: ['template', 'script', 'style'],
          },
        ],
        'vue/block-lang': [
          'error',
          {
            script: {
              lang: ['ts', 'tsx'],
            },
          },
        ],
        'vue/multi-word-component-names': 'off',
        'vue/no-reserved-props': 'off',
        'vue/no-v-html': 'off',

        'vue-scoped-css/no-parsing-error': 'off',
        'vue-scoped-css/no-unused-selector': 'off',
        'vue-scoped-css/enforce-style-type': [
          'error',
          {
            allows: ['scoped'],
          },
        ],
        'vue/padding-line-between-blocks': ['error', 'never'],
      },
    },
    globalIgnores([
      // public/ 是原样搬进 dist 的资源目录，既不参与构建也不是应用代码，lint 它没有意义。
      // 但 `eslint --ext .js ./` 会连它一起扫：截图识别用的 tesseract-core 是 3.95MB 的
      // 压缩产物（内含 3.8MB base64），解析它会让 eslint 直接 OOM（实测 heap 冲到 4GB 崩掉），
      // 连带 pre-commit 的 lint-staged 一起挂、提交被卡住。
      'public',
      '**/snapshot*',
      '**/dist',
      '**/lib',
      '**/es',
      '**/esm',
      '**/node_modules',
      'src/_common',
      '**/static',
      '**/cypress',
      'script/test/cypress',
      '**/_site',
      '**/temp*',
      '**/static/',
      '!**/.prettierrc.js',
    ]),
  ],
);
