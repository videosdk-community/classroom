import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
import { Classroom } from './screens/Classroom'
import { SignIn } from './screens/SignIn'
import { AuthCallback } from './screens/AuthCallback'
import { Home } from './screens/Home'
import { JoinRoute } from './screens/JoinRoute'
import { RequireAuth } from './auth/RequireAuth'
import type { ClassMode } from './domain/classroom'

/* Routes.

   /                signed-in home: start a class, join one, reopen one
   /signin          magic link request
   /auth/callback   where the link lands
   /c/:roomId       the one way into a class

   /room is the last piece of scaffolding: fixtures only, no SDK and no
   network, still the fastest way to judge the shell at a window size without
   burning meeting minutes. It goes when the shell stops changing.

   Note what the class URL does NOT carry. No mode, no role - both come from
   api/session.ts, which derives them from who owns the room. */

function FixtureRoute() {
  const [params] = useSearchParams()
  const mode: ClassMode = params.get('mode') === 'lecture' ? 'lecture' : 'class'
  return <Classroom mode={mode} showKeepout={params.get('keepout') === '1'} />
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <RequireAuth>
            <Home />
          </RequireAuth>
        }
      />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        path="/c/:roomId"
        element={
          <RequireAuth>
            <JoinRoute />
          </RequireAuth>
        }
      />
      <Route path="/room" element={<FixtureRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
