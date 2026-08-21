import { Navigate, useSearchParams } from 'react-router-dom'
import { Alert, Button, Spinner } from '../design/ui'
import { useAuth } from '../auth/context'

/* Where the magic link lands.

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
  const { status } = useAuth()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))

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

  if (status === 'signedIn') return <Navigate to={next} replace />

  /* 'signedOut' here means the exchange has not finished yet, not that it
     failed - the failure path above is the one that reports a real problem. */
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-canvas">
      <Spinner />
      <span className="text-base text-ink-secondary">Signing you in</span>
    </div>
  )
}
