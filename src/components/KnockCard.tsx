import { KnockRow } from './KnockRow'
import type { EntryRequest } from '../sdk'

/* The teacher's knock queue, floating over the stage.

   Top-right, and the position is measured rather than chosen by taste. Step 0
   mapped tldraw's own furniture to four regions - page menu top-left, toolbar
   along the bottom, style panel on the right edge low down (y = H-344), zoom
   bottom-left - leaving top-centre, top-right and left-middle free. This is
   the only floating chrome in the app and it sits in one of those.

   It floats because a teacher mid-explanation is looking at the board, not at
   a panel, and a student knocking is time-sensitive in a way nothing else in
   this room is. */

/* Beyond this the card would start covering the board it floats over. The
   rest go to the People panel, which is the surface built for a list. */
const MAX_ROWS = 3

export interface KnockCardProps {
  waiting: readonly EntryRequest[]
  onRespond: (id: string, allow: boolean) => void
  onSeeAll: () => void
}

export function KnockCard({ waiting, onRespond, onSeeAll }: KnockCardProps) {
  if (waiting.length === 0) return null

  const shown = waiting.slice(0, MAX_ROWS)
  const overflow = waiting.length - shown.length

  return (
    <div
      className="absolute right-9 top-9 z-20 w-[268px] overflow-hidden rounded-xl border border-line-strong bg-card"
      style={{ boxShadow: 'var(--elevation-popover)' }}
    >
      <div className="px-3 pb-1 pt-2 text-xs uppercase tracking-wide text-ink-tertiary">
        {waiting.length === 1 ? 'Waiting to join' : `Waiting to join (${waiting.length})`}
      </div>

      {shown.map((request) => (
        <KnockRow key={request.participantId} request={request} onRespond={onRespond} />
      ))}

      {overflow > 0 && (
        <button
          type="button"
          onClick={onSeeAll}
          className="w-full cursor-pointer border-0 border-t border-line bg-transparent px-3 py-2 text-left text-sm text-ink-tertiary hover:text-ink"
        >
          +{overflow} more waiting
        </button>
      )}
    </div>
  )
}
