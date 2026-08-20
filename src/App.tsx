import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
import { Classroom } from './screens/Classroom'
import { LiveClassroom } from './screens/LiveClassroom'
import { RoomProvider, devSession } from './sdk'
import type { ClassMode } from './fixtures/classroom'

/* Routes.

   Two classroom routes for now, which is a step-4 arrangement and not the
   shipped shape:

   /room  fixtures only, no SDK, no network. The step-3 checkpoint screen, and
          still the fastest way to judge the shell at a window size without
          burning meeting minutes.
   /live  the same shell wired to a real meeting.

   Mode is a query param in both, purely so each shape can be looked at without
   a database. In the shipped app it is a room column read once at join, so the
   param is scaffolding and goes at step 6 along with /room itself. */

function useMode(): ClassMode {
  const [params] = useSearchParams()
  return params.get('mode') === 'lecture' ? 'lecture' : 'class'
}

function FixtureRoute() {
  const [params] = useSearchParams()
  return <Classroom mode={useMode()} showKeepout={params.get('keepout') === '1'} />
}

function LiveRoute() {
  const mode = useMode()
  const dev = devSession()

  if (!dev) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-canvas px-6 text-center">
        <span className="text-xl font-semibold text-ink">No meeting token</span>
        <span className="max-w-[420px] text-base text-ink-secondary">
          Run <code className="text-ink">node scripts/mint-dev-token.mjs</code> to create a room and
          write the dev token, then restart the dev server. Step 6 replaces this with a real session.
        </span>
      </div>
    )
  }

  return (
    <RoomProvider
      meetingId={dev.meetingId}
      token={dev.token}
      name="Teacher"
      micEnabled
      camEnabled
    >
      <LiveClassroom mode={mode} />
    </RoomProvider>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/room" element={<FixtureRoute />} />
      <Route path="/live" element={<LiveRoute />} />
      <Route path="*" element={<Navigate to="/room" replace />} />
    </Routes>
  )
}
