import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

/* Split from AuthProvider.tsx so that file exports only a component, which is
   what React Fast Refresh needs to swap it without dropping state. */

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn'

export interface AuthValue {
  status: AuthStatus
  user: User | null
  session: Session | null
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}

/** The name to suggest when someone joins a class, before they edit it.

   A guest has no email to derive anything from, so the name they typed on the
   sign-in screen rides along in user_metadata and is read back here.

   user_metadata is writable by the account it belongs to, so it must never
   decide anything. A display name is decoration, the same way the `role`
   field in the session response is decoration: enforcement lives in the token
   permissions api/session.ts mints from room ownership, and nowhere else. */
export function suggestedName(user: User | null): string {
  const chosen = user?.user_metadata?.display_name
  if (typeof chosen === 'string' && chosen.trim()) return chosen.trim()

  const email = user?.email ?? ''
  const local = email.slice(0, email.indexOf('@'))
  return local || 'Guest'
}
