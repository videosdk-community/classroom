import { HttpError } from './http.js'

/* The two VideoSDK REST calls this app makes.

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
