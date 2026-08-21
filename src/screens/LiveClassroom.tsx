import { useState } from 'react'
import { BoardStage } from '../components/BoardStage'
import { ControlBar, type PanelKind } from '../components/ControlBar'
import { SidePanel } from '../components/SidePanel'
import { TopBar } from '../components/TopBar'
import { LiveTile } from '../components/LiveTile'
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
  useRoomActions,
  useRoomStatus,
  useTopic,
  useWhiteboard,
  type ParticipantView,
} from '../sdk'

/* The classroom, wired to a real meeting.

   Same components as the fixture screen. The only new thing is the adapter
   below, and the point of the seam is that this file never mentions the SDK -
   it reads app-shaped types from src/sdk and nothing else. */

/* A stable hue per participant so the camera-off placeholder does not change
   colour on every render. Derived from the id rather than random. */
function hueFor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360
  return h
}

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
    hue: hueFor(p.id),
  }
}

export function LiveClassroom({ mode }: { mode: ClassMode }) {
  const status = useRoomStatus()
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

  if (status !== 'connected') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-canvas">
        <span className="text-xl font-semibold text-ink">
          {status === 'failed' ? 'Could not join the class' : 'Joining the class'}
        </span>
        <span className="text-base text-ink-secondary">{status}</span>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-canvas">
      <TopBar title="Calculus II" mode={mode} recording={recording} elapsed="live" />

      <div className="relative flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          {mode === 'class' && (
            <div className="h-[112px] shrink-0 overflow-x-auto border-b border-line">
              <div className="mx-auto flex h-full w-max items-center gap-2 px-3">
                {ids.map((id) => (
                  <LiveTile key={id} id={id} selfId={localId} className="h-[96px] w-[128px] shrink-0" />
                ))}
              </div>
            </div>
          )}

          <div className="min-h-0 flex-1 p-6">
            <BoardStage boardOn={Boolean(whiteboard.url)} />
          </div>

          <ControlBar
            micOn={self?.micOn ?? false}
            camOn={self?.camOn ?? false}
            onToggleMic={actions.toggleMic}
            onToggleCam={actions.toggleWebcam}
            handRaised={false}
            handsEnabled={handsEnabled}
            onToggleHand={() => {}}
            isTeacher
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
            moreOpen={moreOpen}
            onSetMoreOpen={setMoreOpen}
            onLeave={actions.leave}
          />
        </main>

        {panel && self && (
          <SidePanel
            panel={panel}
            mode={mode}
            self={toPerson(self)}
            people={views.map(toPerson)}
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
