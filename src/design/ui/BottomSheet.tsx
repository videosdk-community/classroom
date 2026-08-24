import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { cn } from './cn'

/* A phone-only bottom sheet. Backs both the control bar's "More" overflow and
   the Chat/Participants surfaces on phone - one primitive, different
   children, rather than two ad hoc absolutely-positioned panels.

   No component library backs this (none exists in the repo) and no portal:
   every other overlay here (LeavePrompt, MediaRequestPrompt) renders fixed in
   place rather than through a portal, so this follows the same precedent.

   max-height is 85dvh rather than 85vh - dvh tracks the visible viewport as
   mobile browser chrome shows and hides, vh does not, and a sheet sized off
   vh clips itself under an address bar that just appeared. */

export interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  'aria-label'?: string
}

export function BottomSheet({ open, onClose, title, children, ...rest }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const el = sheetRef.current
    el?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !el) return
      const focusable = el.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const ariaLabel = rest['aria-label']

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        data-testid="sheet-scrim"
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ? undefined : ariaLabel}
        aria-labelledby={title ? 'bottom-sheet-title' : undefined}
        tabIndex={-1}
        className={cn(
          'vsdk-sheet-slide-in absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-2xl border-t border-line-strong bg-card',
        )}
        style={{
          maxHeight: '85dvh',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
          boxShadow: 'var(--elevation-popover)',
        }}
      >
        <div className="flex shrink-0 justify-center pb-1 pt-2">
          <span aria-hidden="true" className="h-1 w-9 rounded-pill bg-line-strong" />
        </div>

        {title && (
          <div className="flex h-11 shrink-0 items-center border-b border-line px-4">
            <span id="bottom-sheet-title" className="text-base font-semibold text-ink">
              {title}
            </span>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
