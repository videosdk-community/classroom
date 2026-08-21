import { RoomIcon } from './icons'

/* "3 hands up", floating over the board for the teacher.

   Same reasoning as the knock card: a teacher mid-explanation is looking at
   the board, not at a panel, and a raised hand is only useful while it is
   still relevant. It sits in the same top-right stack, which the probe found
   free below tldraw's collaborator row.

   Students do not get it. A hand is a request aimed at the teacher, and a
   counter of them on every screen turns asking a question into a scoreboard. */

export interface HandsChipProps {
  count: number
  onSeeAll: () => void
}

export function HandsChip({ count, onSeeAll }: HandsChipProps) {
  if (count === 0) return null

  return (
    <button
      type="button"
      onClick={onSeeAll}
      /* pointer-events-auto: BoardStage's overlay layer disables them so the
         iframe underneath stays drawable. */
      className="pointer-events-auto flex cursor-pointer items-center gap-1.5 rounded-pill border border-line-strong py-1.5 pl-2.5 pr-3"
      style={{ background: 'rgba(9,9,11,.86)', backdropFilter: 'blur(4px)' }}
    >
      <RoomIcon name="hand" size={14} style={{ color: 'var(--amber-500)' }} />
      <span className="text-base text-white">
        {count === 1 ? '1 hand up' : `${count} hands up`}
      </span>
    </button>
  )
}
