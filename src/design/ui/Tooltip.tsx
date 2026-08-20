import { useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from './cn'

/* Rebuilt from components/feedback/Tooltip.jsx. Dark bubble with a rotated
   square arrow, shown on hover AND focus so it is reachable by keyboard. */

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right'

const BUBBLE: Record<TooltipPlacement, string> = {
  top: 'bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2',
  bottom: 'top-[calc(100%+8px)] left-1/2 -translate-x-1/2',
  left: 'right-[calc(100%+8px)] top-1/2 -translate-y-1/2',
  right: 'left-[calc(100%+8px)] top-1/2 -translate-y-1/2',
}

const ARROW: Record<TooltipPlacement, string> = {
  top: 'top-full left-1/2 -translate-x-1/2 rotate-45',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 rotate-45',
  left: 'left-full top-1/2 -translate-y-1/2 rotate-45',
  right: 'right-full top-1/2 -translate-y-1/2 rotate-45',
}

export interface TooltipProps {
  label: ReactNode
  placement?: TooltipPlacement
  children: ReactNode
}

export function Tooltip({ children, label, placement = 'top' }: TooltipProps) {
  const [show, setShow] = useState(false)

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show ? (
        <span
          role="tooltip"
          className={cn(
            'pointer-events-none absolute z-100 rounded-md px-[9px] py-[5px]',
            'bg-[var(--neutral-900)] text-[var(--neutral-0)]',
            'border border-hairline shadow-popover',
            'text-sm leading-4 whitespace-nowrap',
            BUBBLE[placement],
          )}
        >
          {label}
          <span
            className={cn(
              'absolute size-2 border-r border-b border-hairline bg-[var(--neutral-900)]',
              ARROW[placement],
            )}
          />
        </span>
      ) : null}
    </span>
  )
}
