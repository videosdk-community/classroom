import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BoardStage } from '../components/BoardStage'
import { HandsChip } from '../components/HandsChip'
import { KnockCard } from '../components/KnockCard'
import { LeavePrompt } from '../components/LeavePrompt'
import { MediaRequestPrompt } from '../components/MediaRequestPrompt'
import { ControlBar, type PanelKind } from '../components/ControlBar'
import { ScreenStage } from '../components/ScreenStage'
import { SidePanel } from '../components/SidePanel'
import { TopBar } from '../components/TopBar'
import { VideoRail } from '../components/VideoRail'
import type { ClassMode, Person } from '../domain/classroom'
import { PANEL_OVERLAY_BREAKPOINT } from '../lib/boardGeometry'
import { endRoom } from '../lib/rooms'
import { useElapsedSeconds } from '../lib/useElapsedSeconds'
import { useExitGuard } from '../lib/useExitGuard'
import { useMediaQuery } from '../lib/useMediaQuery'
import { useToast } from '../design/ui'
import {
  CHAT_TOPIC,
  CLASS_CONTROLS_TOPIC,
  HANDS_TOPIC,
  encodeControls,
  encodeHand,
  useClassControls,
  useRaisedHands,
  useIsRecording,
  useLocalId,
  useMediaRequest,
  useTeacherId,
  useParticipantIds,
  useParticipantView,
  useParticipantViews,
  usePresenterId,
  useEntryQueue,
  useRoomActions,
  useTopic,
  useWhiteboard,
  type ClassControls,
  type EntryRequest,
  type ParticipantView,
} from '../sdk'

/* The classroom, wired to a real meeting.

   Same components as the fixture screen. The only new thing is the adapter
   below, and the point of the seam is that this file never mentions the SDK -
   it reads app-shaped types from src/sdk and nothing else. */

/* A stable empty array, so a student's SidePanel does not get a new [] every
   render and re-render the roster for nothing. */
const EMPTY_QUEUE: readonly EntryRequest[] = []

/* A browser capability, read once at module scope rather than per render.

   getDisplayMedia is absent on mobile and tablet browsers entirely, which is
   the SDK's own documented limit and not something an app can work around.
   Read defensively because it is also absent on an insecure origin, where
   mediaDevices itself is undefined. */
const SCREEN_SHARE_SUPPORTED =
  typeof navigator !== 'undefined' &&
  typeof navigator.mediaDevices?.getDisplayMedia === 'function'

/* m:ss under an hour, h:mm:ss over it. Seconds are padded and minutes are not,
   so a class that has been running four minutes reads "4:12" rather than
   "04:12" - the leading zero buys nothing and makes a short number look like a
   timestamp. */
