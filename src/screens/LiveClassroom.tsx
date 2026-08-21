import { useState } from 'react'
import { BoardStage } from '../components/BoardStage'
import { KnockCard } from '../components/KnockCard'
import { MediaRequestPrompt } from '../components/MediaRequestPrompt'
import { ControlBar, type PanelKind } from '../components/ControlBar'
import { SidePanel } from '../components/SidePanel'
import { TopBar } from '../components/TopBar'
import { VideoRail } from '../components/VideoRail'
import type { ClassMode, Person } from '../domain/classroom'
import { PANEL_OVERLAY_BREAKPOINT } from '../lib/boardGeometry'
import { useMediaQuery } from '../lib/useMediaQuery'
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

function toPerson(p: ParticipantView): Person {
  return {
    id: p.id,
    name: p.name,
    role: p.isTeacher ? 'teacher' : 'student',
    micOn: p.micOn,
    camOn: p.camOn,
    handRaised: false,
    speaking: p.isActiveSpeaker,
    onstage: true,
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
  const messages = useTopic(CHAT_TOPIC)

  const [panel, setPanel] = useState<PanelKind>('chat')
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


  /* The knock queue. Only a token holding allow_mod ever receives these, so a
     student's queue is permanently empty and the surfaces below simply never
     appear for them. */
  const waiting = useEntryQueue()

  /* Only ever set on the person being asked, so a teacher never sees their
     own request come back. */
  const mediaRequest = useMediaRequest()

  return (
    <div className="relative flex h-full flex-col bg-canvas">
      <TopBar title={title} mode={mode} recording={recording} elapsed="live" />

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
              overlay={
                isTeacher ? (
                  <KnockCard
                    waiting={waiting}
                    onRespond={(id, allow) => void actions.respondEntry(id, allow)}
                    onSeeAll={() => setPanel('people')}
                  />
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
            onMuteAll={actions.muteEveryoneElse}
            chatEnabled={controls.chatEnabled}
            onToggleChatEnabled={(next) => setControls({ chatEnabled: next })}
            onToggleHandsEnabled={(next) => setControls({ handsEnabled: next })}
            panel={panel}
            onSetPanel={setPanel}
            participantCount={ids.length}
            waitingCount={waiting.length}
            moreOpen={moreOpen}
            onSetMoreOpen={setMoreOpen}
            onLeave={actions.leave}
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
            self={toPerson(self)}
            teacherId={teacherId}
            people={views.map(toPerson)}
            waiting={isTeacher ? waiting : EMPTY_QUEUE}
            onRespond={(id, allow) => void actions.respondEntry(id, allow)}
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
