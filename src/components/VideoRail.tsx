import { Tile } from './Tile'
import type { Person } from '../fixtures/classroom'

/* The horizontal video rail, Class mode only.

   A rail is not a plan for forty students, so it caps and hands the overflow
   to the people panel. The cap is a product decision, not a layout accident:
   past a dozen faces at 128px the rail stops being scannable and starts being
   a scrollbar. */

export const RAIL_TILE_CAP = 12

export interface VideoRailProps {
  people: Person[]
  selfId: string
  onOverflowClick: () => void
}

export function VideoRail({ people, selfId, onOverflowClick }: VideoRailProps) {
  const shown = people.slice(0, RAIL_TILE_CAP)
  const overflow = people.length - shown.length

  return (
    /* Centred while the tiles fit, scrolling once they do not. The inner
       w-max wrapper is what lets those two coexist: justify-center on a
       scroll container clips the first tile the moment it overflows, which
       is a real bug and not a theoretical one. */
    <div className="h-[112px] shrink-0 overflow-x-auto border-b border-line">
      <div className="mx-auto flex h-full w-max items-center gap-2 px-3">
        {shown.map((p) => (
          <Tile
            key={p.id}
            person={p}
            self={p.id === selfId}
            className="h-[96px] w-[128px] shrink-0"
          />
        ))}

        {overflow > 0 && (
          /* Sticky, not merely last. Once the tiles overflow, a chip parked at
             the end of the scroll content is off-screen exactly when it is
             needed - the rail then reads as a row of clipped faces rather
             than as "there are more people". Pinned to the right edge it
             stays the answer to the question the clipping raises. The left
             fade is what stops a tile appearing to be sliced by it. */
          <div className="sticky right-0 flex h-full shrink-0 items-center pl-6">
            <div
              className="pointer-events-none absolute inset-y-0 left-0 w-6"
              style={{ background: 'linear-gradient(to right, transparent, var(--bg-base))' }}
            />
            <button
              type="button"
              onClick={onOverflowClick}
              className="relative flex h-[96px] w-[72px] shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-0 bg-inset text-ink-tertiary hover:text-ink"
            >
              <span className="text-lg font-semibold">+{overflow}</span>
              <span className="text-xs uppercase tracking-wide">more</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
