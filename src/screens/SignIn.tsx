import { useState, type FormEvent } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Alert, Button, Input, Spinner } from '../design/ui'
import { useAuth } from '../auth/context'
import { supabase } from '../lib/supabase'
import wordmark from '../assets/videosdk-wordmark-white.svg'

/* Sign in with a magic link.

   emailRedirectTo is built from window.location.origin, never a hardcoded
   URL, so localhost and the deployed domain both work from one build. The
   `next` param rides along so a student who arrived on a class link lands
   back on that link rather than on Home.

   No name is collected here. Magic link gives us an email and nothing else,
   and the display name is asked for on Precall, where it can be seen against
   the camera preview it will appear beside. */

function safeNext(raw: string | null): string {
  /* Only same-site paths. An open redirect on an auth screen is the one place
     it really matters. */
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
}

export function SignIn() {
  const { status } = useAuth()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))

  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  if (status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center bg-canvas">
        <Spinner />
      </div>
    )
  }
  if (status === 'signedIn') return <Navigate to={next} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setState('sending')

    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        shouldCreateUser: true,
      },
    })

    if (err) {
      setError(err.message)
      setState('idle')
      return
    }
    setState('sent')
  }

  return (
    <div className="flex h-full items-center justify-center bg-canvas p-6">
      <div className="vsdk-enter flex w-full max-w-[400px] flex-col gap-6 rounded-2xl border border-line bg-card p-8 shadow-lg">
        {/* Wordmark then product name, the way the rest of the VideoSDK surfaces
            sign themselves. It is a lockup, not the heading, so the h1 below is
            still the first thing a screen reader announces as the page title. */}
        <div className="flex items-center gap-3">
          <img src={wordmark} alt="VideoSDK" className="h-3.5" />
          <div className="h-4 w-px bg-hairline" />
          <span className="text-base font-medium text-ink">Classroom</span>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-ink">Sign in</h1>
          <p className="text-base text-ink-secondary">
            Start a class, or join one.
          </p>
        </div>

        {state === 'sent' ? (
          <Alert tone="success" title="Check your email">
            A sign-in link is on its way to <span className="text-ink">{email.trim()}</span>. Open
            it in this browser - the link only completes where it was requested.
          </Alert>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={(e) => void submit(e)}>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-tertiary">Email</span>
              <Input
                size="lg"
                type="email"
                required
                autoFocus
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                error={Boolean(error)}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            {error && <Alert tone="danger">{error}</Alert>}

            <Button size="lg" type="submit" disabled={state === 'sending' || email.trim() === ''}>
              {state === 'sending' ? 'Sending the link' : 'Email me a link'}
            </Button>
          </form>
        )}

        <p className="text-sm text-ink-tertiary">
          No password. We email you a link that signs you in.
        </p>
      </div>
    </div>
  )
}
