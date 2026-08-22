import { Navigate, useSearchParams } from 'react-router-dom'
import { Alert, Button, Spinner } from '../design/ui'
import { useAuth } from '../auth/context'

/* Where the magic link lands, and where a guest's email confirmation lands.

   The client is configured with detectSessionInUrl, so by the time this
   renders supabase-js is already exchanging the code in the URL for a
   session; AuthProvider reports it through onAuthStateChange. All this screen
   does is wait, then send the visitor where they were originally going.

   It exists as a real route rather than being folded into Home so that the
   code never reaches a screen that reads the query string for its own
   purposes, and so that navigating away with `replace` keeps it out of
   history. */

function safeNext(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
}

export function AuthCallback() {
  const { status, user } = useAuth()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))

  /* A guest confirming an email address is ALREADY signed in when they land
     here, so `signedIn` is true from the first render and the redirect below
     would fire before the confirmation is applied. `confirm=email` says to
     wait for the thing that actually changed instead: is_anonymous going
     false. SaveAccount is what puts the marker on the redirect URL. */
  const confirmingEmail = params.get('confirm') === 'email'
  const settled = confirmingEmail ? user?.is_anonymous === false : status === 'signedIn'

  /* Supabase reports a failed exchange in the URL rather than by throwing. */
  const failure = params.get('error_description') ?? params.get('error')

  if (failure) {
    return (
      <div className="flex h-full items-center justify-center bg-canvas p-6">
        <div className="flex w-full max-w-[420px] flex-col gap-4">
          <Alert tone="danger" title="That link did not work">
            {failure}. Links expire, and they only complete in the browser that asked for them.
          </Alert>
          <Button size="lg" onClick={() => (window.location.href = '/signin')}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  if (settled) return <Navigate to={next} replace />

  /* Not settled yet means the exchange has not finished, not that it failed -
     the failure path above is the one that reports a real problem. */
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-canvas">
      <Spinner />
      <span className="text-base text-ink-secondary">
        {confirmingEmail ? 'Confirming your email' : 'Signing you in'}
      </span>
    </div>
  )
}
