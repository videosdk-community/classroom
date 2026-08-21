import { useState } from 'react'
import type { EntryRequest } from '../sdk'

/* One waiting student, with the two buttons that answer them.

   Shared by the floating card and the People panel so a knock reads the same
   wherever the teacher happens to be looking, and so "admit" is one code path
   rather than two that can drift.

   Neither button ever touches a closure. allow/deny arrive as closures on the
   event and live in the seam's non-reactive map; everything here addresses a
   student by id and lets the seam decide how to answer. */

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export interface KnockRowProps {
  request: EntryRequest
  onRespond: (id: string, allow: boolean) => void
}

export function KnockRow({ request, onRespond }: KnockRowProps) {
  /* Optimistic locally too. The row disappears when the seam removes it, but
     a decision is a round trip and a teacher who sees no feedback clicks
     again - which is exactly how a student gets admitted and then denied. */
  const [answering, setAnswering] = useState(false)

  const respond = (allow: boolean) => {
    setAnswering(true)
    onRespond(request.participantId, allow)
  }

  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      <div
        className="flex size-7 shrink-0 items-center justify-center rounded-[50%] text-sm font-semibold"
        style={{ background: 'var(--primary-200)', color: 'var(--primary-900)' }}
      >
        {initials(request.name || '?')}
      </div>
      <span className="min-w-0 flex-1 truncate text-base text-ink-secondary">
        {request.name || 'Someone'}
      </span>

      <button
        type="button"
        disabled={answering}
        onClick={() => respond(false)}
        className="h-7 cursor-pointer rounded-lg border border-line-strong bg-transparent px-2.5 text-sm text-ink-secondary hover:bg-raised disabled:cursor-default disabled:opacity-50"
      >
        Deny
      </button>
      <button
        type="button"
        disabled={answering}
        onClick={() => respond(true)}
        className="h-7 cursor-pointer rounded-lg border-0 px-2.5 text-sm font-medium disabled:cursor-default disabled:opacity-50"
        style={{ background: 'var(--primary-500)', color: 'var(--primary-on)' }}
      >
        Admit
      </button>
    </div>
  )
}
