import type { VercelRequest, VercelResponse } from '@vercel/node'
import { HttpError, handle, json, readJson, requirePost } from './_lib/http.js'
import { readEnv } from './_lib/env.js'
import { signMeetingToken } from './_lib/tokens.js'
import { createRoom } from './_lib/videosdk.js'
import { requireUser, serviceClient } from './_lib/supabase.js'

/* POST /api/rooms - start a class.

   Creating the VideoSDK room needs the account secret, so this cannot happen
   in a browser; and because the row must never claim a roomId nobody owns,
   public.rooms has no insert policy at all and the grant is revoked. This
   handler, under the service role, is the only way a row exists.

   owner_id comes from the verified session and nothing else. It is the fact
   every later role decision is derived from. */

const MODES = new Set(['class', 'lecture'])

export default handle(async (req: VercelRequest, res: VercelResponse) => {
  requirePost(req)

  const env = readEnv()
  const db = serviceClient()
  const user = await requireUser(req, db)

  const body = readJson(req)
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const mode = body.mode

  if (title.length < 1 || title.length > 120) {
    throw new HttpError(400, 'invalid_body', 'Give the class a title, up to 120 characters.')
  }
  if (typeof mode !== 'string' || !MODES.has(mode)) {
    throw new HttpError(400, 'invalid_body', 'Mode must be either "class" or "lecture".')
  }

  /* Unscoped and short-lived: this token exists to create a room, so it has
     no roomId to be scoped to yet. */
  const restToken = signMeetingToken({
    apiKey: env.videosdkApiKey,
    secret: env.videosdkSecret,
    permissions: ['allow_join', 'allow_mod'],
    ttlSeconds: 120,
  })

  const { roomId } = await createRoom(restToken)

  const { data, error } = await db
    .from('rooms')
    .insert({ room_id: roomId, owner_id: user.id, title, mode })
    .select('id, room_id, title, mode, created_at')
    .single()

  if (error || !data) {
    /* The VideoSDK room now exists with no row pointing at it. We leave it:
       a room costs nothing until someone joins, and a compensating delete is
       more failure surface than the leak it cleans up. */
    console.error('[api] rooms insert failed', error)
    throw new HttpError(500, 'internal', 'The class could not be saved. Try again.')
  }

  json(res, 201, {
    room: {
      id: data.id,
      roomId: data.room_id,
      title: data.title,
      mode: data.mode,
      createdAt: data.created_at,
    },
  })
})
