import type { VercelRequest, VercelResponse } from '@vercel/node'
import { HttpError, handle, json, readJson, requirePost } from './_lib/http.js'
import { readEnv } from './_lib/env.js'
import { signMeetingToken, type Permission } from './_lib/tokens.js'
import { requireUser, serviceClient } from './_lib/supabase.js'

/* POST /api/session - the security centre of the whole app.

   It verifies the Supabase session, looks up who owns the room, and derives
   the meeting permissions from that lookup. Every other field in the request
   is ignored: no role, no mode, no participantId is ever read from the
   client. Ownership is the only input.

   It also returns the room's mode, which is how "mode is read once at join,
   from a source the client cannot forge" costs no extra round trip. */

const TEACHER: readonly Permission[] = ['allow_join', 'allow_mod']
const STUDENT: readonly Permission[] = ['ask_join']

/* Long enough that nobody is disconnected mid-sentence by a slow precall,
   short enough that a leaked token is worthless by the time it is found.
   VideoSDK validates the token at join only, so expiry never interrupts an
   active participant. */
const TTL_SECONDS = 600

export default handle(async (req: VercelRequest, res: VercelResponse) => {
  requirePost(req)

  const env = readEnv()
  const db = serviceClient()
  const user = await requireUser(req, db)

  const body = readJson(req)
  const roomId = typeof body.roomId === 'string' ? body.roomId.trim() : ''
  if (!roomId) {
    throw new HttpError(400, 'invalid_body', 'No class was named in the request.')
  }

  const { data: room, error } = await db
    .from('rooms')
    .select('room_id, owner_id, title, mode, ended_at')
    .eq('room_id', roomId)
    .maybeSingle()

  if (error) {
    console.error('[api] rooms lookup failed', error)
    throw new HttpError(500, 'internal', 'The class could not be looked up. Try again.')
  }
  if (!room) {
    throw new HttpError(404, 'room_not_found', 'That link does not point to a class.')
  }
  if (room.ended_at) {
    throw new HttpError(409, 'room_ended', 'This class has ended.')
  }

  const isOwner = room.owner_id === user.id

  /* participantId is derived from the Supabase user id: stable across
     reloads, and unique per person. With version 2 in the payload this pins
     one seat per account, so the same login in two tabs collides - intended,
     and the reason two accounts are needed to test this properly. */
  const token = signMeetingToken({
    apiKey: env.videosdkApiKey,
    secret: env.videosdkSecret,
    permissions: isOwner ? TEACHER : STUDENT,
    roomId: room.room_id,
    participantId: user.id,
    ttlSeconds: TTL_SECONDS,
  })

  res.setHeader('Cache-Control', 'no-store')
  json(res, 200, {
    meetingId: room.room_id,
    token,
    mode: room.mode,
    title: room.title,
    /* Decoration, for deciding which buttons to draw. The enforcement lives
       in the token's permissions array and NOWHERE else - never gate a
       moderation action on this field alone. */
    role: isOwner ? 'teacher' : 'student',
    participantId: user.id,
    expiresIn: TTL_SECONDS,
  })
})
