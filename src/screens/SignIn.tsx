import { useState, type FormEvent } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Alert, Button, Input, Spinner } from '../design/ui'
import { useAuth } from '../auth/context'
import { writeDisplayName } from '../lib/displayName'
import { supabase } from '../lib/supabase'
import wordmark from '../assets/videosdk-wordmark-white.svg'

/* The one way in. A name and a button.

   signInAnonymously() is not a lesser session. It creates a real row in
   auth.users with a real id and a real JWT carrying the authenticated role;
   the only thing a guest lacks is an identity to sign back in with once the
   browser storage is gone. That distinction costs us nothing here, because
   api/session.ts derives everything from one comparison - does room.owner_id
   equal the verified user.id - and a guest has a user.id like anyone else.

   Which is the whole point: the four context switches a magic link asks for
   before you reach the camera preview are gone, and not one line of the role
   derivation moved to make it happen.

   Magic link stays below the fold as the way to get an account that outlives
   the browser. emailRedirectTo is built from window.location.origin, never a
   hardcoded URL, so localhost and the deployed domain both work from one
   build. The `next` param rides along so a student who arrived on a class
   link lands back on that link rather than on Home.

   The name is collected here rather than on Precall because it is the only
   field on the screen - asking for it costs nothing, and it spares everyone
   retyping it later. Precall still lets you edit it against the camera
   preview it will appear beside. */

function safeNext(raw: string | null): string {
  /* Only same-site paths. An open redirect on an auth screen is the one place
     it really matters. */
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
}

export function SignIn() {
  const { status } = useAuth()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))

  const [method, setMethod] = useState<'guest' | 'email'>('guest')
  const [name, setName] = useState('')
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
  /* Both paths end here. Nothing navigates by hand: the sign-in flips status
     through onAuthStateChange and this fires on the next render. */
  if (status === 'signedIn') return <Navigate to={next} replace />

  const enterAsGuest = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setState('sending')

    const chosen = name.trim()
    const { error: err } = await supabase.auth.signInAnonymously({
      options: { data: { display_name: chosen } },
    })

    if (err) {
      setError(err.message)
      setState('idle')
      return
    }
    /* Also written locally so Home and Precall prefill on first paint rather
       than after the session lands. The metadata copy is the durable one. */
    writeDisplayName(chosen)
  }

  const sendLink = async (e: FormEvent) => {
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

  /* Keyed so React remounts the field instead of reusing the node in the
     same slot - autoFocus only fires on mount, so without it the toggle
     leaves the caret on the button you just clicked. */
  const switchTo = (to: 'guest' | 'email') => {
    setMethod(to)
    setError(null)
    setState('idle')
  }

  return (
    <div className="flex h-full items-center justify-center bg-canvas p-6">
      <div className="flex w-full max-w-[400px] flex-col items-center gap-6">
        {/* Wordmark then product name, the way the rest of the VideoSDK
            surfaces sign themselves. Above the card rather than inside it: it
            signs the page, not the form. It is a lockup, not the heading, so
            the h1 below is still the first thing a screen reader announces as
            the page title. */}
        <div className="flex items-center gap-3">
          <img src={wordmark} alt="VideoSDK" className="h-5" />
          <div className="h-5 w-px bg-hairline" />
          <span className="text-lg font-medium text-ink">Classroom</span>
        </div>

        <div className="vsdk-enter flex w-full flex-col gap-6 rounded-2xl border border-line bg-card p-8 shadow-lg">
          {/* Says what you are actually doing. Someone who arrived on a class
              link is joining a class, not signing up for a product. */}
          <h1 className="text-2xl font-semibold text-ink">
            {next.startsWith('/c/') ? 'Join the class' : 'Get started'}
          </h1>

          {method === 'guest' ? (
            <>
              <form className="flex flex-col gap-3" onSubmit={(e) => void enterAsGuest(e)}>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm text-ink-tertiary">Your name</span>
                  <Input
                    key="guest"
                    size="lg"
                    required
                    autoFocus
                    maxLength={60}
                    autoComplete="name"
                    placeholder="How the class sees you"
                    value={name}
                    error={Boolean(error)}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>

                {error && <Alert tone="danger">{error}</Alert>}

                <Button
                  size="lg"
                  type="submit"
                  disabled={state === 'sending' || name.trim() === ''}
                >
                  {state === 'sending' ? 'Getting you in' : 'Continue'}
                </Button>
              </form>

              <p className="text-sm text-ink-tertiary">
                No account needed. To keep your classes across devices,{' '}
                <Button variant="link" onClick={() => switchTo('email')}>
                  use an email address instead
                </Button>
                .
              </p>
            </>
          ) : state === 'sent' ? (
            <Alert tone="success" title="Check your email">
              A sign-in link is on its way to <span className="text-ink">{email.trim()}</span>. Open
              it in this browser - the link only completes where it was requested.
            </Alert>
          ) : (
            <>
              <form className="flex flex-col gap-3" onSubmit={(e) => void sendLink(e)}>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm text-ink-tertiary">Email</span>
                  <Input
                    key="email"
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

              <p className="text-sm text-ink-tertiary">
                No password. We email you a link that signs you in.{' '}
                <Button variant="link" onClick={() => switchTo('guest')}>
                  Continue as a guest
                </Button>
                .
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
