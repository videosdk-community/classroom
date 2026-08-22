import { useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Alert, Button, Input, Spinner } from '../design/ui'
import { useAuth } from '../auth/context'
import { writeDisplayName } from '../lib/displayName'
import { supabase } from '../lib/supabase'
import wordmark from '../assets/videosdk-wordmark-white.svg'

/* The one way in, and the one way to stop being a guest.

   signInAnonymously() is not a lesser session. It creates a real row in
   auth.users with a real id and a real JWT carrying the authenticated role;
   the only thing a guest lacks is an identity to sign back in with once the
   browser storage is gone. That distinction costs us nothing here, because
   api/session.ts derives everything from one comparison - does room.owner_id
   equal the verified user.id - and a guest has a user.id like anyone else.

   Which is the whole point: the four context switches a magic link asks for
   before you reach the camera preview are gone, and not one line of the role
   derivation moved to make it happen.

   This screen serves three states, and the third is the reason it does not
   simply redirect when someone is already signed in:

     signed out         name + Continue, or an email link instead
     signed in, guest   attach an email to the account you already have
     signed in, real    nothing to do here, go where you were going

   The guest case is a merge, not a sign-in. updateUser({ email }) links an
   email identity to the existing account, so the user id never changes and
   every room already pointing at it comes along - no migration, nothing for
   api/session.ts to notice. Calling signInWithOtp here instead would create a
   SECOND account and silently strand every class the guest had started, which
   is exactly the bug this branch exists to prevent.

   emailRedirectTo is built from window.location.origin, never a hardcoded
   URL, so localhost and the deployed domain both work from one build. The
   `next` param rides along so a student who arrived on a class link lands
   back on that link rather than on Home.

   The name is collected here rather than on Precall because it is the only
   field on the screen - asking for it costs nothing, and it spares everyone
   retyping it later. Precall still lets you edit it against the camera
   preview it will appear beside. */

function safeNext(raw: string | null): string {
  /* Only same-site paths. An open redirect on an auth screen is the one place
     it really matters. */
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
}

/* Both of these carry a stable `code`, which is what to match on - the
   messages beside them are prose Supabase is free to reword. The string check
   is only a fallback for an older gotrue that omits the code.

   Probed, not assumed. Linking an address that already has an account answers
   422 / email_exists BEFORE it tries to send, so the collision is never
   masked by the rate limit:

     { status: 422, code: 'email_exists',
       message: 'A user with this email address has already been registered' }

   The rate limit is the one that shows up in practice: the built-in sender
   allows only a handful of messages an hour for the whole project, and "email
   rate limit exceeded" tells the person at the keyboard nothing they can act
   on. It is not their address that is wrong. */
function isTaken(err: { code?: string; message: string }): boolean {
  if (err.code === 'email_exists' || err.code === 'user_already_exists') return true
  return err.message.toLowerCase().includes('already been registered')
}

function isRateLimited(err: { code?: string; message: string }): boolean {
  if (err.code === 'over_email_send_rate_limit') return true
  return err.message.toLowerCase().includes('rate limit')
}

export function SignIn() {
  const { status, user } = useAuth()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))

  const isGuest = user?.is_anonymous === true

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
  /* A guest stays here on purpose - they came to attach an email, and this is
     where that happens. Only a permanent account has nothing left to do. */
  if (status === 'signedIn' && !isGuest) return <Navigate to={next} replace />

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

    const address = email.trim()

    /* The branch that keeps a guest's classes. updateUser links the address to
       the account already signed in; signInWithOtp would start a new one. */
    const { error: err } = isGuest
      ? await supabase.auth.updateUser(
          { email: address },
          {
            /* Marked so the callback waits for the account to actually stop
               being a guest. Without it that screen sees an already-signed-in
               visitor and redirects before the confirmation lands. */
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}&confirm=email`,
          },
        )
      : await supabase.auth.signInWithOtp({
          email: address,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
            shouldCreateUser: true,
          },
        })

    if (err) {
      if (isGuest && isTaken(err)) {
        setError(
          'That address already has an account, so it cannot be added to this one. Nothing has changed here - your classes are still on this guest account, and you are still signed into it. To reach the other account, sign into it in a different browser; the classes you started here will stay behind.',
        )
      } else if (isRateLimited(err)) {
        setError(
          'Too many sign-in emails have gone out from this project in the last hour. Nothing was changed - wait a little and try again.',
        )
      } else {
        setError(err.message)
      }
      setState('idle')
      return
    }
    setState('sent')
  }

  const switchTo = (to: 'guest' | 'email') => {
    setMethod(to)
    setError(null)
    setState('idle')
  }

  /* A signed-in guest only ever sees the email form - there is no second name
     to choose and no second account to make. */
  const showingEmail = isGuest || method === 'email'

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
            {isGuest ? 'Sign in' : next.startsWith('/c/') ? 'Join the class' : 'Get started'}
          </h1>

          {state === 'sent' ? (
            <>
              <Alert tone="success" title="Check your email">
                A link is on its way to <span className="text-ink">{email.trim()}</span>. Open it in
                this browser - it only completes where it was requested.
              </Alert>
              {isGuest && (
                <p className="text-sm text-ink-tertiary">
                  Nothing has changed yet. Your classes are still here, and confirming the address
                  keeps them on this same account.
                </p>
              )}
            </>
          ) : showingEmail ? (
            <>
              {isGuest && (
                <p className="text-base text-ink-secondary">
                  You are signed in as a guest. Add an email and you keep this same account, and
                  every class on it - the email is only a way back in.
                </p>
              )}

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

                <Button
                  size="lg"
                  type="submit"
                  disabled={state === 'sending' || email.trim() === ''}
                >
                  {state === 'sending' ? 'Sending the link' : 'Email me a link'}
                </Button>
              </form>

              <p className="text-sm text-ink-tertiary">
                No password. We email you a link that signs you in.{' '}
                {isGuest ? (
                  <Link className="text-ink-link hover:underline" to={next}>
                    Back to your classes
                  </Link>
                ) : (
                  <Button variant="link" onClick={() => switchTo('guest')}>
                    Continue as a guest
                  </Button>
                )}
                .
              </p>
            </>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  )
}
