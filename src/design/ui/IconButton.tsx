import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

/* Rebuilt from components/buttons/IconButton.jsx. Square, icon-only.
   Note the variant set differs from Button's: IconButton has `ghost` and no
   `text`/`link`/`destructive-outline`. Kept exactly as source names them. */

export type IconButtonVariant = 'primary' | 'secondary' | 'outlined' | 'ghost' | 'destructive'
export type IconButtonSize = 'sm' | 'md' | 'lg'

const SIZES: Record<IconButtonSize, string> = {
  sm: 'size-6 rounded-md',
  md: 'size-8 rounded-md',
  lg: 'size-10 rounded-lg',
}

const ICON_PX: Record<IconButtonSize, number> = { sm: 16, md: 18, lg: 20 }

const VARIANTS: Record<IconButtonVariant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-[var(--primary-100)]',
  secondary: 'bg-raised text-ink shadow-hairline hover:bg-muted',
  outlined: 'bg-transparent text-ink shadow-hairline hover:bg-muted',
  ghost: 'bg-transparent text-ink-secondary hover:bg-muted',
  destructive: 'bg-transparent text-danger-solid hover:bg-[var(--red-100)]',
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant
  size?: IconButtonSize
  /** Required - the control has no text to name it. */
  'aria-label': string
  children?: ReactNode
}

export function IconButton({
  children,
  variant = 'ghost',
  size = 'md',
  className,
  ...rest
}: IconButtonProps) {
  const icon = ICON_PX[size]
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center border-0',
        'transition-[background] duration-[120ms] ease-standard',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45',
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      <span aria-hidden="true" className="inline-flex" style={{ width: icon, height: icon }}>
        {children}
      </span>
    </button>
  )
}
