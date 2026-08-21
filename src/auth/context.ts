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

/** The name to suggest when someone joins a class, before they edit it. */
export function suggestedName(user: User | null): string {
  const email = user?.email ?? ''
  const local = email.slice(0, email.indexOf('@'))
  return local || 'Guest'
}
