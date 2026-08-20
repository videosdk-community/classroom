import { Children, cloneElement, isValidElement } from 'react'
import type { HTMLAttributes, ReactElement, ReactNode } from 'react'
import { cn } from './cn'

/* Rebuilt from components/data/Avatar.jsx. Sizes and the 0.4 font ratio,
   0.28 dot ratio and -0.3 group overlap are all transcribed from source. */

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number
export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline'

const SIZES = { xs: 20, sm: 24, md: 32, lg: 40, xl: 56 } as const

const STATUS_COLOR: Record<PresenceStatus, string> = {
  online: 'var(--green-500)',
  away: 'var(--amber-500)',
  busy: 'var(--red-500)',
  offline: 'var(--neutral-400)',
}

function px(size: AvatarSize): number {
  return typeof size === 'number' ? size : SIZES[size]
}

function initials(name = ''): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  name?: string
  src?: string
  size?: AvatarSize
  status?: PresenceStatus
  square?: boolean
}

export function Avatar({
  name,
  src,
  size = 'md',
  status,
  square = false,
  className,
  ...rest
}: AvatarProps) {
  const s = px(size)
  const dot = Math.max(8, s * 0.28)

  return (
    <span className={cn('relative inline-flex shrink-0', className)} {...rest}>
      <span
        className={cn(
          'inline-flex items-center justify-center overflow-hidden font-semibold leading-none',
          'bg-accent-tint text-[var(--primary-900)] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]',
          square ? 'rounded-md' : 'rounded-full',
        )}
        style={{ width: s, height: s, fontSize: Math.round(s * 0.4) }}
      >
        {src ? (
          <img src={src} alt={name ?? ''} className="size-full object-cover" />
        ) : (
          initials(name)
        )}
      </span>
      {status ? (
        <span
          className="absolute -right-px -bottom-px rounded-full shadow-[0_0_0_2px_var(--surface-card)]"
          style={{ width: dot, height: dot, background: STATUS_COLOR[status] }}
        />
      ) : null}
    </span>
  )
}

export interface AvatarGroupProps {
  max?: number
  size?: AvatarSize
  children: ReactNode
}

/** Overlapping stack with a +N overflow disc. The rail's "+N" chip in step 3. */
export function AvatarGroup({ children, max, size = 'md' }: AvatarGroupProps) {
  const items = Children.toArray(children).filter(isValidElement) as ReactElement<AvatarProps>[]
  const shown = max ? items.slice(0, max) : items
  const overflow = max ? items.length - max : 0
  const s = px(size)

  return (
    <span className="inline-flex items-center">
      {shown.map((child, i) => (
        <span
          key={i}
          className="inline-flex rounded-full shadow-[0_0_0_2px_var(--surface-card)]"
          style={{ marginLeft: i === 0 ? 0 : -s * 0.3 }}
        >
          {cloneElement(child, { size })}
        </span>
      ))}
      {overflow > 0 ? (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full font-medium',
            'bg-muted text-ink-secondary shadow-[0_0_0_2px_var(--surface-card)]',
          )}
          style={{ marginLeft: -s * 0.3, width: s, height: s, fontSize: Math.round(s * 0.34) }}
        >
          +{overflow}
        </span>
      ) : null}
    </span>
  )
}
