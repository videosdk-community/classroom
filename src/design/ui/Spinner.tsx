import type { HTMLAttributes } from 'react'
import { cn } from './cn'

/* Rebuilt from components/feedback/Spinner.jsx. Lavender accent arc over a
   faint track. The keyframes live in index.css rather than an inline <style>
   tag per instance, which is the one deliberate change from source. */

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  size?: number
  color?: string
  thickness?: number
}

export function Spinner({
  size = 20,
  color = 'var(--primary-button)',
  thickness = 2.5,
  className,
  ...rest
}: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn('inline-block', className)}
      style={{ width: size, height: size }}
      {...rest}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className="block animate-[vsdk-spin_0.7s_linear_infinite]"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeWidth={thickness}
          className="text-line opacity-40"
        />
        <path d="M21 12a9 9 0 0 0-9-9" stroke={color} strokeWidth={thickness} strokeLinecap="round" />
      </svg>
    </span>
  )
}
