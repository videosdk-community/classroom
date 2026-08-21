import { useState } from 'react'
import { BoardStage } from '../components/BoardStage'
import { ControlBar, type PanelKind } from '../components/ControlBar'
import { SidePanel } from '../components/SidePanel'
import { TopBar } from '../components/TopBar'
import { VideoRail } from '../components/VideoRail'
import { MESSAGES, PEOPLE, TEACHER } from '../fixtures/classroom'
import type { ClassMode, Person } from '../domain/classroom'
import { PANEL_OVERLAY_BREAKPOINT } from '../lib/boardGeometry'
import { useMediaQuery } from '../lib/useMediaQuery'

/* The hero screen: board centre stage, faces around it.

   Layout is variant A, "rail above, panel right", chosen from the prototype.
   Class and Lecture are the same shell with the rail mounted or not - both
   are layout plus convention, and neither makes any claim to lock the
   audience out of the board. The only real enforcement anywhere in the room
   is allow_mod.

   Step 3 only. Every value here comes from fixtures; the SDK arrives in step
   4 and replaces the state below without moving the layout. */

export interface ClassroomProps {
  mode: ClassMode
  /** Dev-only, from ?keepout=1. Paints tldraw's furniture regions. */
  showKeepout?: boolean
}

export function Classroom({ mode, showKeepout }: ClassroomProps) {
  const [panel, setPanel] = useState<PanelKind>('chat')
  const [chatEnabled, setChatEnabled] = useState(true)
  const [handsEnabled, setHandsEnabled] = useState(true)
  const [handRaised, setHandRaised] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [boardOn, setBoardOn] = useState(true)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)

  /* Below this the panel floats over the stage rather than taking width from
     it. The probe measured the consequence of getting this wrong: at 800 wide
     the board's own toolbar wraps from 56px to 104px and eats the board from
     the bottom, and by 640 the style panel is gone entirely. So the panel
     yields first, always. */
  const overlayPanel = useMediaQuery(`(max-width: ${PANEL_OVERLAY_BREAKPOINT - 1}px)`)

  /* Crossing into overlay territory closes the panel rather than floating it
     over the board unasked. Opening it again is a deliberate act, and then it
     covers the board because the user asked for that - which is a different
     thing from the shell deciding chat matters more than the lesson.

     Adjusted during render rather than in an effect. An effect would paint the
     panel over the board for one frame and then yank it away, which is the
     visible version of the bug it is meant to prevent. */
  const [wasOverlay, setWasOverlay] = useState(overlayPanel)
  if (wasOverlay !== overlayPanel) {
    setWasOverlay(overlayPanel)
    if (overlayPanel) setPanel(null)
  }

  /* The self tile reads from the control bar, not from the fixture. A tile
     saying "mic on" while the bar says muted is the exact class of lie that
     makes the whole bar untrustworthy. */
  const me: Person = { ...TEACHER, micOn, camOn, handRaised }
  const withMe = (p: Person) => (p.id === TEACHER.id ? me : p)

  /* Compare by id, never by reference - `me` is a fresh object each render. */
  const onstage = mode === 'lecture' ? [me] : PEOPLE.filter((p) => p.onstage).map(withMe)
  const roster = PEOPLE.map(withMe)

  return (
    <div className="flex h-full flex-col bg-canvas">
      <TopBar title="Calculus II" mode={mode} recording elapsed="42:18" />

      <div className="relative flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          {mode === 'class' && (
            <VideoRail
              people={onstage}
              selfId={me.id}
              onOverflowClick={() => setPanel('people')}
            />
          )}

          {/* The surround. A uniform inset plus whatever the letterbox adds,
              so the board is never flush against the chrome. */}
          <div className="min-h-0 flex-1 p-6">
            <BoardStage boardOn={boardOn} showKeepout={showKeepout} />
          </div>

          <ControlBar
            micOn={micOn}
            camOn={camOn}
            onToggleMic={() => setMicOn((v) => !v)}
            onToggleCam={() => setCamOn((v) => !v)}
            handRaised={handRaised}
            handsEnabled={handsEnabled}
            onToggleHand={() => setHandRaised((v) => !v)}
            isTeacher={me.role === 'teacher'}
            boardOn={boardOn}
            boardBusy={false}
            onToggleBoard={() => setBoardOn((v) => !v)}
            onMuteAll={() => {}}
            chatEnabled={chatEnabled}
            onToggleChatEnabled={setChatEnabled}
            onToggleHandsEnabled={setHandsEnabled}
            panel={panel}
            onSetPanel={setPanel}
            participantCount={PEOPLE.length}
            moreOpen={moreOpen}
            onSetMoreOpen={setMoreOpen}
            onLeave={() => {}}
          />
        </main>

        {panel && (
          <SidePanel
            panel={panel}
            mode={mode}
            self={me}
            people={roster}
            messages={MESSAGES}
            chatEnabled={chatEnabled}
            overlay={overlayPanel}
            onHide={() => setPanel(null)}
          />
        )}
      </div>
    </div>
  )
}
