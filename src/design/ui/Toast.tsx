import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from './cn'
import { ToastContext } from './toastContext'
import type { ToastItem, ToastTone } from './toastContext'

/* Transient notifications for the room. Deliberately not a general toast
   library: no queue limits, no positioning API, no promise integration. The
   provider owns the state and renders the stack itself so a screen only has to
   mount it once and then call show() from anywhere below it. */

export interface ToastProviderProps {
  children?: ReactNode
}

const TONES: Record<ToastTone, { bg: string; fg: string; bd: string }> = {
  info: { bg: 'var(--info-bg)', fg: 'var(--info-fg)', bd: 'var(--info-border)' },
  success: { bg: 'var(--success-bg)', fg: 'var(--success-fg)', bd: 'var(--success-border)' },
  warning: { bg: 'var(--warning-bg)', fg: 'var(--warning-fg)', bd: 'var(--warning-border)' },
  danger: { bg: 'var(--danger-bg)', fg: 'var(--danger-fg)', bd: 'var(--danger-border)' },
  neutral: { bg: 'var(--bg-muted)', fg: 'var(--text-secondary)', bd: 'var(--border-default)' },
}

const DISMISS_MS = 4000

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  /* A ref counter rather than Math.random() or Date.now(): those would produce
     a fresh value on every render and two toasts fired in the same millisecond
     could collide on a key. */
  const nextId = useRef(0)

  /* Timers are tracked so unmounting mid-flight does not leave a setState
     scheduled against a dead component. */
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  /* One at a time, newest wins, rather than a growing stack.

     Partly restraint and partly geometry. The room fires these one action at a
     time, so a stack is machinery for a case that does not arise - and when it
     did arise in testing, the second card grew upwards past the board's bottom
     edge and straddled it, which is the exact look the single position below
     was chosen to avoid. Replacing keeps every toast in the one spot that was
     measured to be clear. */
  const show = useCallback(
    (message: string, tone: ToastTone = 'neutral') => {
      const id = nextId.current++
      setToasts([{ id, message, tone }])
      timers.current.push(setTimeout(() => dismiss(id), DISMISS_MS))
    },
    [dismiss],
  )

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
  }, [])

  /* show() is stable, so memoising keeps consumers from re-rendering every time
     a toast appears or expires. */
  const value = useMemo(() => show, [show])

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* pointer-events-none on the container and auto on each card: the stack
          floats over the room, so anything not actually a toast must stay
          click-through. role/aria-live announce without stealing focus. */}
      {/* Bottom CENTRE, stacked clear of both bars.

          Two pieces of furniture own the bottom of this screen. The control bar
          is a 64px row pinned to the viewport bottom; the hosted whiteboard puts
          its draw tools in a centred pill along the board's own bottom edge,
          measured at 56px tall, and the board sits 24px above the control bar
          (the p-6 stage padding). Sitting the toast "just above the control bar"
          literally would drop it straight onto the pen and the eraser for four
          seconds, right after the teacher pressed a button.

          So the offset is that stack added up - 64 control bar + 24 padding + 56
          toolbar + 12 breathing room - which puts the card centred, wholly on the
          board, directly above the tools instead of over them. Below 800px of
          board width the hosted toolbar wraps to 104px and will reach the card;
          that is the narrow-board tradeoff, not an oversight. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2"
        style={{ bottom: 156 }}
      >
        {toasts.map((t) => {
          const tone = TONES[t.tone]
          return (
            <div
              key={t.id}
              className={cn('pointer-events-auto flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-base leading-5')}
              /* The tone backgrounds are translucent by design - dark theme
                 mixes them at 25% alpha against the app's near-black chrome.
                 The card now floats over the WHITE whiteboard, where that alpha
                 blends toward white instead and leaves a washed pastel behind
                 light tone text. Painting the tone layer over an opaque surface
                 gives the same colour the tokens intend, on any backdrop. */
              style={{
                background: `linear-gradient(0deg, ${tone.bg}, ${tone.bg}), var(--surface-overlay)`,
                boxShadow: `inset 0 0 0 1px ${tone.bd}, 0 8px 24px rgba(0,0,0,0.45)`,
                color: tone.fg,
              }}
            >
              <span className="min-w-0">{t.message}</span>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => dismiss(t.id)}
                className="shrink-0 cursor-pointer border-0 bg-transparent p-0 text-current opacity-70"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
