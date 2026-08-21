import { ChatPanel } from './ChatPanel'
import { PeoplePanel } from './PeoplePanel'
import { Tile } from './Tile'
import { RoomIcon } from './icons'
import { cn } from '../design/ui'
import type { PanelKind } from './ControlBar'
import type { ChatMessage, ClassMode, Person } from '../domain/classroom'
import type { EntryRequest } from '../sdk'

/* The right-hand panel, 320px.

   In Lecture it also carries the stage. One face across a 112px full-width
   band is waste, so the rail unmounts and the teacher moves into the panel's
   top slot instead - "teacher onstage, students listed below", exactly as the
   spec puts it.

   The tile in that slot is 4:3, not 16:9. Panel width drives tile width here,
   and in a narrow column 4:3 buys real vertical presence where 16:9 would
   give a letterbox strip. */

export const SIDE_PANEL_WIDTH = 320

export interface SidePanelProps {
  panel: Exclude<PanelKind, null>
  mode: ClassMode
  self: Person
  people: Person[]
  messages: ChatMessage[]
  /** Students knocking. Empty for anyone without allow_mod. */
  waiting: readonly EntryRequest[]
  onRespond: (id: string, allow: boolean) => void
  chatEnabled: boolean
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
  people,
  messages,
  waiting,
  onRespond,
  chatEnabled,
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
        <div className="shrink-0 border-b border-line p-3">
          <Tile person={self} self className="aspect-[4/3] w-full" />
        </div>
      )}

      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-3">
        <RoomIcon name={panel === 'chat' ? 'chat' : 'users'} size={15} className="text-ink-tertiary" />
        <span className="text-base font-semibold text-ink">
          {panel === 'chat' ? 'Messages' : `People (${people.length})`}
        </span>
        <button
          type="button"
          onClick={onHide}
          className="ml-auto cursor-pointer border-0 bg-transparent p-0 text-sm text-ink-tertiary hover:text-ink"
        >
          Hide
        </button>
      </div>

      {panel === 'chat' ? (
        <ChatPanel messages={messages} enabled={chatEnabled} />
      ) : (
        <PeoplePanel
          people={people}
          selfId={self.id}
          waiting={waiting}
          onRespond={onRespond}
        />
      )}
    </aside>
  )
}
