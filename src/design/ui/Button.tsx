import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

/* Rebuilt on the Tailwind mapping from components/buttons/Button.jsx in the
   videosdk-design skill. Specs transcribed from source, not eyeballed.
   Prop and variant names are identical to source on purpose - all seven
   variants and all three sizes are kept even where this app uses four, so a
   snippet pasted out of the skill's ui_kits/ still compiles here. */

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outlined'
  | 'text'
  | 'link'
  | 'destructive'
  | 'destructive-outline'

export type ButtonSize = 'sm' | 'md' | 'lg'

// height / padding / type / gap, straight from SIZES in the source
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-6 gap-1 rounded-md px-2 py-1 text-sm leading-4',
  md: 'h-8 gap-1.5 rounded-md px-3 py-1.5 text-base leading-4',
  lg: 'h-10 gap-2 rounded-lg px-4 py-2.5 text-base leading-5',
}

const ICON_PX: Record<ButtonSize, number> = { sm: 14, md: 16, lg: 18 }

const VARIANTS: Record<ButtonVariant, string> = {
  // lavender fill, near-black ink, inset hairline instead of a border
  primary: 'bg-accent text-accent-fg shadow-hairline-filled hover:bg-[var(--primary-100)]',
  secondary: 'bg-raised text-ink shadow-hairline hover:bg-muted',
  outlined: 'bg-transparent text-ink shadow-hairline hover:bg-muted',
  text: 'bg-transparent text-ink hover:bg-muted',
  link: 'bg-transparent text-ink-link hover:underline',
  destructive: 'bg-danger-solid text-white hover:bg-danger-hover',
  'destructive-outline':
    'bg-transparent text-danger-solid shadow-[inset_0_0_0_1px_var(--red-200)] hover:bg-[var(--red-100)]',
}

const BASE =
  'select-none items-center justify-center whitespace-nowrap border-0 font-medium ' +
  'transition-[background,transform] duration-[120ms] ease-standard ' +
  'active:scale-[0.98] ' +
  'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  iconLeft?: ReactNode
  iconRight?: ReactNode
  fullWidth?: boolean
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  iconLeft,
  iconRight,
  fullWidth = false,
  type = 'button',
  className,
  ...rest
}: ButtonProps) {
  const icon = ICON_PX[size]
  // `link` drops the box entirely in source: no height, no padding.
  const isLink = variant === 'link'

  return (
    <button
      type={type}
      className={cn(
        BASE,
        fullWidth ? 'flex w-full' : 'inline-flex',
        isLink ? 'h-auto gap-1 p-0 text-base leading-5' : SIZES[size],
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {iconLeft ? (
        <span aria-hidden="true" className="shrink-0" style={{ width: icon, height: icon }}>
          {iconLeft}
        </span>
      ) : null}
      {children ? <span>{children}</span> : null}
      {iconRight ? (
        <span aria-hidden="true" className="shrink-0" style={{ width: icon, height: icon }}>
          {iconRight}
        </span>
      ) : null}
    </button>
  )
}
