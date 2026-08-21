import type { RoomMessage } from './types'

/* Class-control and raise-hand state, both derived by folding a topic's
   message log. Neither is stored anywhere but VideoSDK's persisted pubsub.

   Both topics carry JSON in the message TEXT rather than in the `payload`
   argument. Text is the field every layer of the SDK is proven to deliver,
   including the replay a late joiner gets through onOldMessagesReceived;
   payload is in the typings and forwarded by the bundle, but nothing in this
   codebase has watched it survive persistence. */

export interface ClassControls {
  chatEnabled: boolean
  handsEnabled: boolean
  /** Students the teacher has put on the Lecture stage. */
  promoted: readonly string[]
}

export const DEFAULT_CONTROLS: ClassControls = {
  chatEnabled: true,
  handsEnabled: true,
  promoted: [],
}

/* A full state snapshot per message, never a delta.

   A late joiner replays history in whatever order it arrives and still lands
   on the same state as everyone else, and a dropped message cannot leave one
   client with chat off and hands on. The cost is a slightly larger message,
   which for a class-control toggle is nothing. */
export function encodeControls(next: ClassControls): string {
  return JSON.stringify({
    v: 1,
    chat: next.chatEnabled,
    hands: next.handsEnabled,
    promoted: next.promoted,
  })
}

function parseControls(text: string): ClassControls | null {
  try {
    const raw = JSON.parse(text) as Record<string, unknown>
    if (raw.v !== 1) return null
    return {
      chatEnabled: raw.chat !== false,
      handsEnabled: raw.hands !== false,
      promoted: Array.isArray(raw.promoted)
        ? raw.promoted.filter((id): id is string => typeof id === 'string')
        : [],
    }
  } catch {
    return null
  }
}

/* Last message from the teacher wins.

   The sender check is what makes this worth doing at all: a student cannot
   publish the class into a state the teacher did not choose. It is still not
   enforcement - the teacher's own client is all that stops a crafted publish
   from that account, and allow_mod remains the only server-side control - but
   it does close the door on every other participant in the room. */
export function foldControls(
  messages: readonly RoomMessage[],
  teacherId: string | null,
): ClassControls {
  if (!teacherId) return DEFAULT_CONTROLS
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.senderId !== teacherId) continue
    const parsed = parseControls(m.text)
    if (parsed) return parsed
  }
  return DEFAULT_CONTROLS
}

/** `id` defaults to the sender. Only the teacher may address anyone else. */
export function encodeHand(id: string, up: boolean): string {
  return JSON.stringify({ v: 1, id, up })
}

/* Folded forward per target id, then narrowed to who is actually here.

   Filtering against the live roster is what makes persisting this topic safe.
   A hand raised by a student who has since left would otherwise sit in the
   replay forever, and every late joiner would see it. */
export function foldHands(
  messages: readonly RoomMessage[],
  teacherId: string | null,
  presentIds: readonly string[],
): ReadonlySet<string> {
  const raised = new Set<string>()
  for (const m of messages) {
    let target = m.senderId
    let up = false
    try {
      const raw = JSON.parse(m.text) as Record<string, unknown>
      if (raw.v !== 1) continue
      up = raw.up === true
      if (typeof raw.id === 'string' && raw.id !== '') target = raw.id
    } catch {
      continue
    }
    /* Anyone may raise or lower their own hand. Only the teacher may lower
       somebody else's, which is what the roster's "lower hand" row does. */
    if (target !== m.senderId && m.senderId !== teacherId) continue
    if (up) raised.add(target)
    else raised.delete(target)
  }
  for (const id of raised) if (!presentIds.includes(id)) raised.delete(id)
  return raised
}
