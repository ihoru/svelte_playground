/// <reference types="svelte" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly MY_TODOIST_ACCESS_TOKEN: string;
  readonly MY_STORAGE_URL: string;
  readonly MY_GAP_BETWEEN_TASKS_MINUTES: number;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
