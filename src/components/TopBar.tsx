import { RoomIcon } from './icons'
import type { ClassMode } from '../fixtures/classroom'

/* The 56px top bar: what class this is, what shape it is, and whether it is
   being recorded. */

export interface TopBarProps {
  title: string
  mode: ClassMode
  recording: boolean
  elapsed: string
}

export function TopBar({ title, mode, recording, elapsed }: TopBarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4">
      <span className="text-base font-semibold text-ink">{title}</span>
      <span className="rounded-md bg-inset px-2 py-0.5 text-xs uppercase tracking-wide text-ink-tertiary">
        {mode}
      </span>

      {/* Not optional, and not a nicety. A cold student named the absence of a
          recording indicator as the thing that would stop them unmuting or
          turning a camera on, and the recording genuinely does capture the
          board, the ink and live cursors with name tags. So everyone sees it,
          teacher and student alike. */}
      {recording && (
        <span
          className="flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-xs font-semibold uppercase tracking-wide"
          style={{ background: 'var(--danger-bg)', color: 'var(--danger-fg)' }}
        >
          <RoomIcon name="record" size={11} />
          Recording
        </span>
      )}

      <span className="ml-auto flex items-center gap-2 text-sm text-ink-tertiary">
        <RoomIcon name="signal" size={15} />
        {elapsed}
      </span>
    </header>
  )
}
