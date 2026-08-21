/// <reference types="vite/client" />

/* The two public Supabase vars, declared NON-optional on purpose.

   A missing var then fails at the call site as a type error rather than
   slipping through as `undefined` and reaching createClient, which throws at
   runtime with a message that does not name the variable. */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
