import { LiveTile } from './LiveTile'

/* The Class rail: everyone onstage, above the board.

   Capped, because a rail is not a plan for forty students. Twelve tiles is
   roughly what fits across a laptop before each one is too small to read a
   face in, and the overflow is not hidden - it becomes a chip that opens the
   roster, which is where a class of forty is legible in the first place.

   The order is not join order. Self and the teacher are pinned to the front,
   so the two faces a student actually looks for - "am I muted" and "is the
   teacher still here" - never fall off the end of the cap. */

export const RAIL_CAP = 12

export interface VideoRailProps {
  ids: readonly string[]
  selfId: string | null
  teacherId: string | null
  onSeeAll: () => void
}

export function VideoRail({ ids, selfId, teacherId, onSeeAll }: VideoRailProps) {
  const pinned = [selfId, teacherId].filter((id): id is string => id !== null && ids.includes(id))
  const ordered = [...new Set([...pinned, ...ids])]
  const shown = ordered.slice(0, RAIL_CAP)
  const hidden = ordered.length - shown.length

  return (
    <div className="h-[112px] shrink-0 overflow-x-auto border-b border-line">
      <div className="mx-auto flex h-full w-max items-center gap-2 px-3">
        {shown.map((id) => (
          <LiveTile key={id} id={id} selfId={selfId} className="h-[96px] w-[128px] shrink-0" />
        ))}

        {hidden > 0 && (
          <button
            type="button"
            onClick={onSeeAll}
            className="flex h-[96px] w-[72px] shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border-0 bg-inset text-ink-secondary hover:bg-raised hover:text-ink"
          >
            <span className="text-lg font-semibold">+{hidden}</span>
            <span className="text-xs">See all</span>
          </button>
        )}
      </div>
    </div>
  )
}
