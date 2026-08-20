/* TEMPORARY, step 4 only. Deleted at step 6 with src/sdk/dev/.
 *
 * Mints a meeting token and creates a room, so the SDK seam can join something
 * real before api/session.ts exists. Node's built-in crypto only - no
 * dependency is added for a script that is scheduled for deletion.
 *
 * Usage:  node scripts/mint-dev-token.mjs
 * Writes: .env.local  (gitignored by the .env.* rule)
 */
import { createHmac } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

function readEnvFile(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, 'utf8')
        .split('\n')
        .filter((l) => l.trim() && !l.trim().startsWith('#'))
        .map((l) => {
          const i = l.indexOf('=')
          return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
        }),
    )
  } catch {
    return {}
  }
}

const env = { ...readEnvFile('.env'), ...process.env }
const apiKey = env.VIDEOSDK_API_KEY
const secret = env.VIDEOSDK_SECRET

const missing = [
  !apiKey && 'VIDEOSDK_API_KEY',
  !secret && 'VIDEOSDK_SECRET',
].filter(Boolean)

if (missing.length) {
  console.error(`\nMissing from .env: ${missing.join(', ')}`)
  console.error('Both are needed. The token is signed HS256 with the secret,')
  console.error('so the API key alone cannot produce one.\n')
  process.exit(1)
}

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function sign(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64url(JSON.stringify(payload))
  const sig = b64url(createHmac('sha256', secret).update(`${header}.${body}`).digest())
  return `${header}.${body}.${sig}`
}

const now = Math.floor(Date.now() / 1000)

/* allow_join, NOT ask_join. With ask_join and no moderator in the room the
   SDK holds at CONNECTING waiting for someone who does not exist, and a
   perfectly working seam looks broken. allow_mod is what makes the
   moderation controls testable. */
const token = sign({
  apikey: apiKey,
  permissions: ['allow_join', 'allow_mod'],
  version: 2,
  iat: now,
  exp: now + 24 * 60 * 60,
})

const res = await fetch('https://api.videosdk.live/v2/rooms', {
  method: 'POST',
  headers: { Authorization: token, 'Content-Type': 'application/json' },
  body: JSON.stringify({}),
})

if (!res.ok) {
  console.error(`Room creation failed: ${res.status}`)
  console.error((await res.text()).slice(0, 400))
  process.exit(1)
}

const room = await res.json()
const meetingId = room.roomId

/* Scoped to the room it just created. Tokens are validated at join only, so a
   short life never disconnects an active participant - but this one is a day
   because it is a dev convenience, not the production shape. */
const scoped = sign({
  apikey: apiKey,
  permissions: ['allow_join', 'allow_mod'],
  version: 2,
  roomId: meetingId,
  iat: now,
  exp: now + 24 * 60 * 60,
})

const existing = readEnvFile('.env.local')
writeFileSync(
  '.env.local',
  Object.entries({ ...existing, VITE_DEV_MEETING_TOKEN: scoped, VITE_DEV_MEETING_ID: meetingId })
    .map(([k, v]) => `${k}=${v}`)
    .join('\n') + '\n',
)

console.log(`\nRoom created: ${meetingId}`)
console.log('Wrote VITE_DEV_MEETING_TOKEN and VITE_DEV_MEETING_ID to .env.local')
console.log('Restart the dev server so Vite picks them up.\n')
