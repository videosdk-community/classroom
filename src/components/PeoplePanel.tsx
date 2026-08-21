import type { ReactNode } from 'react'
import { KnockRow } from './KnockRow'
import { RoomIcon } from './icons'
import type { Person } from '../domain/classroom'
import type { EntryRequest } from '../sdk'

/* The roster. Also where the rail's overflow lands, so it is the answer to
   "a rail is not a plan for forty students" rather than a secondary surface. */

export interface PeoplePanelProps {
  people: Person[]
  selfId: string
  /** Server-derived. Teacher rows carry the moderation actions; a student's
      roster is a list. The buttons are hidden rather than gated, because
      allow_mod is what actually decides and a disabled button that would
      never work is worse than no button. */
  isTeacher: boolean
  onMute: (id: string) => void
  onAskToUnmute: (id: string) => void
  onLowerHand: (id: string) => void
  /** Lecture only. In Class everyone is onstage already, so there is nothing
      to promote anyone to. */
  canPromote: boolean
  onPromote: (id: string) => void
  onDemote: (id: string) => void
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

function RowAction({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="h-6 shrink-0 cursor-pointer rounded-md border border-line-strong bg-transparent px-1.5 text-sm text-ink-secondary hover:bg-inset"
    >
      {children}
    </button>
  )
}

export function PeoplePanel({
  people,
  selfId,
  isTeacher,
  onMute,
  onAskToUnmute,
  onLowerHand,
  canPromote,
  onPromote,
  onDemote,
  waiting,
  onRespond,
}: PeoplePanelProps) {
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
        <div key={p.id} className="group flex items-center gap-2.5 px-3 py-2 hover:bg-raised">
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

          {isTeacher && p.id !== selfId ? (
            /* hidden rather than opacity-0: an invisible row of buttons still
               takes its width, and in a 320px panel that truncated every name
               to three characters whether or not anyone was hovering. */
            <div className="hidden items-center gap-1 group-hover:flex group-focus-within:flex">
              {p.handRaised && (
                <RowAction label="Lower hand" onClick={() => onLowerHand(p.id)}>
                  Lower
                </RowAction>
              )}
              {/* Asymmetric, and the copy says so. disableMic lands with no
                  consent; enableMic only asks and fires onMicRequested on the
                  target, who decides. There is no force-unmute in the SDK and
                  this app does not pretend there is. */}
              {canPromote && p.role !== 'teacher' && (
                /* Both directions are layout. Promote also asks the student
                   to unmute; demote takes the tile back and cannot take the
                   microphone with it. */
                p.onstage ? (
                  <RowAction label={`Take ${p.name} off the stage`} onClick={() => onDemote(p.id)}>
                    Off stage
                  </RowAction>
                ) : (
                  <RowAction label={`Put ${p.name} on the stage`} onClick={() => onPromote(p.id)}>
                    Onstage
                  </RowAction>
                )
              )}
              {p.micOn ? (
                <RowAction label={`Mute ${p.name}`} onClick={() => onMute(p.id)}>
                  Mute
                </RowAction>
              ) : (
                <RowAction label={`Ask ${p.name} to unmute`} onClick={() => onAskToUnmute(p.id)}>
                  Ask to unmute
                </RowAction>
              )}
            </div>
          ) : null}

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
