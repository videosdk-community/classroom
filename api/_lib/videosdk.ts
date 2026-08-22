import { HttpError } from './http.js'

/* The VideoSDK REST calls this app makes.

   Authorization carries the raw JWT with no `Bearer` prefix - their API
   rejects the prefix. */

const BASE = 'https://api.videosdk.live/v2'

export async function createRoom(token: string): Promise<{ roomId: string }> {
  const res = await fetch(`${BASE}/rooms`, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    /* Every parameter is optional and we send none. autoCloseConfig in
       particular is left at the account default - the docs name the enum
       `session-ends` while the live API reports `session-end` back, and a
       value we cannot spell confidently buys nothing over the default that
       already ends the session when the last participant leaves. */
    body: JSON.stringify({}),
  })

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200)
    console.error('[api] room creation failed', res.status, detail)
    throw new HttpError(
      502,
      'videosdk_unavailable',
      `VideoSDK could not create the room (HTTP ${res.status}).`,
    )
  }

  /* The response field is roomId, not meetingId. */
  const room = (await res.json()) as { roomId?: string }
  if (!room.roomId) {
    throw new HttpError(502, 'videosdk_unavailable', 'VideoSDK returned a room with no roomId.')
  }
  return { roomId: room.roomId }
}

/* One recording, trimmed to what the app shows. The row exists from the
   moment recording STARTS, with no file on it - so a caller has to key off
   file.fileUrl, never off the row. */
export interface RecordingFile {
  id: string
  fileUrl: string
  sizeBytes: number | null
  durationSeconds: number | null
  createdAt: string | null
}

interface RawRecording {
  id?: string
  createdAt?: string
  file?: {
    id?: string
    fileUrl?: string
    size?: number
    createdAt?: string
    meta?: { duration?: number }
  }
}

/* GET /v2/recordings?roomId= - the room-scoped list.

   Not the documented /v1/meeting-recordings: that one filters by meetingId or
   sessionId, which would cost a session lookup per room, while v2 takes the
   roomId we already hold. v2 is what spec.md locked in against a live probe.

   Failures are swallowed into an empty list on purpose. This is called once
   per room in a fan-out, and one room that 500s must not blank the page. */
export async function listRecordings(token: string, roomId: string): Promise<RecordingFile[]> {
  const res = await fetch(`${BASE}/recordings?roomId=${encodeURIComponent(roomId)}`, {
    headers: { Authorization: token },
  })

  if (!res.ok) {
    console.error('[api] recordings list failed', roomId, res.status, (await res.text()).slice(0, 200))
    return []
  }

  const body = (await res.json()) as { data?: RawRecording[] }
  const rows = Array.isArray(body.data) ? body.data : []

  return rows.flatMap((row) => {
    const file = row.file
    if (!file?.fileUrl) return []
    return [
      {
        id: file.id ?? row.id ?? file.fileUrl,
        fileUrl: file.fileUrl,
        sizeBytes: typeof file.size === 'number' ? file.size : null,
        durationSeconds: typeof file.meta?.duration === 'number' ? file.meta.duration : null,
        createdAt: file.createdAt ?? row.createdAt ?? null,
      },
    ]
  })
}
