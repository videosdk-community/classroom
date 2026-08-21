import { createHmac } from 'node:crypto'

/* VideoSDK meeting tokens, signed HS256 with the account secret.

   Lifted from the step-4 dev-token script, since deleted, which proved the
   technique against the live API before this file existed. node:crypto only - a JWT this shape
   does not earn a dependency.

   Two payload rules that are not cosmetic:

   - version: 2 is what makes roomId and participantId actually enforced.
     Without it they are ignored and every token is a skeleton key.
   - `roles` is deliberately absent. 'crawler' is REST-only and 'rtc' is
     meeting-only, so setting either splits one token into two; omitting it
     lets the same signer create a room and join one. */

export type Permission = 'allow_join' | 'ask_join' | 'allow_mod'

export interface SignOptions {
  apiKey: string
  secret: string
  permissions: readonly Permission[]
  roomId?: string
  participantId?: string
  /** Tokens are validated at join only, so a short life never disconnects an
      active participant. */
  ttlSeconds?: number
}

const b64url = (input: string | Buffer): string =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export function signMeetingToken(opts: SignOptions): string {
  const now = Math.floor(Date.now() / 1000)
  const payload: Record<string, unknown> = {
    apikey: opts.apiKey,
    permissions: opts.permissions,
    version: 2,
    iat: now,
    exp: now + (opts.ttlSeconds ?? 600),
  }
  if (opts.roomId) payload.roomId = opts.roomId
  if (opts.participantId) payload.participantId = opts.participantId

  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64url(JSON.stringify(payload))
  const sig = b64url(createHmac('sha256', opts.secret).update(`${header}.${body}`).digest())
  return `${header}.${body}.${sig}`
}
