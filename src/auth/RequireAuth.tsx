import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Spinner } from '../design/ui'
import { useAuth } from './context'

/* Guards a route, remembering where the visitor was going.

   The `next` round trip is load-bearing for join-by-link: a student who
   clicks /c/abc-def while signed out must come back to /c/abc-def after the
   email, not to Home. */

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center bg-canvas">
        <Spinner />
      </div>
    )
  }

  if (status === 'signedOut') {
    const next = `${location.pathname}${location.search}`
    return <Navigate to={`/signin?next=${encodeURIComponent(next)}`} replace />
  }

  return <>{children}</>
}
