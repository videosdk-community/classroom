import type { HTMLAttributes } from 'react'
import { cn } from './cn'

/* Rebuilt from components/feedback/Badge.jsx. 20px tall, 8px side padding,
   5px gap, 12/16 type. Status tones are for status only, never decoration. */

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'danger' | 'warning' | 'info'

const FILLED: Record<BadgeTone, string> = {
  neutral: 'bg-muted text-ink-secondary',
  primary: 'bg-[var(--primary-100)] text-[var(--primary-800)]',
  success: 'bg-success-bg text-success-fg',
  danger: 'bg-danger-bg text-danger-fg',
  warning: 'bg-warning-bg text-warning-fg',
  info: 'bg-info-bg text-info-fg',
}

/* One deliberate divergence from source, in `primary` only.

   Every other tone draws its text from a --*-fg alias, and those aliases flip
   between light and dark. `primary` alone uses fixed ramp literals, so source's
   outline-primary is --primary-800 (#37265E) on a near-black page in dark -
   about 1.3:1, which is what it looks like: unreadable.

   Light is left byte-identical to source; dark gets the brand tint instead, so
   the tone follows the theme the way its five siblings already do. The prop and
   tone names are untouched, so nothing pasted from the skill breaks. */
const OUTLINE: Record<BadgeTone, string> = {
  neutral: 'bg-transparent text-ink-secondary shadow-[inset_0_0_0_1px_var(--border-default)]',
  primary:
    'bg-transparent text-[var(--primary-800)] dark:text-accent-tint shadow-[inset_0_0_0_1px_var(--primary-200)]',
  success: 'bg-transparent text-success-fg shadow-[inset_0_0_0_1px_var(--success-border)]',
  danger: 'bg-transparent text-danger-fg shadow-[inset_0_0_0_1px_var(--danger-border)]',
  warning: 'bg-transparent text-warning-fg shadow-[inset_0_0_0_1px_var(--warning-border)]',
  info: 'bg-transparent text-info-fg shadow-[inset_0_0_0_1px_var(--info-border)]',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  outline?: boolean
  rounded?: boolean
  dot?: boolean
}

export function Badge({
  children,
  tone = 'neutral',
  outline = false,
  rounded = true,
  dot = false,
  className,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-[5px] px-2 text-sm leading-4 font-medium whitespace-nowrap',
        rounded ? 'rounded-pill' : 'rounded-xs',
        outline ? OUTLINE[tone] : FILLED[tone],
        className,
      )}
      {...rest}
    >
      {dot ? <span className="size-1.5 shrink-0 rounded-full bg-current" /> : null}
      {children}
    </span>
  )
}
