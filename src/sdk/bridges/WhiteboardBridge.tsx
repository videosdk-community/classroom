import { useEffect } from 'react'
import { useWhiteboard } from '@videosdk.live/react-sdk'
import type { RoomStore } from '../store'

/* useWhiteboard is exactly three members: startWhiteboard, stopWhiteboard,
   whiteboardUrl. No role, no read-only, no URL params, no events on
   useMeeting. Confirmed against the shipped typings.

   A caution that is NOT in the plan and needs a two-browser probe before
   anything is built on it: in the bundle, `whiteboardUrl` is plain
   useState(null) seeded only by the `whiteboard-started` event, with no
   initial query on join. A participant who joins AFTER the board was started
   may therefore see null forever. The js-sdk can also emit that event with a
   {state} payload rather than {url}, which the React hook ignores outright.

   If the probe shows late joiners are stranded, the fix is the mechanism
   DECISIONS.md already blesses for CLASS_CONTROLS: the teacher also publishes
   the url to a persisted pubsub topic and whichever arrives first wins. The
   store already carries `url` separately from the actions, so that is an
   additive change here and nowhere else. */

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
