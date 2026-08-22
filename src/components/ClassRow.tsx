import { Badge, Button, cn } from '../design/ui'
import { RoomIcon } from './icons'
import type { Room } from '../lib/rooms'

/* One class in the list. Lifted out of Home unchanged so home and /classes
   cannot drift apart. */

export interface ClassRowProps {
  room: Room
  copyLabel: string
  onCopy: () => void
  onOpen: () => void
}

export function ClassRow({ room, copyLabel, onCopy, onOpen }: ClassRowProps) {
  return (
    <li
      className={cn(
        'group flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-2 py-3',
        'border-b border-hairline last:border-b-0',
        'transition-colors duration-[120ms] ease-standard hover:bg-subtle',
        room.endedAt && 'opacity-60',
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-inset text-ink-secondary">
        <RoomIcon name={room.mode === 'lecture' ? 'cam' : 'users'} size={18} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-base font-medium text-ink">{room.title}</span>
        <span className="truncate font-mono text-sm text-ink-tertiary">{room.roomId}</span>
      </div>
      {/* Outline, not filled: the neutral fill is --bg-muted, which in
          dark resolves to the same value as --surface-card - a filled
          badge on this row would be an invisible rectangle. */}
      <span className="shrink-0">
        {room.endedAt ? (
          <Badge tone="neutral" outline>
            ended
          </Badge>
        ) : (
          <Badge tone={room.mode === 'lecture' ? 'primary' : 'neutral'} outline>
            {room.mode}
          </Badge>
        )}
      </span>
      {/* An ended class keeps its room and loses its audience: the link is a
          409 for students until the teacher comes back, so Copy link goes and
          Open becomes Start again. Opening it IS the restart - api/session
          clears ended_at for the owner - which is why this is the same
          navigation under a different word rather than a second action.

          The pair is full width on a phone, so it drops to its own line and
          the title keeps the one above it rather than being truncated to
          three letters. */}
      <span className="flex shrink-0 items-center gap-1 max-sm:w-full max-sm:justify-end">
        {!room.endedAt && (
          <Button
            variant="text"
            /* Sized for the wider of its two labels: "Copied" is shorter
               than "Copy link", and without a floor the Open button slides
               left for the 1.6s it shows. */
            className="min-w-[5.5rem]"
            aria-live="polite"
            onClick={onCopy}
          >
            {copyLabel}
          </Button>
        )}
        <Button variant="secondary" onClick={onOpen}>
          {room.endedAt ? 'Start again' : 'Open'}
        </Button>
      </span>
    </li>
  )
}