function formatClock(total: number) {
  const s = total % 60
  const m = Math.floor(total / 60) % 60
  const h = Math.floor(total / 3600)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

function toPerson(p: ParticipantView, raised: ReadonlySet<string>, onstage: boolean): Person {
  return {
    id: p.id,
    name: p.name,
    role: p.isTeacher ? 'teacher' : 'student',
    micOn: p.micOn,
    camOn: p.camOn,
    handRaised: raised.has(p.id),
    speaking: p.isActiveSpeaker,
    onstage,
  }
}

export function LiveClassroom({
  mode,
  title,
  roomId,
  isTeacher,
}: {
  mode: ClassMode
  title: string
  /* The row to mark ended when the teacher ends the class. From the session
     response, not from the URL - the same value, but one of them is the one
     the server already vouched for. */
  roomId: string
  /* Server-derived, from room ownership, and passed down rather than read off
     the local participant row. The store's row does carry it, but only once a
     local participant exists - which is never true for anyone still knocking,
     and would make this false for a beat after admission. */
  isTeacher: boolean
}) {
  const ids = useParticipantIds()
  const views = useParticipantViews()
  const localId = useLocalId()
  /* Server-derived, straight off the session response. Read here rather than
     found in the roster, so it is right before the teacher's own participant
     event has landed. */
  const teacherId = useTeacherId()
  const recording = useIsRecording()
  /* Who is presenting, for everyone. Null until somebody shares, and null
     again the moment they stop - including from the browser's own sharing
     bar, which is the only place a share can be stopped from outside this
     app. */
  const presenterId = usePresenterId()
  const whiteboard = useWhiteboard()
  const actions = useRoomActions()
  const navigate = useNavigate()
  const messages = useTopic(CHAT_TOPIC)

  /* The room opens on the board, not on the chat. The board is the product
     and the first thing a class should see; the panel is one click away and
     the control bar carries the toggle. */
  const [panel, setPanel] = useState<PanelKind>(null)
  const [moreOpen, setMoreOpen] = useState(false)

  /* Asked only when a Back gesture is caught, never by the Leave button - that
     one is deliberate enough already. */
  const [confirmLeave, setConfirmLeave] = useState(false)
  useExitGuard(true, useCallback(() => setConfirmLeave(true), []))

  /* The class IS the teacher, so their exit ends it for everyone. end() is the
     only way to close the room - leave() would drop the teacher and leave
     students in an empty class with a board nobody owns. Students learn about
     it from the leave reason.

     end() closes the room at VideoSDK and nothing else. The row on our side is
     what Home reads and what api/session.ts refuses a join against, so it is
     written here too - otherwise an ended class keeps offering Open and a link
     that dead-ends at the SDK instead of at a sentence.

     The write is NOT awaited, and Home is told which class just ended instead.
     Waiting was tried first and measured: the round trip outlived a 1500ms
     grace period while the meeting was tearing down, so the teacher still
     landed on their own ended class showing Open and a copyable link. Any
     timeout long enough to win that race is long enough to hold someone inside
     a room that has already closed.

     So the navigation carries `endedRoomId`. Home renders that row ended from
     the moment it paints, because the teacher who just pressed this button is
     first-hand evidence, and the fetch that follows catches up on its own.

     Replace rather than push, so Back does not return to a room this
     participant has already left. */
  const exit = useCallback(() => {
    if (!isTeacher) {
      actions.leave()
      navigate('/', { replace: true })
      return
    }
    actions.end()
    void endRoom(roomId).catch((err: unknown) =>
      console.warn('[classroom] could not mark the class ended', err),
    )
    navigate('/', { replace: true, state: { endedRoomId: roomId } })
  }, [isTeacher, roomId, actions, navigate])

  /* Class state is not local state. Both toggles used to be useState here,
     which meant a teacher turning chat off changed nothing on any other
     screen. They are folded from a persisted pubsub topic now, so a student
     already in the room, one who joins later, and one who reloads all read
     the same value. */
  const controls = useClassControls()
  const raisedHands = useRaisedHands()
  const handRaised = localId ? raisedHands.has(localId) : false

  /* A full snapshot per publish, and no optimistic local update: the teacher
     sees the toggle move when their own message comes back, which is the same
     moment everyone else sees it. */
  /* In Class everyone is onstage by definition, so promote only means
     anything in Lecture. */
  const isOnstage = (p: ParticipantView) =>
    mode === 'class' || p.isTeacher || controls.promoted.includes(p.id)

  const setControls = (patch: Partial<ClassControls>) => {
    void actions.publish(CLASS_CONTROLS_TOPIC, encodeControls({ ...controls, ...patch }))
  }

  const overlayPanel = useMediaQuery(`(max-width: ${PANEL_OVERLAY_BREAKPOINT - 1}px)`)
  const [wasOverlay, setWasOverlay] = useState(overlayPanel)
  if (wasOverlay !== overlayPanel) {
    setWasOverlay(overlayPanel)
    if (overlayPanel) setPanel(null)
  }

  const self = useParticipantView(localId ?? '')

  const toast = useToast()

  /* Counts from when this participant mounted, not from when the class
     started. The SDK exposes no session start time, and a per-viewer clock
     that is honest beats a shared one that is invented. */
  const elapsed = formatClock(useElapsedSeconds())

  /* Whether the board has ever been open for this participant. Tracked in a
     ref rather than derived, because "the teacher stopped the board" and "the
     board has not started yet" look identical from a null url, and only the
     history tells them apart. */
  const boardOpenedOnce = useRef(false)
  useEffect(() => {
    if (whiteboard.url) boardOpenedOnce.current = true
  }, [whiteboard.url])

  /* The teacher's board opens itself.

     A class that opens on an empty board region reads as a product that has
     not loaded, and the board is the whole point of this one.

     It retries, and the retry is the entire reason this is not a single call.
     A startWhiteboard issued in the same beat as onMeetingJoined is accepted
     and then silently dropped - no throw, no onError, no 4056, just a board
     that never opens. Driven in the browser rather than reasoned about: the
     one-shot version left the teacher looking at "The board is not open yet"
     while the same call from the control bar a second later worked every time.

     Each attempt awaits the last, so the in-flight flag is never contended and
     the server never sees the double-start that 4056 exists to reject.

     It stops the moment the board opens, and it never fires again afterwards -
     a teacher who deliberately stops the board must not have it reopened
     underneath them, which would read as a broken control rather than as a
     default. */
  useEffect(() => {
    if (!isTeacher || boardOpenedOnce.current || whiteboard.url) return
    let cancelled = false
    void (async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        if (cancelled || boardOpenedOnce.current) return
        await actions.startWhiteboard()
        if (cancelled || boardOpenedOnce.current) return
        await new Promise((resolve) => setTimeout(resolve, 1500))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isTeacher, whiteboard.url, actions])

  /* Announced on the transition rather than on the click, so the teacher is
     told what the SDK actually did and every other participant's badge and
     this message agree. */
  const wasRecording = useRef(recording)
  useEffect(() => {
    if (wasRecording.current === recording) return
    wasRecording.current = recording
    toast(recording ? 'Recording started' : 'Recording stopped', recording ? 'danger' : 'neutral')
  }, [recording, toast])


  /* The knock queue. Only a token holding allow_mod ever receives these, so a
     student's queue is permanently empty and the surfaces below simply never
     appear for them. */
  const waiting = useEntryQueue()

  /* Only ever set on the person being asked, so a teacher never sees their
     own request come back. */
  const mediaRequest = useMediaRequest()

  /* One stack, top-right, and it belongs to whichever surface is on centre
     stage. Knocks first: somebody waiting to be let in has nothing else on
     screen, while a raised hand is also in the rail and in the roster. */
  const teacherOverlay = (
    <div className="flex flex-col items-end gap-2">
      <KnockCard
        waiting={waiting}
        onRespond={(id, allow) => void actions.respondEntry(id, allow)}
        onSeeAll={() => setPanel('people')}
      />
      <HandsChip count={raisedHands.size} onSeeAll={() => setPanel('people')} />
    </div>
  )

  return (
    <div className="relative flex h-full flex-col bg-canvas">
      {/* Lecture keeps the header. In Class it moves into the control bar,
          which gives the rail and the board back the 56px. */}
      {mode === 'lecture' && (
        <TopBar title={title} mode={mode} recording={recording} elapsed={elapsed} />
      )}

      <div className="relative flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          {mode === 'class' && (
            <VideoRail
              ids={ids}
              selfId={localId}
              teacherId={teacherId}
              onSeeAll={() => setPanel('people')}
            />
          )}

          <div className="min-h-0 flex-1 p-6">
            {/* The board and the share share one region, and the share COVERS
                rather than replaces. Unmounting BoardStage would unmount the
                whiteboard iframe, and an iframe that remounts reloads - the
                class would watch the board blank and redraw itself every time
                a share ended. */}
            <div className="relative h-full w-full">
              <BoardStage
                url={whiteboard.url}
                canDraw={isTeacher}
                overlay={isTeacher && !presenterId ? teacherOverlay : undefined}
              />

              {presenterId && (
                <ScreenStage
                  presenterId={presenterId}
                  presenterName={views.find((p) => p.id === presenterId)?.name ?? 'Someone'}
                  isSelf={presenterId === localId}
                  onStop={() => void actions.toggleScreenShare()}
                  /* The knock stack follows the share up, because a student
                     waiting to be let in has no other surface and a teacher
                     mid-demo is looking here. */
                  overlay={isTeacher ? teacherOverlay : undefined}
                />
              )}
            </div>
          </div>

          {confirmLeave && (
            <LeavePrompt
              isTeacher={isTeacher}
              onStay={() => setConfirmLeave(false)}
              onLeave={exit}
            />
          )}

          {mediaRequest && (
            <MediaRequestPrompt
              request={mediaRequest}
              teacherName={views.find((p) => p.id === mediaRequest.requestedBy)?.name ?? 'Your teacher'}
              onRespond={actions.respondMediaRequest}
            />
          )}

          <ControlBar
            meta={mode === 'class' ? { title, mode, recording, elapsed } : undefined}
            micOn={self?.micOn ?? false}
            camOn={self?.camOn ?? false}
            onToggleMic={actions.toggleMic}
            onToggleCam={actions.toggleWebcam}
            handRaised={handRaised}
            handsEnabled={controls.handsEnabled}
            onToggleHand={() => {
              if (!localId) return
              void actions.publish(HANDS_TOPIC, encodeHand(localId, !handRaised))
            }}
            isTeacher={isTeacher}
            boardOn={Boolean(whiteboard.url)}
            boardBusy={whiteboard.inFlight}
            onToggleBoard={() => {
              if (whiteboard.url) void actions.stopWhiteboard()
              else void actions.startWhiteboard()
            }}
            sharingScreen={presenterId !== null && presenterId === localId}
            /* Named for the person, not the id, because that is what the
               control's tooltip says. Null when nobody else is presenting,
               which is the only state that leaves the button enabled. */
            shareTakenBy={
              presenterId && presenterId !== localId
                ? (views.find((p) => p.id === presenterId)?.name ?? 'Someone')
                : null
            }
            shareSupported={SCREEN_SHARE_SUPPORTED}
            onToggleShare={() => void actions.toggleScreenShare()}
            isRecording={recording}
            onToggleRecording={() => {
              if (recording) actions.stopRecording()
              else actions.startRecording()
            }}
            onMuteAll={() => {
              /* The action used to return void and say nothing, so a teacher
                 who muted a room of forty had no way to tell it from a dead
                 button. The count comes back from the loop that did the work,
                 not from the roster, so it cannot claim more than it muted. */
              const muted = actions.muteEveryoneElse()
              if (muted === 0) toast('Everyone is already muted')
              else toast(`Muted ${muted} ${muted === 1 ? 'student' : 'students'}`, 'success')
            }}
            chatEnabled={controls.chatEnabled}
            onToggleChatEnabled={(next) => setControls({ chatEnabled: next })}
            onToggleHandsEnabled={(next) => setControls({ handsEnabled: next })}
            panel={panel}
            onSetPanel={setPanel}
            participantCount={ids.length}
            waitingCount={waiting.length}
            moreOpen={moreOpen}
            onSetMoreOpen={setMoreOpen}
            onLeave={exit}
          />
        </main>

        {/* The column survives a hidden panel in Lecture, because the stage
            inside it is the only place the teacher's face exists in that
            mode. Once the window is narrow enough that the column floats, it
            goes away with the panel like everything else - the board keeps
            the width. */}
        {self && (panel || (mode === 'lecture' && !overlayPanel)) && (
          <SidePanel
            panel={panel}
            mode={mode}
            self={toPerson(self, raisedHands, isOnstage(self))}
            teacherId={teacherId}
            people={views.map((p) => toPerson(p, raisedHands, isOnstage(p)))}
            waiting={isTeacher ? waiting : EMPTY_QUEUE}
            onRespond={(id, allow) => void actions.respondEntry(id, allow)}
            onMute={actions.muteParticipant}
            onAskToUnmute={actions.askToUnmute}
            onLowerHand={(id) => void actions.publish(HANDS_TOPIC, encodeHand(id, false))}
            /* No confirm step, and a toast instead - the row's own button is
               already icon-only and red, and a modal over a live class costs
               more than the mis-click it prevents. The toast names who went,
               because the row they were on is gone by the time it appears.

               The name is read BEFORE the call. onParticipantLeft lands within
               the same beat and takes the roster row with it, so looking the
               name up afterwards finds nothing and the toast reads "Removed
               ." */
            onRemove={(id) => {
              const name = views.find((p) => p.id === id)?.name ?? 'That student'
              actions.removeFromClass(id)
              /* Raised hands narrow themselves against the roster, but the
                 promoted list does not - so without this a removed student
                 who knocks again walks straight back onto the Lecture stage. */
              if (controls.promoted.includes(id)) {
                setControls({ promoted: controls.promoted.filter((p) => p !== id) })
              }
              toast(`Removed ${name} from the class`, 'danger')
            }}
            promoted={controls.promoted}
            onPromote={(id) => {
              setControls({ promoted: [...controls.promoted, id] })
              /* The tile is ours to give; the microphone is not. This only
                 asks, and the student answers on their own screen. */
              actions.askToUnmute(id)
            }}
            onDemote={(id) =>
              setControls({ promoted: controls.promoted.filter((p) => p !== id) })
            }
            messages={messages.map((m) => ({
              id: m.key,
              who: m.senderName,
              text: m.text,
              mine: m.senderId === localId,
              at: '',
            }))}
            chatEnabled={controls.chatEnabled || isTeacher}
            onSend={(text) => actions.publish(CHAT_TOPIC, text)}
            overlay={overlayPanel}
            onHide={() => setPanel(null)}
          />
        )}
      </div>

      {whiteboard.error && (
        <div className="pointer-events-none absolute inset-x-0 bottom-20 flex justify-center">
          <span className="rounded-pill bg-danger-bg px-3 py-1 text-sm text-danger-fg">
            {whiteboard.error}
          </span>
        </div>
      )}
    </div>
  )
}
