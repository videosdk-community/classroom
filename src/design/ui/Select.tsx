import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import { cn } from './cn'

/* Rebuilt from components/forms/Select.jsx + Select.d.ts. A popover dropdown
   rather than a native <select>, so it can be styled consistently in dark.

   Source reaches for var(--font-sans) and var(--shadow-popover); both names
   are re-emitted by @theme here, so they are replaced with the mapped
   utilities and --elevation-popover respectively. */

export interface SelectOption {
  label: string
  value: string
}

export type SelectSize = 'sm' | 'md' | 'lg'

export interface SelectProps {
  value?: string
  defaultValue?: string
  options: (SelectOption | string)[]
  placeholder?: string
  size?: SelectSize
  disabled?: boolean
  error?: boolean
  onChange?: (value: string, e: MouseEvent) => void
  style?: CSSProperties
  className?: string
}

const HEIGHTS: Record<SelectSize, string> = { sm: 'h-7', md: 'h-8', lg: 'h-10' }

export function Select({
  value,
  defaultValue,
  options = [],
  placeholder = 'Select...',
  size = 'md',
  disabled = false,
  error = false,
  onChange,
  style,
  className,
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const isControlled = value !== undefined
  const [internal, setInternal] = useState(defaultValue)
  const current = isControlled ? value : internal
  const ref = useRef<HTMLDivElement>(null)

  const norm: SelectOption[] = options.map((o) => (typeof o === 'string' ? { label: o, value: o } : o))
  const selected = norm.find((o) => o.value === current)

  useEffect(() => {
    const onDoc = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const ring = error
    ? 'inset 0 0 0 1px var(--red-500)'
    : open
      ? 'inset 0 0 0 1.5px var(--focus-ring)'
      : 'inset 0 0 0 1px var(--border-default)'

  const pick = (o: SelectOption, e: MouseEvent) => {
    if (!isControlled) setInternal(o.value)
    onChange?.(o.value, e)
    setOpen(false)
  }

  return (
    <div ref={ref} className={cn('relative min-w-[180px]', className)} style={style}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between gap-1.5 rounded-lg border-0 px-2.5 text-base',
          HEIGHTS[size],
          disabled ? 'cursor-not-allowed bg-muted opacity-60' : 'cursor-pointer bg-card',
          selected ? 'text-ink' : 'text-ink-tertiary',
        )}
        style={{ boxShadow: ring }}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-tertiary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn('shrink-0 transition-transform duration-[120ms]', open && 'rotate-180')}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-60 overflow-y-auto rounded-lg border border-hairline p-1"
          style={{ background: 'var(--surface-overlay)', boxShadow: 'var(--elevation-popover)' }}
        >
          {norm.map((o) => {
            const active = o.value === current
            return (
              <button
                key={o.value}
                type="button"
                onClick={(e) => pick(o, e)}
                className={cn(
                  'flex w-full cursor-pointer items-center justify-between rounded-md border-0 px-2 py-1.5 text-left text-base text-ink',
                  active ? 'bg-muted' : 'bg-transparent hover:bg-muted',
                )}
              >
                <span className="truncate">{o.label}</span>
                {active ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
