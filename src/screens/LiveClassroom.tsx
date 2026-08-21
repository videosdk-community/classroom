import { useState } from 'react'
import { BoardStage } from '../components/BoardStage'
import { KnockCard } from '../components/KnockCard'
import { ControlBar, type PanelKind } from '../components/ControlBar'
import { SidePanel } from '../components/SidePanel'
import { TopBar } from '../components/TopBar'
import { VideoRail } from '../components/VideoRail'
import type { ClassMode, Person } from '../domain/classroom'
import { PANEL_OVERLAY_BREAKPOINT } from '../lib/boardGeometry'
import { useMediaQuery } from '../lib/useMediaQuery'
import {
  CHAT_TOPIC,
  useIsRecording,
  useLocalId,
  useParticipantIds,
  useParticipantView,
  useParticipantViews,
  useEntryQueue,
  useRoomActions,
  useTopic,
  useWhiteboard,
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
  const recording = useIsRecording()
  const whiteboard = useWhiteboard()
  const actions = useRoomActions()
  const messages = useTopic(CHAT_TOPIC)

  const [panel, setPanel] = useState<PanelKind>('chat')
  const [moreOpen, setMoreOpen] = useState(false)
  const [chatEnabled, setChatEnabled] = useState(true)
  const [handsEnabled, setHandsEnabled] = useState(true)

  const overlayPanel = useMediaQuery(`(max-width: ${PANEL_OVERLAY_BREAKPOINT - 1}px)`)
  const [wasOverlay, setWasOverlay] = useState(overlayPanel)
  if (wasOverlay !== overlayPanel) {
    setWasOverlay(overlayPanel)
    if (overlayPanel) setPanel(null)
  }

  const self = useParticipantView(localId ?? '')

  /* Server-derived, so this finds the real teacher rather than whoever
     claimed to be one. Null until their row arrives - a class can be opened
     before the teacher's own participant event has landed. */
  const teacherId = views.find((p) => p.isTeacher)?.id ?? null

  /* The knock queue. Only a token holding allow_mod ever receives these, so a
     student's queue is permanently empty and the surfaces below simply never
     appear for them. */
  const waiting = useEntryQueue()

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
              boardOn={Boolean(whiteboard.url)}
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

          <ControlBar
            micOn={self?.micOn ?? false}
            camOn={self?.camOn ?? false}
            onToggleMic={actions.toggleMic}
            onToggleCam={actions.toggleWebcam}
            handRaised={false}
            handsEnabled={handsEnabled}
            onToggleHand={() => {}}
            isTeacher={isTeacher}
            boardOn={Boolean(whiteboard.url)}
            boardBusy={whiteboard.inFlight}
            onToggleBoard={() => {
              if (whiteboard.url) void actions.stopWhiteboard()
              else void actions.startWhiteboard()
            }}
            onMuteAll={() => {
              for (const id of ids) if (id !== localId) actions.muteParticipant(id)
            }}
            chatEnabled={chatEnabled}
            onToggleChatEnabled={setChatEnabled}
            onToggleHandsEnabled={setHandsEnabled}
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
            chatEnabled={chatEnabled}
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
