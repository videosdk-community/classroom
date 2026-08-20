import type { HTMLAttributes, MouseEvent, ReactNode } from 'react'
import { cn } from './cn'

/* Rebuilt from components/data/Chip.jsx. 26px tall, pill, 12/16 type.

   Note the surface it sits on. Unselected, a Chip is `--surface-card` with a
   hairline. In dark, --bg-muted, --surface-card and --surface-overlay are all
   #1B1B1E, so a chip on a card reads only because of that hairline. If you
   need a chip to read as a filled well instead, use bg-inset - it is the only
   neutral fill that separates from a card in BOTH themes. */

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  selected?: boolean
  iconLeft?: ReactNode
  disabled?: boolean
  onRemove?: (e: MouseEvent) => void
}

export function Chip({
  children,
  selected = false,
  onRemove,
  iconLeft,
  disabled = false,
  onClick,
  className,
  ...rest
}: ChipProps) {
  const interactive = Boolean(onClick) && !disabled

  return (
    <span
      onClick={disabled ? undefined : onClick}
      className={cn(
        'inline-flex h-[26px] items-center gap-[5px] rounded-pill px-2',
        'text-sm leading-4 font-medium',
        'transition-[background] duration-[120ms] ease-standard',
        selected
          ? 'bg-accent-tint text-[var(--primary-900)]'
          : 'bg-card text-ink-secondary shadow-hairline',
        !selected && interactive && 'hover:bg-muted',
        disabled ? 'cursor-not-allowed opacity-50' : interactive ? 'cursor-pointer' : 'cursor-default',
        className,
      )}
      {...rest}
    >
      {iconLeft ? <span className="inline-flex size-3.5 shrink-0">{iconLeft}</span> : null}
      {children}
      {onRemove ? (
        <button
          type="button"
          aria-label="Remove"
          onClick={(e) => {
            e.stopPropagation()
            onRemove(e)
          }}
          className="-mr-0.5 inline-flex cursor-pointer border-0 bg-transparent p-0 text-current opacity-60"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      ) : null}
    </span>
  )
}
