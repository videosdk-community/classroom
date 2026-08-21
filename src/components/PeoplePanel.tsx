import { KnockRow } from './KnockRow'
import { RoomIcon } from './icons'
import type { Person } from '../domain/classroom'
import type { EntryRequest } from '../sdk'

/* The roster. Also where the rail's overflow lands, so it is the answer to
   "a rail is not a plan for forty students" rather than a secondary surface. */

export interface PeoplePanelProps {
  people: Person[]
  selfId: string
  /** Knocking, not yet in the room. Pinned above the roster because a person
      waiting for an answer outranks a list of people who already have one,
      and because this is where a queue too long for the floating card lands. */
  waiting: readonly EntryRequest[]
  onRespond: (id: string, allow: boolean) => void
}

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
}

export function PeoplePanel({ people, selfId, waiting, onRespond }: PeoplePanelProps) {
  return (
    <div className="flex-1 overflow-y-auto py-1">
      {waiting.length > 0 && (
        <div className="mb-1 border-b border-line pb-1">
          <div className="px-3 pb-1 pt-1.5 text-xs uppercase tracking-wide text-ink-tertiary">
            Waiting to join ({waiting.length})
          </div>
          {waiting.map((request) => (
            <KnockRow key={request.participantId} request={request} onRespond={onRespond} />
          ))}
        </div>
      )}

      {people.map((p) => (
        <div key={p.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-raised">
          <div
            className="flex size-7 shrink-0 items-center justify-center rounded-[50%] text-sm font-semibold"
            style={{ background: 'var(--primary-200)', color: 'var(--primary-900)' }}
          >
            {initials(p.name)}
          </div>
          <span className="flex-1 truncate text-base text-ink-secondary">
            {p.id === selfId ? `${p.name} (you)` : p.name}
            {p.role === 'teacher' && (
              <span className="ml-1.5 text-sm text-ink-tertiary">teacher</span>
            )}
          </span>
          {p.handRaised && (
            <RoomIcon name="hand" size={14} style={{ color: 'var(--amber-500)' }} />
          )}
          <RoomIcon
            name={p.micOn ? 'mic' : 'micOff'}
            size={14}
            className={p.micOn ? 'text-ink-tertiary' : 'text-ink-tertiary opacity-50'}
          />
        </div>
      ))}
    </div>
  )
}
