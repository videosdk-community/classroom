import { warn } from '../log'

/* Camera and microphone permission, read directly from the browser.

   The SDK's checkPermissions() is deliberately NOT used here, for two reasons
   verified in js-sdk 1.1.1 rather than assumed:

   1. It cannot tell "blocked" from "never asked". Its own branch is
        if (res.state == "prompt" || res.state == "denied") allowed = false
      so both collapse to false. A UI built on that either shows recovery
      instructions to a first-time user who has simply not been asked yet, or
      shows a dead Retry button to someone who is genuinely blocked. Both are
      the exact failure precall exists to avoid.

   2. It THROWS on browsers without the descriptor - the bundle contains
      "does not support camera permission check" - so an unguarded
      `await checkPermissions()` breaks precall entirely on Firefox rather
      than degrading.

   navigator.permissions.query gives the three states we actually need, and
   everything it cannot answer is treated as 'unknown' rather than as a
   refusal. */

export type DoorState = 'granted' | 'prompt' | 'denied' | 'unknown'

export type DeviceKind = 'camera' | 'microphone'

export async function queryDoor(kind: DeviceKind): Promise<DoorState> {
  if (!navigator.permissions?.query) return 'unknown'
  try {
    const result = await navigator.permissions.query({ name: kind as PermissionName })
    return result.state as DoorState
  } catch {
    /* Firefox has no 'camera' descriptor. Not an error, just unanswerable -
       we find out by asking for the stream instead. */
    return 'unknown'
  }
}

export interface PermissionOutcome {
  state: DoorState
  stream?: MediaStream
}

/* Asking is the only way to move a 'prompt' along, and the answer is the
   stream itself. The re-query afterwards is what separates "dismissed" from
   "blocked": Escape on Chrome's dialog rejects the request but leaves the
   door at 'prompt', and a user who only needs to click again must not be sent
   to a settings walkthrough. */
export async function requestAccess(
  constraints: MediaStreamConstraints,
  kind: DeviceKind,
): Promise<PermissionOutcome> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    return { state: 'granted', stream }
  } catch (err) {
    const name = (err as DOMException)?.name

    /* No device attached at all. Different from blocked, and it needs
       different words - no amount of browser settings will conjure a camera. */
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return { state: 'unknown' }
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      warn(`${kind} is busy in another application`, err)
      return { state: 'unknown' }
    }

    const after = await queryDoor(kind)
    if (after === 'denied') return { state: 'denied' }
    if (after === 'prompt') return { state: 'prompt' }
    return { state: 'unknown' }
  }
}
