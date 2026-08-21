import { createContext, useCallback, useContext, useRef, useSyncExternalStore } from 'react'
import { CLASS_CONTROLS_TOPIC, HANDS_TOPIC } from './topics'
import { foldControls, foldHands, type ClassControls } from './controls'
import type { RoomStore } from './store'
import type { ParticipantView, RoomMessage, RoomSnapshot } from './types'

export const RoomStoreContext = createContext<RoomStore | null>(null)

export function useRoomStore(): RoomStore {
  const store = useContext(RoomStoreContext)
  if (!store) throw new Error('useRoomStore must be used inside <RoomProvider>')
  return store
}

/* The selector hook.

   useSyncExternalStore has no selector argument, and the naive wrapper
   `useSyncExternalStore(sub, () => select(getSnapshot()))` recreates the
   selected value on every call and loops forever. Two things prevent that:
   the store guarantees reference stability for anything already inside the
   snapshot, and this cache keys on the store's version counter so a derived
   value is computed at most once per commit and keeps its old reference when
   equal.

   Every call site below passes a MODULE-LEVEL selector constant, never an
   inline arrow. With stable identities the dependency list never fires, so
   `get` is built once; an inline arrow would rebuild it every render and
   defeat the cache. That discipline is enforced structurally rather than by
   convention: useSelector is not exported from index.ts, so no feature
   component can pass one. */
function useSelector<T>(select: (s: RoomSnapshot) => T, isEqual: (a: T, b: T) => boolean = Object.is): T {
  const store = useRoomStore()
  const cache = useRef<{ version: number; value: T } | null>(null)

  const get = useCallback(() => {
    const version = store.getVersion()
    if (cache.current && cache.current.version === version) return cache.current.value

    const next = select(store.getSnapshot())
    if (cache.current && isEqual(cache.current.value, next)) {
      /* Keep the OLD reference. Returning a new-but-equal object here is
         exactly the loop this cache exists to prevent. */
      cache.current = { version, value: cache.current.value }
      return cache.current.value
    }
    cache.current = { version, value: next }
    return next
  }, [store, select, isEqual])

  return useSyncExternalStore(store.subscribe, get, get)
}

function arrayEqual<T>(a: readonly T[], b: readonly T[]) {
  return a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
}

const EMPTY: readonly RoomMessage[] = []

// Module-level selectors, so nothing captures a fresh closure per render.
const selStatus = (s: RoomSnapshot) => s.status
const selLocalId = (s: RoomSnapshot) => s.localId
const selTeacherId = (s: RoomSnapshot) => s.teacherId
const selIds = (s: RoomSnapshot) => s.participantIds
const selRecording = (s: RoomSnapshot) => s.isRecording
const selWhiteboard = (s: RoomSnapshot) => s.whiteboard
const selEntryQueue = (s: RoomSnapshot) => s.entryQueue
const selEntryDecision = (s: RoomSnapshot) => s.lastEntryDecision
const selError = (s: RoomSnapshot) => s.lastError
const selLeaveReason = (s: RoomSnapshot) => s.leaveReason

export const useRoomStatus = () => useSelector(selStatus)
export const useLocalId = () => useSelector(selLocalId)
/** The teacher's participantId, as the server derived it. Null in a store
    built without one, which no real room does. */
export const useTeacherId = () => useSelector(selTeacherId)
export const useParticipantIds = () => useSelector(selIds, arrayEqual)
export const useIsRecording = () => useSelector(selRecording)
export const useWhiteboard = () => useSelector(selWhiteboard)
export const useEntryQueue = () => useSelector(selEntryQueue, arrayEqual)
export const useEntryDecision = () => useSelector(selEntryDecision)
export const useRoomError = () => useSelector(selError)
/** Why the meeting ended. The only room-ended signal the SDK has. */
export const useLeaveReason = () => useSelector(selLeaveReason)

/* The roster as an array.

   Derived, so it goes through the version cache: the array is rebuilt at most
   once per commit and keeps its previous reference when element-wise equal.
   The elements themselves have stable identity from the store's structural
   sharing, which is what makes arrayEqual meaningful here rather than a
   deep-compare in disguise. */
const selViews = (s: RoomSnapshot) =>
  s.participantIds.map((id) => s.participants[id]).filter(Boolean)
export const useParticipantViews = () => useSelector(selViews, arrayEqual)

/** One participant. The store gives these reference identity, so this is a
    plain read and needs no equality function. */
export function useParticipantView(id: string): ParticipantView | undefined {
  const store = useRoomStore()
  const get = useCallback(() => store.getSnapshot().participants[id], [store, id])
  return useSyncExternalStore(store.subscribe, get, get)
}

export function useTopic(topic: string): readonly RoomMessage[] {
  const store = useRoomStore()
  const get = useCallback(() => store.getSnapshot().topics[topic] ?? EMPTY, [store, topic])
  return useSyncExternalStore(store.subscribe, get, get)
}

/** The imperative surface. One object, stable for the life of the provider.

    Deliberately not the registered object itself: bridges register in effects,
    and React flushes a parent's effects after its children render, so reading
    the real one during the first commit finds nothing. The facade resolves
    each call at call time instead, which is always an event handler and always
    after effects have run. */
export function useRoomActions() {
  return useRoomStore().getActionFacade()
}

/** Live media for one participant, from the non-reactive registry. */
export function useTrack(id: string, kind: 'mic' | 'cam') {
  const store = useRoomStore()
  const subscribe = useCallback(
    (onChange: () => void) =>
      store.subscribeTracks((changed) => {
        if (changed === id) onChange()
      }),
    [store, id],
  )
  const get = useCallback(() => store.getTrack(id, kind), [store, id, kind])
  return useSyncExternalStore(subscribe, get, get)
}

/* Class controls and raised hands, folded from their topics.

   Both go through useSelector rather than a useMemo in the component, because
   that is what gives them a stable reference: the version cache computes each
   fold at most once per commit and keeps the previous object when the
   comparison says nothing changed. A fresh Set on every chat message would
   re-render every tile in the room. */

function sameControls(a: ClassControls, b: ClassControls) {
  return (
    a.chatEnabled === b.chatEnabled &&
    a.handsEnabled === b.handsEnabled &&
    a.promoted.length === b.promoted.length &&
    a.promoted.every((id, i) => id === b.promoted[i])
  )
}

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>) {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}

const selControls = (s: RoomSnapshot) =>
  foldControls(s.topics[CLASS_CONTROLS_TOPIC] ?? EMPTY, s.teacherId)

const selHands = (s: RoomSnapshot) =>
  foldHands(s.topics[HANDS_TOPIC] ?? EMPTY, s.teacherId, s.participantIds)

/** Chat, hand-raising and the promoted list, as the teacher last published
    them. Everything on is what an empty log means. */
export const useClassControls = () => useSelector(selControls, sameControls)

/** Who has a hand up, narrowed to participants still in the room. */
export const useRaisedHands = () => useSelector(selHands, sameSet)
