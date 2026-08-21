import { supabase } from './supabase'

/* The browser's side of api/.

   Every call carries the Supabase access token as a Bearer header, which is
   the only thing the functions trust. Nothing else in the body is believed:
   no role, no mode, no participant id. */

export class ApiError extends Error {
  code: string
  status: number

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) {
    throw new ApiError(401, 'unauthenticated', 'Sign in to continue.')
  }

  const res = await fetch(path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  /* A non-JSON body here almost always means the SPA rewrite swallowed the
     request and returned index.html - the classic symptom of running plain
     vite instead of vercel dev. Say so, rather than surfacing a parse error
     that points nowhere near the cause. */
  const text = await res.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    throw new ApiError(
      res.status,
      'not_json',
      `${path} did not return JSON. Is the app running under \`pnpm dev\` (vercel dev), not \`pnpm dev:vite\`?`,
    )
  }

  if (!res.ok) {
    const err = (parsed as { error?: { code?: string; message?: string } }).error
    throw new ApiError(
      res.status,
      err?.code ?? 'unknown',
      err?.message ?? `Request failed (HTTP ${res.status}).`,
    )
  }
  return parsed as T
}
