import { useState } from 'react'
import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
import { Classroom } from './screens/Classroom'
import { LiveClassroom } from './screens/LiveClassroom'
import { Precall } from './screens/Precall'
import { RoomProvider, devSession, type PrecallTracks } from './sdk'
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

  return <PrecallThenRoom mode={mode} meetingId={dev.meetingId} token={dev.token} />
}

interface Joined {
  tracks: PrecallTracks
  micOn: boolean
  camOn: boolean
}

/* Precall and the room are SIBLINGS, never nested.

   MeetingProvider reads its config on first mount and ignores later changes -
   reinitialiseMeetingOnConfigChange defaults to false - so precall tracks only
   take effect if they exist before the provider mounts. Rendering precall
   inside a mounted provider would make the handoff a silent no-op and send
   someone hunting through the SDK for a bug that is in the tree shape. */
function PrecallThenRoom({
  mode,
  meetingId,
  token,
}: {
  mode: ClassMode
  meetingId: string
  token: string
}) {
  const [joined, setJoined] = useState<Joined | null>(null)

  if (!joined) {
    return (
      <Precall
        onJoin={(tracks, micOn, camOn) => setJoined({ tracks, micOn, camOn })}
      />
    )
  }

  return (
    <RoomProvider
      meetingId={meetingId}
      token={token}
      name="Teacher"
      micEnabled={joined.micOn}
      camEnabled={joined.camOn}
      customCameraVideoTrack={joined.tracks.camera}
      customMicrophoneAudioTrack={joined.tracks.microphone}
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
