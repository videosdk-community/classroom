import { useState } from 'react'
import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { cn } from './cn'

/* Rebuilt from components/forms/Toggle.jsx + Toggle.d.ts. On state fills
   with the lavender primary; the knob flips to --on-primary so the one
   accent stays a two-colour pair in both themes.

   Source reaches for var(--shadow-xs) on the knob. That name does not exist
   here - the vendored shadows were renamed to --elevation-* to escape the
   @theme self-reference, so --shadow-xs would resolve to nothing and the
   knob would sit flat on the track. Uses --elevation-xs. */

export type ToggleSize = 'sm' | 'md'

export interface ToggleProps {
  checked?: boolean
  defaultChecked?: boolean
  label?: ReactNode
  size?: ToggleSize
  disabled?: boolean
  onChange?: (checked: boolean, e: MouseEvent) => void
  style?: CSSProperties
  className?: string
}

const DIMS: Record<ToggleSize, { w: number; h: number; knob: number }> = {
  sm: { w: 32, h: 18, knob: 14 },
  md: { w: 40, h: 22, knob: 18 },
}

export function Toggle({
  checked,
  defaultChecked,
  label,
  size = 'md',
  disabled = false,
  onChange,
  style,
  className,
}: ToggleProps) {
  const isControlled = checked !== undefined
  const [internal, setInternal] = useState(defaultChecked || false)
  const on = isControlled ? checked : internal

  const dims = DIMS[size]

  const toggle = (e: MouseEvent) => {
    if (disabled) return
    if (!isControlled) setInternal(!internal)
    onChange?.(!on, e)
  }

  const track = (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={toggle}
      className={cn(
        'inline-flex shrink-0 items-center rounded-pill border-0 p-0.5',
        'transition-[background] duration-[180ms] ease-standard',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
      )}
      style={{
        width: dims.w,
        height: dims.h,
        background: on ? 'var(--primary-button)' : 'var(--border-strong)',
      }}
    >
      <span
        className="rounded-[50%] transition-transform duration-[180ms] ease-standard"
        style={{
          width: dims.knob,
          height: dims.knob,
          background: on ? 'var(--on-primary)' : 'var(--surface-card)',
          boxShadow: 'var(--elevation-xs)',
          transform: on ? `translateX(${dims.w - dims.knob - 4}px)` : 'translateX(0)',
        }}
      />
    </button>
  )

  if (!label) {
    return (
      <span className={cn('inline-flex', disabled && 'opacity-50', className)} style={style}>
        {track}
      </span>
    )
  }

  return (
    <label
      className={cn(
        'inline-flex items-center gap-2',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        className,
      )}
      style={style}
    >
      {track}
      <span className="text-base text-ink">{label}</span>
    </label>
  )
}
