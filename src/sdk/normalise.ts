import { warn } from './log'
import type { EntryDecision, RoomMessage } from './types'

/* Where the SDK's rough edges get sanded, once, so no feature component ever
   sees them. */

/** `onEntryResponded` ships two different shapes.

    Verified in the shipped react-sdk 1.1.1 bundle:

      var _handle_entry_responded = useCallback(function (id, d) {
        eventEmitter.emit(events['entry-responded'], id, d);
      }, []);

    Two positional arguments. The shipped .d.ts declares a single
    `{ participantId, decision }` object. Both are handled, because the typings
    and the runtime disagree and only one of them ships to users.

    Anything unrecognised is logged and dropped rather than thrown. A lobby
    that stalls is bad; a lobby that crashes takes the whole class with it. */
export function normaliseEntryResponded(...args: unknown[]): EntryDecision | null {
  const [first, second] = args
  let id: unknown
  let decision: unknown

  if (typeof first === 'string') {
    id = first
    decision =
      typeof second === 'string'
        ? second
        : (second as { decision?: unknown } | undefined)?.decision
  } else if (first && typeof first === 'object') {
    const obj = first as { participantId?: unknown; id?: unknown; decision?: unknown }
    id = obj.participantId ?? obj.id
    decision = obj.decision
  }

  if (typeof id !== 'string' || id === '') {
    warn('onEntryResponded: no participant id in payload, dropping', args)
    return null
  }

  /* Substring rather than equality. The wire value passes straight through
     the emitter from the server, so a casing or tense difference would strand
     a student on the waiting screen forever - which is the exact failure this
     normaliser exists to prevent. */
  const d = String(decision ?? '').toLowerCase()
  if (d.includes('allow')) return { participantId: id, decision: 'allowed' }
  if (d.includes('den') || d.includes('reject')) return { participantId: id, decision: 'denied' }

  warn('onEntryResponded: unrecognised decision, dropping', args)
  return null
}

/* Pubsub message keys.

   plan.md says these messages have no id field. That is wrong, and the truth
   is more dangerous: js-sdk 1.1.1 builds `id: serverMessage.messageId || ""`.
   So the field exists and can be the EMPTY STRING - falsy, and equal to every
   other empty string, which means `key={m.id}` collides silently instead of
   failing loudly. React then reuses the wrong DOM node and messages appear to
   change author.

   `persistMsgId` and `seqNum` are also present and absent from the .d.ts.
   `seqNum` is the server's monotonic sequence; the SDK itself uses gaps in it
   to compute dropped counts, which makes it a real ordering key in a way
   `timestamp` is not - that clock's domain is unestablished, so it is never
   read here. */
let ingestCounter = 0

export function normalisePubSubMessage(raw: unknown, topic: string): RoomMessage {
  const m = (raw ?? {}) as Record<string, unknown>

  const wireId = typeof m.id === 'string' && m.id !== '' ? m.id : null
  const persistId =
    typeof m.persistMsgId === 'string' && m.persistMsgId !== '' ? m.persistMsgId : null
  const seqRaw = Number(m.seqNum)
  const seq = Number.isFinite(seqRaw) ? seqRaw : null
  const senderId = typeof m.senderId === 'string' ? m.senderId : ''

  return {
    key:
      wireId ??
      persistId ??
      `${senderId || 'anon'}#${seq ?? `n${++ingestCounter}`}`,
    /* Supplied by us. The .d.ts declares `topic` on the message, but the SDK
       puts it on the batch, so reading m.topic yields undefined. */
    topic,
    text: typeof m.message === 'string' ? m.message : String(m.message ?? ''),
    senderId,
    senderName: typeof m.senderName === 'string' ? m.senderName : 'Someone',
    payload: (m.payload ?? {}) as Record<string, unknown>,
    seq,
    receivedAt: performance.now(),
  }
}
