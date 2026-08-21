import { createContext, useContext } from 'react'

/* The context and its hook live apart from the provider that renders them.

   Not a preference: Fast Refresh only re-runs a module whose exports are all
   components, so keeping useToast in Toast.tsx costs the whole room its hot
   reload - every edit to a toast would remount the meeting and drop the
   connection. The lint rule that says so is the one worth listening to. */

/* Same union as AlertTone, and the same token set in Toast.tsx, so a toast and
   an inline Alert of the same tone read as the same thing. */
export type ToastTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral'

export interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

export type ShowToast = (message: string, tone?: ToastTone) => void

export const ToastContext = createContext<ShowToast | null>(null)

export function useToast(): ShowToast {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside a <ToastProvider>.')
  return ctx
}
