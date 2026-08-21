import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BoardStage } from '../components/BoardStage'
import { HandsChip } from '../components/HandsChip'
import { KnockCard } from '../components/KnockCard'
import { MediaRequestPrompt } from '../components/MediaRequestPrompt'
import { ControlBar, type PanelKind } from '../components/ControlBar'
import { SidePanel } from '../components/SidePanel'
import { TopBar } from '../components/TopBar'
import { VideoRail } from '../components/VideoRail'
import type { ClassMode, Person } from '../domain/classroom'
import { PANEL_OVERLAY_BREAKPOINT } from '../lib/boardGeometry'
import { useElapsedSeconds } from '../lib/useElapsedSeconds'
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
  isTeacher,
}: {
  mode: ClassMode
  title: string
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
  const whiteboard = useWhiteboard()
  const actions = useRoomActions()
  const navigate = useNavigate()
  const messages = useTopic(CHAT_TOPIC)

  /* The room opens on the board, not on the chat. The board is the product
     and the first thing a class should see; the panel is one click away and
     the control bar carries the toggle. */
  const [panel, setPanel] = useState<PanelKind>(null)
  const [moreOpen, setMoreOpen] = useState(false)

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
            <BoardStage
              url={whiteboard.url}
              canDraw={isTeacher}
              overlay={
                isTeacher ? (
                  /* One stack, top-right. Knocks first: somebody waiting to
                     be let in has nothing else on screen, while a raised hand
                     is also in the rail and in the roster. */
                  <div className="flex flex-col items-end gap-2">
                    <KnockCard
                      waiting={waiting}
                      onRespond={(id, allow) => void actions.respondEntry(id, allow)}
                      onSeeAll={() => setPanel('people')}
                    />
                    <HandsChip count={raisedHands.size} onSeeAll={() => setPanel('people')} />
                  </div>
                ) : undefined
              }
            />
          </div>

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
            onLeave={() => {
              /* The class IS the teacher, so their exit ends it for everyone.
                 end() is the only way to close the room - leave() would drop
                 the teacher and leave students in an empty class with a board
                 nobody owns. Students learn about it from the leave reason. */
              if (isTeacher) actions.end()
              else actions.leave()
              /* Replace rather than push, so Back does not return to a room
                 this participant has already left. */
              navigate('/', { replace: true })
            }}
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
