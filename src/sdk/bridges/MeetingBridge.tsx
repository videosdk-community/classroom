import { useEffect, useRef } from 'react'
import { useMeeting } from '@videosdk.live/react-sdk'
import { isDuplicateError, isWhiteboardError, whiteboardErrorSentence } from '../errors'
import { warn } from '../log'
import { normaliseEntryResponded } from '../normalise'
import type { RoomStore } from '../store'
import type { RoomStatus } from '../types'

/* useMeeting, subscribed exactly once.

   The reason is not CPU. `useMeeting` registers roughly forty listeners per
   call site against an eventEmitter created once at module scope and shared by
   every provider on the page. A dozen call sites is ~480 listeners and a
   MaxListenersExceededWarning per event name. Anyone who benchmarks this and
   finds "nothing" is measuring the wrong thing; do not remove the bridge. */

/* The five states js-sdk actually emits, from
   constants/meetingConnectionState.js.

   This map used to carry CLOSING and CLOSED, which come from the react-sdk
   typings and are emitted by nothing, and to omit RECONNECTING, which IS
   emitted - react-sdk special-cases it in its own reducer. The result was a
   reconnect logging "unrecognised meeting state" and leaving the last status
   on screen. On the lobby's waiting screen that reads as a freeze. */
const STATUS: Record<string, RoomStatus> = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  FAILED: 'failed',
  DISCONNECTED: 'disconnected',
}

