import { HttpError } from './http.js'

/* Server-only configuration.

   Read INSIDE the handler, never at module scope. A module-scope throw on
   Vercel surfaces as an opaque 500 with no body and no stack in the response,
   which is a bad afternoon; thrown from inside the handler it becomes a
   server_misconfigured error that names the missing variable.

   Values are trimmed. A trailing space on VIDEOSDK_API_KEY - which is exactly
   what this repo's .env had - signs a token the API rejects with "'apikey'
   provided in the token is empty or invalid", pointing at the key rather than
   at the whitespace. */

export interface ServerEnv {
  videosdkApiKey: string
  videosdkSecret: string
  supabaseUrl: string
  supabaseServiceRoleKey: string
}

const NAMES = {
  videosdkApiKey: 'VIDEOSDK_API_KEY',
  videosdkSecret: 'VIDEOSDK_SECRET',
  supabaseUrl: 'VITE_SUPABASE_URL',
  supabaseServiceRoleKey: 'SUPABASE_SERVICE_ROLE_KEY',
} as const

export function readEnv(): ServerEnv {
  const out = {} as ServerEnv
  const missing: string[] = []

  for (const [key, name] of Object.entries(NAMES) as [keyof ServerEnv, string][]) {
    const value = process.env[name]?.trim()
    if (!value) missing.push(name)
    else out[key] = value
  }

  if (missing.length > 0) {
    throw new HttpError(
      500,
      'server_misconfigured',
      `Missing server environment: ${missing.join(', ')}.`,
    )
  }
  return out
}
