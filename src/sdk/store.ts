import { warn } from './log'
import type {
  EntryDecision,
  EntryRequest,
  LeaveReason,
  MediaRequest,
  ParticipantView,
  RoomMessage,
  RoomSnapshot,
  RoomStatus,
  TrackKind,
} from './types'

/* The room store.

   Every SDK hook opens a subscription per call site, so each is subscribed
   exactly once in a bridge that renders nothing and pushes in here. Feature
   components read through useSyncExternalStore.

   The rule that keeps this from looping: getSnapshot NEVER CONSTRUCTS. React
   calls it on every render and compares by reference, so building a fresh
   object each call means an infinite re-render. It returns a cached object
   that is replaced only when a value genuinely changed. */

const INITIAL: RoomSnapshot = {
  status: 'idle',
  meetingId: null,
  localId: null,
  teacherId: null,
  participantIds: [],
  participants: {},
  activeSpeakerId: null,
  presenterId: null,
  isRecording: false,
  whiteboard: { url: null, inFlight: false, error: null },
  entryQueue: [],
  lastEntryDecision: null,
  mediaRequest: null,
  leaveReason: null,
  topics: {},
  lastError: null,
}

function shallowEqual<T extends object>(a: T, b: T) {
  const ak = Object.keys(a) as Array<keyof T>
  if (ak.length !== Object.keys(b).length) return false
  for (const k of ak) if (!Object.is(a[k], b[k])) return false
  return true
}

/** The imperative surface, registered once by MeetingBridge. */
export interface RoomActions {
  join: () => void
  leave: () => void
  end: () => void
  toggleMic: () => void
  toggleWebcam: () => void
  /* Screen share, start and stop through one call.

     Async because the browser's own picker is in the middle of it: the
     promise settles when the user has chosen a surface or dismissed the
     dialog, and a dismissal REJECTS. Nothing that calls this may leave the
     rejection unhandled - a teacher pressing Escape on the picker is the
     ordinary case, not an error worth surfacing. */
  toggleScreenShare: () => Promise<void>
  muteParticipant: (id: string) => void
  /** Every remote mic off, in one pass. The SDK has no mute-all.
      Returns how many mics it actually turned off, so the teacher gets told
      what happened rather than having to count the roster. */
  muteEveryoneElse: () => number
  askToUnmute: (id: string) => void
  /* Cloud recording. Fire-and-forget on purpose: the truth about whether it
     is running arrives on onRecordingStateChanged, not from the return of
     these calls, so nothing here awaits a promise whose value would be stale
     by the time a caller read it. */
  startRecording: () => void
  stopRecording: () => void
  startWhiteboard: () => Promise<void>
  stopWhiteboard: () => Promise<void>
  respondEntry: (id: string, allow: boolean) => Promise<void>
}

/* One topic's publisher, registered by the PubSubBridge that owns the topic.

   `persist` is a property of the topic, not of the call, so it lives with the
   bridge and callers never pass it. Getting that wrong once - one publish with
   persist false on CLASS_CONTROLS - silently breaks late joiners only. */
export type PublishFn = (text: string, payload?: Record<string, unknown>) => Promise<void>

/** What feature code holds: the actions, plus publish routed by topic. */
export interface RoomFacade extends RoomActions {
  publish: (topic: string, text: string, payload?: Record<string, unknown>) => Promise<void>
  /** Answer a pending mic or camera request. No SDK call of our own: the
      answer is a closure the event handed us. */
  respondMediaRequest: (accept: boolean) => void
}

/* teacherId comes from api/session.ts, which derives it from room ownership.
   Passed in at construction rather than set later: the store is created in the
   same memo as the provider that mounts the meeting, so it is known before any
   participant row can exist, and a row can never be built with the wrong role
   and corrected a frame later. */
