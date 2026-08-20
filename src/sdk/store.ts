import type {
  EntryDecision,
  EntryRequest,
  ParticipantView,
  RoomMessage,
  RoomSnapshot,
  RoomStatus,
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
  participantIds: [],
  participants: {},
  activeSpeakerId: null,
  isRecording: false,
  whiteboard: { url: null, inFlight: false, error: null },
  entryQueue: [],
  lastEntryDecision: null,
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
  muteParticipant: (id: string) => void
  askToUnmute: (id: string) => void
  startWhiteboard: () => Promise<void>
  stopWhiteboard: () => Promise<void>
  respondEntry: (id: string, allow: boolean) => void
  publish: (topic: string, text: string, persist: boolean) => Promise<void>
}

export function createRoomStore() {
  let snapshot: RoomSnapshot = INITIAL
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
  const tracks = new Map<string, { mic?: MediaStream; cam?: MediaStream }>()
  const trackListeners = new Set<(id: string) => void>()

  let actions: RoomActions | null = null

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

    setWhiteboard(patch: Partial<RoomSnapshot['whiteboard']>) {
      const next = { ...snapshot.whiteboard, ...patch }
      if (shallowEqual(next, snapshot.whiteboard)) return
      snapshot = { ...snapshot, whiteboard: next }
      emit()
    },

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
        isTeacher: false,
        micOn: false,
        camOn: false,
        isActiveSpeaker: false,
      }
      const next: ParticipantView = { ...base, ...patch, id }
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
    addEntryRequest(row: EntryRequest, closures: { allow: () => void; deny: () => void }) {
      entryClosures.set(row.participantId, closures)
      if (snapshot.entryQueue.some((r) => r.participantId === row.participantId)) return
      commit({ entryQueue: [...snapshot.entryQueue, row] })
    },
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
    setTrack(id: string, kind: 'mic' | 'cam', stream: MediaStream | undefined) {
      const entry = tracks.get(id) ?? {}
      if (entry[kind] === stream) return
      tracks.set(id, { ...entry, [kind]: stream })
      for (const l of trackListeners) l(id)
    },
    getTrack: (id: string, kind: 'mic' | 'cam') => tracks.get(id)?.[kind],
    subscribeTracks(listener: (id: string) => void) {
      trackListeners.add(listener)
      return () => trackListeners.delete(listener)
    },

    setActions: (next: RoomActions) => { actions = next },
    getActions: () => actions,

    reset() {
      snapshot = INITIAL
      entryClosures.clear()
      tracks.clear()
      emit()
    },
  }
}

export type RoomStore = ReturnType<typeof createRoomStore>
