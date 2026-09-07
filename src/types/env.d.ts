interface ImportMetaEnv {
  readonly VITE_IS_REQUEST_PROXY: string;
  readonly VITE_API_URL: string;
  readonly VITE_API_URL_PREFIX: string;
  readonly VITE_AUTH_USER: string;
  readonly VITE_AUTH_PASS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
