import { useState, type FormEvent } from 'react'
import { Alert, Button, Input } from '../design/ui'
import { supabase } from '../lib/supabase'

/* Turn a guest into a permanent account without starting over.

   updateUser({ email }) links an email identity to the account that is
   already signed in. The user id does not change, which is the whole point:
   rooms.owner_id already points at it, so the classes come along with no
   migration, no reassignment, and nothing for api/session.ts to notice. The
   is_anonymous claim flips to false once the address is confirmed.

   This needs Manual Linking enabled on the project
   (GOTRUE_SECURITY_MANUAL_LINKING_ENABLED). Without it the call is refused,
   and the refusal is the only sign - there is no capability to feature-detect.

   Sits under the class list rather than in the header because the class list
   is the thing at risk. The prompt belongs next to what it is protecting.

   Not handled, deliberately: linking to an address that already has an
   account. Supabase refuses that outright and merging would mean rewriting
   rooms.owner_id across two users, which rooms_update_own cannot express -
   its with check is auth.uid() = owner_id, so nobody can hand a row to
   somebody else. That is a service-role endpoint, not a client call, and it
   does not exist yet. The copy below says so rather than pretending. */

/* Supabase reports both of these as messages rather than codes worth matching
   on exactly, so match loosely and fall back to its own words.

   The rate limit is the one that will actually show up in a demo: the
   built-in sender allows only a few messages an hour for the whole project,
   and "email rate limit exceeded" tells the person at the keyboard nothing
   they can act on. It is not their address that is wrong. */
function isTaken(message: string): boolean {
  const m = message.toLowerCase()
  return m.includes('already been registered') || m.includes('already registered')
}

function isRateLimited(message: string): boolean {
  return message.toLowerCase().includes('rate limit')
}

export function SaveAccount() {
  const [state, setState] = useState<'idle' | 'editing' | 'sending' | 'sent'>('idle')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setState('sending')

    const address = email.trim()
    const { error: err } = await supabase.auth.updateUser(
      { email: address },
      {
        /* Marked so the callback waits for the account to actually stop being
           a guest. Without it that screen sees an already-signed-in visitor
           and redirects before the confirmation lands. */
        emailRedirectTo: `${window.location.origin}/auth/callback?next=%2F&confirm=email`,
      },
    )

    if (err) {
      if (isTaken(err.message)) {
        setError(
          'That address already has an account. Sign into it from the sign-in screen - but the classes you started as a guest will stay behind, because they belong to this account and not that one.',
        )
      } else if (isRateLimited(err.message)) {
        setError(
          'Too many sign-in emails have gone out from this project in the last hour. Nothing was changed - wait a little and try again.',
        )
      } else {
        setError(err.message)
      }
      setState('editing')
      return
    }
    setState('sent')
  }

  if (state === 'sent') {
    return (
      <Alert tone="success" title="Check your email">
        Confirm <span className="text-ink">{email.trim()}</span> and this account becomes permanent.
        Your classes stay exactly where they are - the account keeps its identity, it only gains a
        way back in.
      </Alert>
    )
  }

  if (state === 'idle') {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-card px-4 py-3">
        <p className="min-w-0 flex-1 text-sm text-ink-secondary">
          These classes live in this browser only. Add an email to keep them.
        </p>
        <Button variant="secondary" size="sm" onClick={() => setState('editing')}>
          Save this account
        </Button>
      </div>
    )
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-line bg-card px-4 py-3"
      onSubmit={(e) => void submit(e)}
    >
      <p className="text-sm text-ink-secondary">
        You keep the same account and the same classes. The email is only a way back in.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          autoFocus
          type="email"
          required
          autoComplete="email"
          className="min-w-0 flex-1 max-sm:basis-full"
          aria-label="Your email address"
          placeholder="you@example.com"
          value={email}
          error={Boolean(error)}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" disabled={state === 'sending' || email.trim() === ''}>
          {state === 'sending' ? 'Sending' : 'Send the link'}
        </Button>
        <Button
          variant="text"
          onClick={() => {
            setState('idle')
            setError(null)
          }}
        >
          Cancel
        </Button>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}
    </form>
  )
}
