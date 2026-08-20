import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

/* Rebuilt from components/feedback/Alert.jsx + Alert.d.ts. Inline banner,
   optional title and dismiss. Source's var(--font-sans) is dropped: the
   element inherits the body font, and that name is re-emitted by @theme here
   so referencing it directly would resolve to nothing. */

export type AlertTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral'

/* Omit<..., 'title'> because the source .d.ts declares `title?: ReactNode`
   while the DOM's HTMLAttributes declares `title?: string`, and the two cannot
   both be true. The source ships as .jsx so the conflict never surfaced there.
   The prop name stays `title`, identical to source; only the DOM's version of
   it is dropped. */
export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: AlertTone
  title?: ReactNode
  icon?: boolean
  onDismiss?: () => void
}

const TONES: Record<AlertTone, { bg: string; fg: string; bd: string }> = {
  info: { bg: 'var(--info-bg)', fg: 'var(--info-fg)', bd: 'var(--info-border)' },
  success: { bg: 'var(--success-bg)', fg: 'var(--success-fg)', bd: 'var(--success-border)' },
  warning: { bg: 'var(--warning-bg)', fg: 'var(--warning-fg)', bd: 'var(--warning-border)' },
  danger: { bg: 'var(--danger-bg)', fg: 'var(--danger-fg)', bd: 'var(--danger-border)' },
  neutral: { bg: 'var(--bg-muted)', fg: 'var(--text-secondary)', bd: 'var(--border-default)' },
}

const ICONS: Record<AlertTone, string> = {
  info: 'M12 16v-4M12 8h.01',
  success: 'M20 6 9 17l-5-5',
  warning: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  danger: 'M18 6 6 18M6 6l12 12',
  neutral: 'M12 16v-4M12 8h.01',
}

export function Alert({
  children,
  title,
  tone = 'info',
  onDismiss,
  icon = true,
  className,
  style,
  ...rest
}: AlertProps) {
  const t = TONES[tone]

  return (
    <div
      role="alert"
      className={cn('flex gap-2.5 rounded-lg px-3.5 py-3', className)}
      style={{ background: t.bg, boxShadow: `inset 0 0 0 1px ${t.bd}`, color: t.fg, ...style }}
      {...rest}
    >
      {icon ? (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-px shrink-0"
        >
          {tone === 'info' || tone === 'neutral' ? <circle cx="12" cy="12" r="10" /> : null}
          <path d={ICONS[tone]} />
        </svg>
      ) : null}

      <div className="min-w-0 flex-1">
        {title ? (
          <div className={cn('text-base font-semibold leading-5', children ? 'mb-0.5' : undefined)}>{title}</div>
        ) : null}
        {children ? (
          <div className="text-base leading-5" style={{ color: 'var(--text-secondary)' }}>
            {children}
          </div>
        ) : null}
      </div>

      {onDismiss ? (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="shrink-0 cursor-pointer border-0 bg-transparent p-0 text-current opacity-70"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      ) : null}
    </div>
  )
}
