import { Navigate, Route, Routes } from 'react-router-dom'
import { SignIn } from './screens/SignIn'
import { AuthCallback } from './screens/AuthCallback'
import { Home } from './screens/Home'
import { JoinRoute } from './screens/JoinRoute'
import { RequireAuth } from './auth/RequireAuth'

/* Routes.

   /                signed-in home: start a class, join one, reopen one
   /signin          magic link request
   /auth/callback   where the link lands
   /c/:roomId       the one way into a class

   Note what the class URL does NOT carry. No mode, no role - both come from
   api/session.ts, which derives them from who owns the room. */

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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
