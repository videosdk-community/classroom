import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, apiPost } from '../lib/api'
import type { RoomSession } from './types'

/* Fetches the meeting session for a room.

   This lives ABOVE the precall/room pair on purpose. MeetingProvider reads
   its config on first mount and ignores changes afterwards, so a token that
   resolves later would be silently ignored; by resolving it here, Precall
   mounts with a concrete token and RoomProvider mounts exactly once, with a
   token that never changes underneath it. */

export type SessionStatus = 'loading' | 'error' | 'ready'

export interface SessionState {
  status: SessionStatus
  session: RoomSession | null
  error: { code: string; message: string } | null
  retry: () => void
  /* Re-mints just before joining. Ten minutes can elapse while somebody picks
     a microphone, and a token is validated at join. */
  refresh: () => Promise<RoomSession>
}

export function useSession(roomId: string | undefined): SessionState {
  const [attempt, setAttempt] = useState(0)
  /* Result and the request it belongs to are one piece of state, so a change
     of room or a retry makes the old result stale by derivation rather than
     by a synchronous reset inside the effect. */
  const [result, setResult] = useState<{
    key: string
    session: RoomSession | null
    error: { code: string; message: string } | null
  } | null>(null)

  const key = `${roomId ?? ''}|${attempt}`
  const live = useRef(true)

  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  const mint = useCallback(async (): Promise<RoomSession> => {
    if (!roomId) throw new ApiError(404, 'room_not_found', 'That link does not point to a class.')
    return apiPost<RoomSession>('/api/session', { roomId })
  }, [roomId])

  useEffect(() => {
    let cancelled = false

    void mint()
      .then((session) => {
        if (!cancelled) setResult({ key, session, error: null })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setResult({
          key,
          session: null,
          error:
            err instanceof ApiError
              ? { code: err.code, message: err.message }
              : { code: 'unknown', message: 'The class could not be opened.' },
        })
      })

    return () => {
      cancelled = true
    }
  }, [mint, key])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  const refresh = useCallback(async () => {
    const session = await mint()
    if (live.current) setResult({ key, session, error: null })
    return session
  }, [mint, key])

  /* Anything belonging to an earlier request reads as still loading. */
  const current = result?.key === key ? result : null

  return {
    status: current?.error ? 'error' : current?.session ? 'ready' : 'loading',
    session: current?.session ?? null,
    error: current?.error ?? null,
    retry,
    refresh,
  }
}
