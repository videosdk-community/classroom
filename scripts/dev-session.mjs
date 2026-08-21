#!/usr/bin/env node
/* Sign a test account in without sending an email.
 *
 *     node scripts/dev-session.mjs someone@example.com
 *
 * Supabase's built-in email sender is testing-only and rate-limited to a
 * handful of messages an hour for the whole project, which is enough to sign
 * in once but nowhere near enough to iterate. The admin API can mint the
 * magic link directly, and its token hash can be redeemed straight away.
 *
 * Prints the access token and the action link. The link opens the real
 * /auth/callback path in a browser; the token is what an automated test
 * would seed. Needs SUPABASE_SERVICE_ROLE_KEY, so it never runs in a browser.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'

const email = process.argv[2]
if (!email) {
  console.error('Usage: node scripts/dev-session.mjs <email>')
  process.exit(1)
}

const env = { ...readEnvFile('.env'), ...process.env }

function readEnvFile(path) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq > 0) out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return out
}

const url = env.VITE_SUPABASE_URL
const service = env.SUPABASE_SERVICE_ROLE_KEY
const publishable = env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !service || !publishable) {
  console.error('Need VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_PUBLISHABLE_KEY.')
  process.exit(1)
}

const admin = createClient(url, service, { auth: { persistSession: false } })
const pub = createClient(url, publishable, { auth: { persistSession: false } })

/* Creates the user if this is their first time, exactly as a real magic link
   would with shouldCreateUser. */
const { data: link, error: linkError } = await admin.auth.admin.generateLink({
  type: 'magiclink',
  email,
})
if (linkError) {
  console.error(`Could not mint a link for ${email}: ${linkError.message}`)
  process.exit(1)
}

const { data, error } = await pub.auth.verifyOtp({
  type: 'magiclink',
  token_hash: link.properties.hashed_token,
})
if (error) {
  console.error(`Could not redeem the link: ${error.message}`)
  process.exit(1)
}

console.log(`user  ${data.user.id}  ${data.user.email}`)
console.log(`\naccess_token:\n${data.session.access_token}`)
console.log(`\nOr open this once in a browser:\n${link.properties.action_link}`)
