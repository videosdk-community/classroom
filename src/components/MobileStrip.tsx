import { LiveTile } from './LiveTile'
import { RoomIcon } from './icons'
import { orderTiles } from '../lib/railOrder'

/* The phone top strip. Replaces VideoRail (Class) and LectureStage (Lecture)
   below the phone breakpoint - both modes converge here, since a phone has no
   room for a side column or a full-width rail plus a board. Teacher first,
   then the viewer's own tile, then everyone else scrollable: the ordering a
   student needs is "is the teacher here", then "am I muted".

   The recording indicator lives here rather than on the phone control bar,
   which is already at capacity with 4-5 buttons. The strip is always
   mounted, so this satisfies "never hidden at any width" from a surface with
   room for it. */

const MOBILE_STRIP_CAP = 8

export interface MobileStripProps {
  ids: readonly string[]
  selfId: string | null
  teacherId: string | null
  onSeeAll: () => void
  recording: boolean
}

export function MobileStrip({ ids, selfId, teacherId, onSeeAll, recording }: MobileStripProps) {
  const { shown, hidden } = orderTiles(ids, [teacherId, selfId], MOBILE_STRIP_CAP)

  return (
    <div className="relative h-[92px] shrink-0 overflow-x-auto border-b border-line">
      <div className="flex h-full w-max items-center gap-1.5 px-2">
        {shown.map((id) => (
          <LiveTile key={id} id={id} selfId={selfId} className="h-[72px] w-[96px] shrink-0" />
        ))}

        {hidden > 0 && (
          <button
            type="button"
            onClick={onSeeAll}
            className="flex h-[72px] w-[60px] shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border-0 bg-inset text-ink-secondary hover:bg-raised hover:text-ink"
          >
            <span className="text-base font-semibold">+{hidden}</span>
            <span className="text-xs">More</span>
          </button>
        )}
      </div>

      {recording && (
        <span
          className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-pill px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{ background: 'var(--danger-bg)', color: 'var(--danger-fg)' }}
        >
          <RoomIcon name="record" size={9} />
          Rec
        </span>
      )}
    </div>
  )
}
