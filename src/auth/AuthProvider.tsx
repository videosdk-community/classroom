import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext, type AuthValue } from './context'

/* Who is signed in, for the whole app.

   Seeded once from getSession() - which reads localStorage and, on the page a
   magic link lands on, finishes the code exchange - then kept current by
   onAuthStateChange.

   One trap worth knowing before editing the callback: supabase-js holds an
   internal auth lock across it, so awaiting another supabase call inside the
   callback deadlocks the client. Set state and return; do the awaiting
   somewhere else. */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let live = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!live) return
      setSession(data.session)
      setReady(true)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      /* No await in here. See the note above. */
      setSession(next)
      setReady(true)
    })

    return () => {
      live = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      status: !ready ? 'loading' : session ? 'signedIn' : 'signedOut',
      user: session?.user ?? null,
      session,
    }),
    [ready, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
