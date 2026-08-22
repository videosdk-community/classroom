import { useEffect } from 'react'
import { Button } from '../design/ui'

/* "Leave the class?" - shown when a Back gesture is caught, never from the
   Leave button, which is deliberate enough on its own.

   A dimmed full-screen layer rather than a pill, because the swipe that opened
   it was an accident and the answer has to be unmissable. Focus lands on Stay:
   the person did not mean to go anywhere, so Enter should return them to the
   class. */

export interface LeavePromptProps {
  isTeacher: boolean
  onStay: () => void
  onLeave: () => void
}

export function LeavePrompt({ isTeacher, onStay, onLeave }: LeavePromptProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onStay()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onStay])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-prompt-title"
    >
      <div
        className="w-[380px] max-w-full rounded-xl border border-line-strong bg-card p-5"
        style={{ boxShadow: 'var(--elevation-popover)' }}
      >
        <h2 id="leave-prompt-title" className="text-lg font-semibold text-ink-primary">
          Leave the class?
        </h2>
        <p className="mt-1.5 text-base text-ink-secondary">
          {isTeacher
            ? 'You went back. Leaving ends the class for everyone.'
            : 'You went back. The class is still running without you.'}
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <Button autoFocus variant="secondary" onClick={onStay}>
            Stay
          </Button>
          <Button variant="destructive" onClick={onLeave}>
            {isTeacher ? 'End the class' : 'Leave'}
          </Button>
        </div>
      </div>
    </div>
  )
}
