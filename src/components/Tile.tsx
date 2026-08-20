import { RoomIcon } from './icons'
import { cn } from '../design/ui'
import type { Person } from '../fixtures/classroom'

/* A participant tile. Camera placeholder for now - step 4 swaps the gradient
   for a real <video> off the SDK stream and nothing else here changes.

   Two rings that must never read as the same thing. The speaking ring is the
   loud one, lavender and 2.5px. "This is you" is a quiet outline, because a
   student who cannot find their own face cannot answer "am I muted", which is
   the question that actually stops people joining. */

export interface TileProps {
  person: Person
  self?: boolean
  className?: string
}

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
}

export function Tile({ person, self = false, className }: TileProps) {
  const ring = person.speaking
    ? 'inset 0 0 0 2.5px var(--primary-button)'
    : self
      ? 'inset 0 0 0 1.5px var(--text-tertiary)'
      : 'inset 0 0 0 1px rgba(255,255,255,.06)'

  const label = self
    ? person.role === 'teacher'
      ? 'You (teacher)'
      : 'You'
    : person.role === 'teacher'
      ? `${person.name} (teacher)`
      : person.name

  return (
    <div
      className={cn('relative overflow-hidden rounded-xl bg-inset', className)}
      style={{ boxShadow: ring }}
    >
      {person.camOn ? (
        <div
          className="h-full w-full"
          style={{ background: `linear-gradient(135deg, hsl(${person.hue} 45% 26%), #0f0f12)` }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <div
            className="flex size-10 items-center justify-center rounded-[50%] text-base font-semibold"
            style={{ background: 'var(--primary-200)', color: 'var(--primary-900)' }}
          >
            {initials(person.name)}
          </div>
        </div>
      )}

      <div
        className="absolute bottom-1.5 left-1.5 flex h-6 max-w-[calc(100%-12px)] items-center gap-1 rounded-md px-2 text-sm text-white backdrop-blur-[4px]"
        style={{ background: 'rgba(0,0,0,.55)' }}
      >
        {person.micOn ? (
          <RoomIcon name="mic" size={12} />
        ) : (
          <RoomIcon name="micOff" size={12} style={{ color: 'var(--red-400)' }} />
        )}
        <span className="truncate">{label}</span>
        {self && !person.micOn && (
          <span className="shrink-0" style={{ color: 'var(--red-400)' }}>
            muted
          </span>
        )}
      </div>

      {person.handRaised && (
        <div
          className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-md"
          style={{ background: 'var(--amber-500)', color: '#000' }}
        >
          <RoomIcon name="hand" size={14} />
        </div>
      )}
    </div>
  )
}
