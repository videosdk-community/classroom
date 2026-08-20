import { useEffect } from 'react'
import { useWhiteboard } from '@videosdk.live/react-sdk'
import type { RoomStore } from '../store'

/* useWhiteboard is exactly three members: startWhiteboard, stopWhiteboard,
   whiteboardUrl. No role, no read-only, no URL params, no events on
   useMeeting. Confirmed against the shipped typings.

   One concern was raised against this and then PROBED AND RETIRED on
   2026-08-20, so it does not need re-litigating. Reading the bundle,
   `whiteboardUrl` is plain useState(null) seeded only by the
   `whiteboard-started` event with no initial query on join, which suggests a
   participant joining AFTER the board was started would see null forever.

   Driven in three browsers rather than reasoned about: the board was started
   from one, and it appeared both in the participant already in the room and
   in a third that joined afterwards. The server replays the event on join, so
   late joiners are fine and no pubsub fallback is needed.

   If that ever regresses, the fix is the mechanism DECISIONS.md already
   blesses for CLASS_CONTROLS - publish the url to a persisted topic and take
   whichever arrives first - and it would be additive here and nowhere else. */

export function WhiteboardBridge({ store }: { store: RoomStore }) {
  const { startWhiteboard, stopWhiteboard, whiteboardUrl } = useWhiteboard()

  useEffect(() => {
    store.setWhiteboard({ url: whiteboardUrl ?? null })
  }, [store, whiteboardUrl])

  useEffect(() => {
    const existing = store.getActions()
    if (!existing) return

    store.setActions({
      ...existing,
      /* The in-flight flag is optimistic and ours. 4056 arrives from the
         server after a double-click has already happened, so it can confirm
         this state but cannot create it. */
      startWhiteboard: async () => {
        store.setWhiteboard({ inFlight: true, error: null })
        try {
          await startWhiteboard()
        } catch {
          /* Swallowed deliberately. The SDK ALSO emits this failure to
             onError, which is where the human sentence is set; rethrowing
             here would surface the same problem twice and leave an unhandled
             rejection in the console. */
        } finally {
          store.setWhiteboard({ inFlight: false })
        }
      },
      stopWhiteboard: async () => {
        store.setWhiteboard({ inFlight: true, error: null })
        try {
          await stopWhiteboard()
        } catch {
          /* See above. */
        } finally {
          store.setWhiteboard({ inFlight: false })
        }
      },
    })
  }, [store, startWhiteboard, stopWhiteboard])

  return null
}