export function MeetingBridge({ store }: { store: RoomStore }) {
  const meeting = useMeeting({
    onMeetingJoined() {
      store.setStatus('connected')
    },
    /* The leave REASON is the payload, and it is the only room-ended signal
       the SDK has - there is no host-left and no room-ended event anywhere.
       js-sdk's leaveReason table gives 1006 the teacher closing the room, 1009
       the end API, 1011 the same account joining from another tab, and 1101
       our own leave() call. Discarding it would leave the app unable to tell
       "the class ended" from "you were evicted" from "you were declined". */
    onMeetingLeft(reason?: { code?: number; message?: string }) {
      store.setLeaveReason({
        code: Number(reason?.code ?? 0),
        message: reason?.message ?? 'You left the class.',
      })
      store.setStatus('disconnected')
    },
    onMeetingStateChanged({ state }) {
      const mapped = STATUS[state]
      if (mapped) store.setStatus(mapped)
      else warn('unrecognised meeting state', state)
    },
    onParticipantJoined(participant) {
      store.upsertParticipant(participant.id, {
        name: participant.displayName,
        isLocal: Boolean(participant.local),
      })
    },
    onParticipantLeft(participant) {
      /* Removed synchronously in the callback so the per-participant bridge
         unmounts in the same commit. Deferring it leaves useParticipant
         running against an id the SDK has already dropped. */
      store.removeParticipant(participant.id)
    },
    onSpeakerChanged(activeSpeakerId) {
      store.setActiveSpeaker(activeSpeakerId)
    },
    onRecordingStateChanged({ status }) {
      store.setRecording(status === 'RECORDING_STARTED' || status === 'RECORDING_STARTING')
    },
    onEntryRequested({ participantId, name, allow, deny }) {
      /* The closures go to the non-reactive map, the row to the snapshot. */
      store.addEntryRequest({ participantId, name }, { allow, deny })
    },
    /* The .d.ts declares one object; the 1.1.1 bundle emits two positional
       args. The cast is the one place in this codebase where the typings are
       knowingly overruled, and normaliseEntryResponded handles both. */
    onEntryResponded: ((...args: unknown[]) => {
      const decision = normaliseEntryResponded(...args)
      if (!decision) return
      store.setEntryDecision(decision)
      /* This event reaches EVERY allow_join holder, not just whoever clicked -
         so a second teacher's decision clears the row here too, and a queue
         cannot show a student who has already been answered. */
      store.removeEntryRequest(decision.participantId)
    }) as never,
    onError({ code, message }) {
      const numeric = Number(code)
      if (isDuplicateError(numeric, performance.now())) return
      if (isWhiteboardError(numeric)) {
        store.setWhiteboard({
          error: whiteboardErrorSentence(numeric),
          /* A server-side 4056 means our own optimistic flag was right and
             the operation is still running, so it is not cleared here. */
          inFlight: numeric === 4056 ? true : false,
        })
        return
      }
      store.setError({ code: numeric, message })
    },
  })

  /* The imperative surface, registered once. Kept in a ref so the identity of
     the registered actions never changes even as `meeting` is rebuilt.

     The ref is updated in an effect rather than during render. Writing a ref
     while rendering is a side effect in the render phase, which React can
     discard and replay. Every action below is called from an event handler,
     which always runs after effects have flushed, so the effect is never
     behind by the time it is read. */
  const ref = useRef(meeting)
  useEffect(() => {
    ref.current = meeting
  })

  useEffect(() => {
    store.setActions({
      join: () => ref.current.join(),
      leave: () => ref.current.leave(),
      end: () => ref.current.end(),
      toggleMic: () => ref.current.toggleMic(),
      toggleWebcam: () => ref.current.toggleWebcam(),
      /* Moderation is PER-PARTICIPANT, not a meeting-level call. plan.md
         reads as though disableMic/enableMic sit on useMeeting; they do not
         (participant.d.ts:70-82). They hang off the Participant object, so
         they are reached through the meeting's participants map. */
      muteParticipant: (id) => {
        void ref.current.participants.get(id)?.disableMic()
      },
      /* Named for what it does. enableMic only REQUESTS - it fires
         onMicRequested on the target and they choose. A teacher can mute but
         cannot force-unmute, and pretending otherwise in the API would put
         the lie into every call site. */
      askToUnmute: (id) => {
        void ref.current.participants.get(id)?.enableMic()
      },
      startWhiteboard: async () => {},
      stopWhiteboard: async () => {},
      /* Optimistic, and it puts the row back if the decision fails.

         The row used to be removed unconditionally, so a rejected admit made
         the student vanish from the teacher's screen while still knocking. */
      respondEntry: async (id, allow) => {
        const row = store.getEntryRequest(id)
        const closures = store.takeEntryClosures(id)
        store.removeEntryRequest(id)
        try {
          if (closures) {
            await (allow ? closures.allow() : closures.deny())
          } else {
            /* respondEntry(id, decision) addresses a decision by participant
               id, so a lost closure is not necessarily fatal.

               The decision is a STRING, and four declarations disagree about
               it: react-sdk index.d.ts says `string`, react-sdk meeting.d.ts
               says `boolean`, the generated typedoc demonstrates
               "allow"/"deny". js-sdk's meeting.d.ts says "allowed" | "denied",
               and it wins - RoomClient.respondEntry forwards the value to the
               socket unmodified, and the SDK's own allow()/deny() closures are
               built as respondEntry(id, "allowed") / (id, "denied"). Sending a
               boolean here, as this line used to, put `true` on the wire. */
            warn('no entry closure for participant, falling back to respondEntry', id)
            await ref.current.respondEntry(id, allow ? 'allowed' : 'denied')
          }
        } catch (err) {
          warn('respondEntry failed, restoring the queue row', id, err)
          if (row) store.addEntryRequest(row)
          store.setError({ code: 0, message: 'That decision did not go through. Try again.' })
        }
      },
      publish: async () => {},
    })
  }, [store])

  /* Local participant is declared non-optional by the .d.ts but is undefined
     before join, so it is read defensively rather than eagerly. */
  const localId = meeting.localParticipant?.id ?? null
  const localName = meeting.localParticipant?.displayName ?? ''
  const meetingId = meeting.meetingId ?? null

  useEffect(() => {
    store.setMeeting(meetingId, localId)
    /* onParticipantJoined fires for OTHER people only - you are already in the
       room by the time you can listen for it. Without this the local
       participant never enters the store, so the roster is short by one, the
       rail is empty in a class of one, and the control bar reads its own mic
       state as false because there is no self to read. */
    if (localId) {
      /* No isTeacher here. The store derives it for every row, local and
         remote alike, from the teacher's participantId the session handed
         back - so a student's roster labels the teacher correctly instead of
         showing the whole room as students. */
      store.upsertParticipant(localId, { name: localName || 'You', isLocal: true })
    }
  }, [store, meetingId, localId, localName])

  return null
}