export function createRoomStore(teacherId: string | null = null) {
  let snapshot: RoomSnapshot = { ...INITIAL, teacherId }
  let version = 0
  const listeners = new Set<() => void>()

  /* Deliberately outside the snapshot.

     allow/deny arrive as closures on the entry event and are neither
     comparable nor serialisable. Putting them in the snapshot would make it a
     new object on every knock and churn every subscriber. The queue holds
     display rows; the closures live here and are reached by id. */
  const entryClosures = new Map<string, { allow: () => void; deny: () => void }>()

  /* Also outside the snapshot: live MediaStreams. A track mutation would
     otherwise bump the version for the whole tree. Audio and video elements
     subscribe to this registry directly. */
  const tracks = new Map<string, Partial<Record<TrackKind, MediaStream>>>()
  const trackListeners = new Set<(id: string) => void>()

  let actions: RoomActions | null = null

  /* Outside the snapshot, and deliberately a registry rather than a field on
     RoomActions. Every bridge used to register publish by spreading over
     whatever the previous one had left, guarded by `if (topic !== mine)
     return` - so the last bridge to mount won and every other topic published
     into nothing. Routing by topic here removes the mount-order dependency
     entirely. */
  const publishers = new Map<string, PublishFn>()

  /* Same reason as the entry closures: accept/reject are functions, so they
     are neither comparable nor serialisable and must not enter the snapshot. */
  let mediaClosures: { accept: () => void; reject: () => void } | null = null

  /* A stable facade, built once and handed to every consumer.

     The bridges register their real implementations in effects, and React
     flushes a parent's effects AFTER its children have rendered - so a child
     calling useRoomActions during the first commit would find nothing there.
     Returning the live object would also change identity every time a bridge
     re-registered, defeating every memo downstream.

     So consumers get this, forever. Each method resolves the current
     implementation at call time, which is always an event handler and always
     after the effects have run. */
  const notReady = (name: string) => () => {
    warn(`room action "${name}" called before the bridges registered; ignoring`)
  }

  const facade: RoomFacade = {
    join: () => (actions ? actions.join() : notReady('join')()),
    leave: () => (actions ? actions.leave() : notReady('leave')()),
    end: () => (actions ? actions.end() : notReady('end')()),
    toggleMic: () => (actions ? actions.toggleMic() : notReady('toggleMic')()),
    toggleWebcam: () => (actions ? actions.toggleWebcam() : notReady('toggleWebcam')()),
    muteParticipant: (id) =>
      actions ? actions.muteParticipant(id) : notReady('muteParticipant')(),
    /* The only action with a return value, so it cannot fall through to
       notReady's void the way its neighbours do. Before the bridges register
       there is nothing muted, and 0 says exactly that - undefined leaking out
       of here would reach the UI as "muted undefined people". */
    muteEveryoneElse: () => {
      if (actions) return actions.muteEveryoneElse()
      notReady('muteEveryoneElse')()
    toggleScreenShare: async () => {
      if (actions) await actions.toggleScreenShare()
      else notReady('toggleScreenShare')()
    },
      return 0
    },
    askToUnmute: (id) => (actions ? actions.askToUnmute(id) : notReady('askToUnmute')()),
    startRecording: () => (actions ? actions.startRecording() : notReady('startRecording')()),
    stopRecording: () => (actions ? actions.stopRecording() : notReady('stopRecording')()),
    startWhiteboard: async () => {
      if (actions) await actions.startWhiteboard()
      else notReady('startWhiteboard')()
    },
    stopWhiteboard: async () => {
      if (actions) await actions.stopWhiteboard()
      else notReady('stopWhiteboard')()
    },
    respondEntry: async (id, allow) => {
      if (actions) await actions.respondEntry(id, allow)
      else notReady('respondEntry')()
    },
    publish: async (topic, text, payload) => {
      const publisher = publishers.get(topic)
      if (!publisher) {
        warn(`no publisher registered for topic "${topic}"; message dropped`)
        return
      }
      await publisher(text, payload)
    },
    respondMediaRequest: (accept) => {
      const closures = mediaClosures
      mediaClosures = null
      commit({ mediaRequest: null })
      if (!closures) return
      if (accept) closures.accept()
      else closures.reject()
    },
  }

  function emit() {
    version++
    for (const l of listeners) l()
  }

  function commit(patch: Partial<RoomSnapshot>) {
    const merged = { ...snapshot, ...patch }
    /* A no-op write must not notify. The SDK re-fires several of these
       callbacks with identical values. */
    if (shallowEqual(merged, snapshot)) return
    snapshot = merged
    emit()
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot: () => snapshot,
    getVersion: () => version,

    setStatus: (status: RoomStatus) => commit({ status }),
    setMeeting: (meetingId: string | null, localId: string | null) =>
      commit({ meetingId, localId }),
    setActiveSpeaker: (activeSpeakerId: string | null) => commit({ activeSpeakerId }),
    setRecording: (isRecording: boolean) => commit({ isRecording }),
    setError: (lastError: { code: number; message: string } | null) => commit({ lastError }),
    setLeaveReason: (leaveReason: LeaveReason | null) => commit({ leaveReason }),

    setWhiteboard(patch: Partial<RoomSnapshot['whiteboard']>) {
      const next = { ...snapshot.whiteboard, ...patch }
      if (shallowEqual(next, snapshot.whiteboard)) return
      snapshot = { ...snapshot, whiteboard: next }
      emit()
    },

    setPresenter: (presenterId: string | null) => commit({ presenterId }),
    /* Structural sharing. If nothing about this participant changed, the
       existing object is kept, so `participants` holds reference identity for
       untouched rows and a mic toggle on one person does not re-render the
       other thirty-nine. */
    upsertParticipant(id: string, patch: Partial<ParticipantView>) {
      const prev = snapshot.participants[id]
      const base: ParticipantView = prev ?? {
        id,
        name: 'Someone',
        isLocal: false,
        isTeacher: id === teacherId,
        micOn: false,
        camOn: false,
        isActiveSpeaker: false,
      }
      /* Role is derived here and nowhere else. No caller may pass it in: the
         only truthful source is the server's ownership lookup, and letting a
         patch set it is how the local row ends up right while every remote row
         quietly stays a student. */
      const next: ParticipantView = { ...base, ...patch, id, isTeacher: id === teacherId }
      if (prev && shallowEqual(next, prev)) return

      const participants = { ...snapshot.participants, [id]: next }
      /* participantIds is rebuilt only on join and leave, never on a patch,
         so its identity is stable across media changes. */
      const participantIds = prev
        ? snapshot.participantIds
        : [...snapshot.participantIds, id]
      snapshot = { ...snapshot, participants, participantIds }
      emit()
    },

    removeParticipant(id: string) {
      if (!snapshot.participants[id]) return
      const participants = { ...snapshot.participants }
      delete participants[id]
      snapshot = {
        ...snapshot,
        participants,
        participantIds: snapshot.participantIds.filter((p) => p !== id),
      }
      tracks.delete(id)
      emit()
    },

    // ---- lobby ----------------------------------------------------------
    addEntryRequest(row: EntryRequest, closures?: { allow: () => void; deny: () => void }) {
      /* Optional, because a failed respondEntry restores the display row after
         its closures have already been consumed. A row with no closure is not
         useless - respondEntry(id, decision) still addresses it by id. */
      if (closures) entryClosures.set(row.participantId, closures)
      if (snapshot.entryQueue.some((r) => r.participantId === row.participantId)) return
      commit({ entryQueue: [...snapshot.entryQueue, row] })
    },
    getEntryRequest: (id: string) =>
      snapshot.entryQueue.find((r) => r.participantId === id),
    takeEntryClosures(id: string) {
      const c = entryClosures.get(id)
      entryClosures.delete(id)
      return c
    },
    removeEntryRequest(id: string) {
      entryClosures.delete(id)
      commit({ entryQueue: snapshot.entryQueue.filter((r) => r.participantId !== id) })
    },
    setEntryDecision: (lastEntryDecision: EntryDecision | null) => commit({ lastEntryDecision }),

    // ---- mic / camera requests -----------------------------------------
    /* A second request replaces the first, and the first is rejected rather
       than dropped: leaving it unanswered would hold the asker waiting on a
       dialog the student can no longer see. */
    setMediaRequest(row: MediaRequest, closures: { accept: () => void; reject: () => void }) {
      if (mediaClosures) mediaClosures.reject()
      mediaClosures = closures
      commit({ mediaRequest: row })
    },

    // ---- pubsub ---------------------------------------------------------
    appendMessages(topic: string, incoming: readonly RoomMessage[]) {
      if (incoming.length === 0) return
      const existing = snapshot.topics[topic] ?? []
      /* Arrival order, appended. Never sorted: `timestamp`'s clock domain is
         unestablished, and sorting a live feed by an untrusted clock reorders
         a conversation in front of the class. */
      commit({ topics: { ...snapshot.topics, [topic]: [...existing, ...incoming] } })
    },

    // ---- non-reactive registries ---------------------------------------
    setTrack(id: string, kind: TrackKind, stream: MediaStream | undefined) {
      const entry = tracks.get(id) ?? {}
      if (entry[kind] === stream) return
      tracks.set(id, { ...entry, [kind]: stream })
      for (const l of trackListeners) l(id)
    },
    getTrack: (id: string, kind: TrackKind) => tracks.get(id)?.[kind],
    subscribeTracks(listener: (id: string) => void) {
      trackListeners.add(listener)
      return () => trackListeners.delete(listener)
    },

    /** Called by the PubSubBridge for its own topic; returns the unregister. */
    registerPublisher(topic: string, fn: PublishFn) {
      publishers.set(topic, fn)
      return () => {
        if (publishers.get(topic) === fn) publishers.delete(topic)
      }
    },

    setActions: (next: RoomActions) => { actions = next },
    /* The raw registration, for bridges that extend it. */
    getActions: () => actions,
    /* What feature code gets: one object, stable for the life of the store. */
    getActionFacade: () => facade,

    reset() {
      snapshot = { ...INITIAL, teacherId }
      entryClosures.clear()
      mediaClosures = null
      tracks.clear()
      emit()
    },
  }
}

export type RoomStore = ReturnType<typeof createRoomStore>
