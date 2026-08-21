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

const STATUS: Record<string, RoomStatus> = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  FAILED: 'failed',
  DISCONNECTED: 'disconnected',
  CLOSING: 'closed',
  CLOSED: 'closed',
}

export function MeetingBridge({ store, isTeacher }: { store: RoomStore; isTeacher: boolean }) {
  const meeting = useMeeting({
    onMeetingJoined() {
      store.setStatus('connected')
    },
    onMeetingLeft() {
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
      if (decision) store.setEntryDecision(decision)
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
      respondEntry: (id, allow) => {
        const closures = store.takeEntryClosures(id)
        if (closures) {
          if (allow) closures.allow()
          else closures.deny()
        } else {
          /* respondEntry(id, decision) exists on useMeeting, so a lost closure
             is not necessarily fatal - unlike what plan.md assumes. Its own
             typings disagree on the decision type (string here, boolean in
             meeting.d.ts), so this path is a fallback and not the default. */
          warn('no entry closure for participant, falling back to respondEntry', id)
          ref.current.respondEntry(id, allow as unknown as string)
        }
        store.removeEntryRequest(id)
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
      /* isTeacher is seeded here, from the session response, and only ever
         for the LOCAL participant. Nothing the SDK exposes lets a client
         derive somebody else's role, so remote rows stay false until a later
         step announces it - which will be broadcast state, not enforcement. */
      store.upsertParticipant(localId, { name: localName || 'You', isLocal: true, isTeacher })
    }
  }, [store, meetingId, localId, localName, isTeacher])

  return null
}
