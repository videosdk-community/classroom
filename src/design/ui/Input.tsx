import { useState } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

/* Rebuilt from components/forms/Input.jsx + Input.d.ts. Single-line field,
   32px tall at md, hairline border, lavender focus ring.

   Source declares its font as var(--font-sans) and its size as
   var(--text-base). Both of those names were re-emitted by @theme at vendor
   time, so referencing them directly here would be self-referential and
   resolve to nothing - it presents as "the webfont didn't load", not as a
   config bug. The Tailwind utilities below go through the mapping instead. */

export type InputSize = 'sm' | 'md' | 'lg'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: InputSize
  iconLeft?: ReactNode
  iconRight?: ReactNode
  error?: boolean
}

const HEIGHTS: Record<InputSize, string> = {
  sm: 'h-7',
  md: 'h-8',
  lg: 'h-10',
}

export function Input({
  size = 'md',
  iconLeft,
  iconRight,
  error = false,
  disabled = false,
  className,
  ...rest
}: InputProps) {
  const [focus, setFocus] = useState(false)

  /* The ring is an inset box-shadow, not a border, so it never shifts layout
     when it thickens on focus. Error outranks focus, deliberately. */
  const ring = error
    ? 'inset 0 0 0 1px var(--red-500)'
    : focus
      ? 'inset 0 0 0 1.5px var(--focus-ring)'
      : 'inset 0 0 0 1px var(--border-default)'

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-2.5',
        'transition-[box-shadow] duration-[120ms] ease-standard',
        HEIGHTS[size],
        disabled ? 'bg-muted opacity-60' : 'bg-card',
        className,
      )}
      style={{ boxShadow: ring }}
    >
      {iconLeft ? (
        <span className="inline-flex size-4 shrink-0 text-ink-tertiary">{iconLeft}</span>
      ) : null}
      <input
        disabled={disabled}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        className={cn(
          'min-w-0 flex-1 border-0 bg-transparent p-0 outline-none',
          'text-base text-ink placeholder:text-ink-tertiary',
          disabled && 'cursor-not-allowed',
        )}
        {...rest}
      />
      {iconRight ? (
        <span className="inline-flex size-4 shrink-0 text-ink-tertiary">{iconRight}</span>
      ) : null}
    </div>
  )
}
