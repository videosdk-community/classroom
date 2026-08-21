import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import type { VercelRequest } from '@vercel/node'
import { HttpError } from './http.js'
import { readEnv } from './env.js'

/* The service-role client, and the one function that turns a request into a
   trusted user.

   Verification is auth.getUser(accessToken), not a local signature check.
   Local verification proves the token was SIGNED, not that the session still
   EXISTS - a signed-out or deleted user's unexpired access token would still
   mint a teacher token, and no test would show it. It also avoids shipping a
   JWKS fetcher, a cache and key rotation into a serverless function. The cost
   is one round trip per join, which happens once every ten minutes at most.

   If this ever became hot, the fix is getClaims() against a cached JWKS - not
   a hand-rolled HS256 verify. */

export function serviceClient(): SupabaseClient {
  const env = readEnv()
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function requireUser(req: VercelRequest, db: SupabaseClient): Promise<User> {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) {
    throw new HttpError(401, 'unauthenticated', 'Sign in to continue.')
  }

  const { data, error } = await db.auth.getUser(token)
  if (error || !data.user) {
    throw new HttpError(401, 'unauthenticated', 'That session is no longer valid. Sign in again.')
  }
  return data.user
}
