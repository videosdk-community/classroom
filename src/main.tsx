import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthProvider'

/* No <StrictMode> here, and this is deliberate rather than an oversight.

   React double-invokes effects in development. MeetingBridge's join is one of
   them, so with StrictMode on, one browser joins the meeting twice and shows
   up in the room as two participants, each holding a live microphone. It
   presents as a bug in the SDK or in our own participant bookkeeping, and it
   is neither.

   A ref guard would suppress it, but it would also suppress a genuine
   double-mount, which is the class of bug StrictMode exists to reveal. So the
   trade is made explicitly here rather than papered over at the join site.

   If you are putting StrictMode back: join a real room first and count the
   participants. */

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>,
)
