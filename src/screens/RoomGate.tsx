import { useCallback, useEffect, useRef } from 'react'
import { LobbyWaiting } from '../components/LobbyWaiting'
import { LiveClassroom } from './LiveClassroom'
import {
  LEAVE_DUPLICATE_PARTICIPANT,
  LEAVE_MEETING_END_API,
  LEAVE_ROOM_CLOSE,
  useEntryDecision,
  useLeaveReason,
  useRoomActions,
  useRoomStatus,
} from '../sdk'
import type { ClassMode } from '../domain/classroom'

/* What you see between mounting the meeting and being in the class.

   This has to live INSIDE RoomProvider, because only a child of the provider
   can read the store. Everything it decides is handed back up to JoinRoute,
   which owns the screens that must render with no meeting behind them. */

export type ExitReason = 'declined' | 'left' | 'ended' | 'evicted' | 'ask-again'

export interface RoomGateProps {
  mode: ClassMode
  title: string
  name: string
  /** From the session response. See the comment on the denial effect - this
      is emphatically NOT the store's localId. */
  participantId: string
  isTeacher: boolean
  onExit: (reason: ExitReason) => void
}

export function RoomGate({
  mode,
  title,
  name,
  participantId,
  isTeacher,
  onExit,
}: RoomGateProps) {
  const status = useRoomStatus()
  const decision = useEntryDecision()
  const leaveReason = useLeaveReason()
  const actions = useRoomActions()

  /* Exits fire once. leave() settles asynchronously and both the decision and
     the leave reason can re-render this component afterwards, so without the
     latch a denial would call onExit twice and the second call would land on a
     screen that has already moved on. */
  const exited = useRef(false)

  /* onExit is an inline arrow from the parent, so it is a new function every
     render and cannot go in a dependency list without re-running the effects
     below on every commit. Kept in a ref updated in an effect rather than
     during render - a render-phase ref write is a side effect React is free
     to discard and replay. This effect is declared FIRST, and React runs a
     component's effects in order, so the ref is current by the time the two
     effects below read it in the same commit. */
  const onExitRef = useRef(onExit)
  useEffect(() => {
    onExitRef.current = onExit
  })

  const exit = useCallback(
    (reason: ExitReason) => {
      if (exited.current) return
      exited.current = true
      actions.leave()
      onExitRef.current(reason)
    },
    [actions],
  )

  /* THE MOST LOAD-BEARING LINE IN THE LOBBY.

     A denied guest is not disconnected by the SDK. Without this call they sit
     at CONNECTING forever and "the teacher declined" becomes pixel-identical
     to "this app is frozen". The app leaves on its own behalf.

     The id compared is the SESSION's participantId, never the store's localId.
     A knocking student has no local participant yet - localId is null for the
     entire wait - so a guard written against the store would never match and
     this whole screen would look like it silently does nothing. */
  useEffect(() => {
    if (!decision) return
    if (decision.participantId !== participantId) return
    if (decision.decision === 'denied') exit('declined')
    /* 'allowed' is deliberately not handled. Admission arrives as
       onMeetingJoined flipping the status to connected, and acting on the
       decision as well would race the SDK's own join. */
  }, [decision, participantId, exit])

  /* The only room-ended signal that exists is the code on the leave reason. */
  useEffect(() => {
    if (!leaveReason) return
    if (leaveReason.code === LEAVE_DUPLICATE_PARTICIPANT) exit('evicted')
    else if (
      leaveReason.code === LEAVE_ROOM_CLOSE ||
      leaveReason.code === LEAVE_MEETING_END_API
    ) {
      exit('ended')
    }
  }, [leaveReason, exit])

  if (status === 'connected') {
    return <LiveClassroom mode={mode} title={title} isTeacher={isTeacher} />
  }

  /* A student is not "joining" - they are knocking, and the difference is the
     whole reason this screen exists. A teacher holds allow_join and walks in,
     so for them the wait really is just a connection. */
  if (!isTeacher && (status === 'connecting' || status === 'reconnecting')) {
    return (
      <LobbyWaiting
        title={title}
        name={name}
        onAskAgain={() => exit('ask-again')}
        onLeave={() => exit('left')}
      />
    )
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-canvas">
      <span className="text-xl font-semibold text-ink">
        {status === 'failed' ? 'Could not join the class' : 'Joining the class'}
      </span>
      <span className="text-base text-ink-secondary">
        {status === 'failed'
          ? 'The connection did not come up. Try opening the link again.'
          : status === 'reconnecting'
            ? 'Reconnecting.'
            : 'Setting up your camera and microphone.'}
      </span>
    </div>
  )
}
