/// <reference types="vite/client" />

/* Typed so a missing dev var is a build error rather than an undefined at
   runtime. Both are TEMPORARY and go at step 6 with src/sdk/dev/. */
interface ImportMetaEnv {
  readonly VITE_DEV_MEETING_TOKEN?: string
  readonly VITE_DEV_MEETING_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
