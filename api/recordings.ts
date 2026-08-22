import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handle, json, requireGet } from './_lib/http.js'
import { readEnv } from './_lib/env.js'
import { signMeetingToken } from './_lib/tokens.js'
import { listRecordings } from './_lib/videosdk.js'
import { requireUser, serviceClient } from './_lib/supabase.js'

/* GET /api/recordings - the recordings of classes you own.

   VideoSDK has no "recordings for this account, grouped by owner" call, and
   no owner concept at all: every recording under the account is reachable by
   anyone holding the secret. So ownership is decided here, before a single
   REST call goes out - the caller's rooms come from public.rooms under the
   service role, keyed on the verified session, and only those roomIds are
   ever asked about.

   A roomId is never read from the request. Same rule as api/session.ts: the
   only thing this handler trusts is the Bearer token. */

const MAX_ROOMS = 25
const DEFAULT_LIMIT = 3
const MAX_LIMIT = 50

interface RoomRow {
  room_id: string
  title: string
}

function readLimit(req: VercelRequest): number {
  const raw = req.query.limit
  const value = Number(Array.isArray(raw) ? raw[0] : raw)
  if (!Number.isFinite(value) || value < 1) return DEFAULT_LIMIT
  return Math.min(Math.floor(value), MAX_LIMIT)
}

export default handle(async (req: VercelRequest, res: VercelResponse) => {
  requireGet(req)

  const env = readEnv()
  const db = serviceClient()
  const user = await requireUser(req, db)
  const limit = readLimit(req)

  const { data, error } = await db
    .from('rooms')
    .select('room_id, title')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(MAX_ROOMS)

  if (error) {
    console.error('[api] rooms select failed', error)
    json(res, 200, { recordings: [] })
    return
  }

  const rooms = (data ?? []) as RoomRow[]
  if (rooms.length === 0) {
    json(res, 200, { recordings: [] })
    return
  }

  /* Unscoped and short-lived, exactly like the room-creation token: one
     token covers the whole fan-out, and the probe confirmed this permission
     pair is what the recordings API accepts. */
  const restToken = signMeetingToken({
    apiKey: env.videosdkApiKey,
    secret: env.videosdkSecret,
    permissions: ['allow_join', 'allow_mod'],
    ttlSeconds: 120,
  })

  const perRoom = await Promise.all(
    rooms.map(async (room) => {
      const files = await listRecordings(restToken, room.room_id)
      return files.map((file) => ({
        id: file.id,
        roomId: room.room_id,
        title: room.title,
        fileUrl: file.fileUrl,
        sizeBytes: file.sizeBytes,
        durationSeconds: file.durationSeconds,
        createdAt: file.createdAt,
      }))
    }),
  )

  /* Newest first, and a row with no date sorts last rather than to the top. */
  const recordings = perRoom
    .flat()
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .slice(0, limit)

  json(res, 200, { recordings })
})
