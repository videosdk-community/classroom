import type { ReactNode } from 'react'
import { cn } from '../design/ui'

/* A control-bar button.

   `text` renders the word beside the glyph. Use it wherever the glyph alone
   is a guess - a cold student read the whiteboard and mute-everyone icons as
   a screen-share pair, and could not identify the leave button at all.

   `off` is self-mute / camera-off: red fill, the one convention every
   conferencing app shares, so "am I muted" is answerable at a glance rather
   than by hunting for a diagonal line through a glyph. */

export interface CtrlBtnProps {
  children: ReactNode
  label: string
  text?: string
  danger?: boolean
  active?: boolean
  off?: boolean
  disabled?: boolean
  onClick?: () => void
}

export function CtrlBtn({
  children,
  label,
  text,
  danger,
  active,
  off,
  disabled,
  onClick,
}: CtrlBtnProps) {
  const style =
    off || danger
      ? { background: 'var(--red-600)', color: '#fff' }
      : active
        ? { background: 'var(--primary-button)', color: 'var(--on-primary)' }
        : { background: 'var(--surface-raised)', color: 'var(--text-secondary)' }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={off !== undefined ? off : active}
      className={cn(
        'flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border-0',
        'transition-colors duration-[120ms] ease-standard',
        text ? 'px-3' : 'w-10',
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
      )}
      style={style}
    >
      {children}
      {text && <span className="text-base font-medium">{text}</span>}
    </button>
  )
}
