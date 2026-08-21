#!/usr/bin/env node
/* A redeemed session as JSON, for seeding a browser in an automated run.
 *
 *     node scripts/link.mjs someone@example.com
 *
 * dev-session.mjs prints an access token for a human to eyeball. A test needs
 * the whole session object, because the browser client stores it under
 * `sb-<project-ref>-auth-token` and refreshes from it.
 *
 * The magic link itself cannot be driven by a test: the client is on the pkce
 * flow, and an admin-generated link comes back as an implicit hash grant with
 * no code verifier to match, so /auth/callback waits forever. Redeeming here
 * and seeding localStorage reaches the same state.
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY, so it never runs in a browser. */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = {}
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
}

const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const pub = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false },
})

/* Created up front rather than implicitly by the link, so a brand new test
   account does not fail its first redemption. */
await admin.auth.admin.createUser({ email: process.argv[2], email_confirm: true })

const { data, error } = await admin.auth.admin.generateLink({
  type: 'magiclink',
  email: process.argv[2],
})
if (error) { console.error(error.message); process.exit(1) }

const { data: redeemed, error: redeemError } = await pub.auth.verifyOtp({
  type: 'magiclink',
  token_hash: data.properties.hashed_token,
})
if (redeemError) { console.error(redeemError.message); process.exit(1) }
console.log(JSON.stringify(redeemed.session))
