import { ChatPanel } from './ChatPanel'
import { LectureStage } from './LectureStage'
import { PeoplePanel } from './PeoplePanel'
import { RoomIcon } from './icons'
import { IconButton, cn } from '../design/ui'
import type { PanelKind } from './ControlBar'
import type { ChatMessage, ClassMode, Person } from '../domain/classroom'
import type { EntryRequest } from '../sdk'

/* The right-hand column, 320px.

   In Lecture it also carries the stage, so this component outlives the panel
   itself: `panel` may be null while the lecture stage is still mounted, which
   is what keeps the teacher's face on screen after somebody hides the chat.
   "Teacher onstage, students listed below", exactly as the spec puts it - the
   students being the roster one toggle away.

   When the window is too narrow for a column beside the board, the whole
   thing floats instead, and hiding the panel takes the lecture stage with it.
   That is the rule from step 3 applied honestly: the board is the product,
   and the panel yields to it first. */

export const SIDE_PANEL_WIDTH = 320

export interface SidePanelProps {
  /** Null means no chat and no roster - only the Lecture stage, which is the
      one thing in this column that is not dismissible. */
  panel: PanelKind
  mode: ClassMode
  self: Person
  /** Server-derived. Null until the teacher's participant row arrives. */
  teacherId: string | null
  people: Person[]
  messages: ChatMessage[]
  /** Students knocking. Empty for anyone without allow_mod. */
  waiting: readonly EntryRequest[]
  onRespond: (id: string, allow: boolean) => void
  onMute: (id: string) => void
  onAskToUnmute: (id: string) => void
  onLowerHand: (id: string) => void
  promoted: readonly string[]
  onPromote: (id: string) => void
  onDemote: (id: string) => void
  chatEnabled: boolean
  onSend: (text: string) => Promise<void>
  /** Once the window is too narrow for both, the panel floats over the stage
      instead of taking width from it, so the board never gets squeezed below
      the size its own toolbar needs. The board is the product; the chat is
      not. */
  overlay: boolean
  onHide: () => void
}

export function SidePanel({
  panel,
  mode,
  self,
  teacherId,
  people,
  messages,
  waiting,
  onRespond,
  onMute,
  onAskToUnmute,
  onLowerHand,
  promoted,
  onPromote,
  onDemote,
  chatEnabled,
  onSend,
  overlay,
  onHide,
}: SidePanelProps) {
  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-l border-line bg-card',
        /* bottom-16, not inset-y-0. The control bar is the last 64px of the
           main column, and a panel that floats over it takes Leave with it. */
        overlay && 'absolute right-0 top-0 bottom-16 z-30',
      )}
      style={{
        width: SIDE_PANEL_WIDTH,
        boxShadow: overlay ? '-16px 0 48px rgba(0,0,0,.55)' : undefined,
      }}
    >
      {mode === 'lecture' && (
        <LectureStage
          teacherId={teacherId}
          selfId={self.id}
          promoted={promoted}
          isTeacher={self.role === 'teacher'}
        />
      )}

      {panel && (
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-3">
          <RoomIcon name={panel === 'chat' ? 'chat' : 'users'} size={15} className="text-ink-tertiary" />
          <span className="text-base font-semibold text-ink">
            {panel === 'chat' ? 'Messages' : `People (${people.length})`}
          </span>
          <IconButton
            variant="ghost"
            size="sm"
            className="ml-auto"
            aria-label="Hide panel"
            onClick={onHide}
          >
            <RoomIcon name="close" size={16} />
          </IconButton>
        </div>
      )}

      {panel === 'chat' && (
        <ChatPanel messages={messages} enabled={chatEnabled} onSend={onSend} />
      )}
      {panel === 'people' && (
        <PeoplePanel
          people={people}
          selfId={self.id}
          isTeacher={self.role === 'teacher'}
          onMute={onMute}
          onAskToUnmute={onAskToUnmute}
          onLowerHand={onLowerHand}
          canPromote={mode === 'lecture' && self.role === 'teacher'}
          onPromote={onPromote}
          onDemote={onDemote}
          waiting={waiting}
          onRespond={onRespond}
        />
      )}
    </aside>
  )
}
