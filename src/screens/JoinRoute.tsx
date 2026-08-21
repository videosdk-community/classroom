import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, Button, Spinner } from '../design/ui'
import { LiveClassroom } from './LiveClassroom'
import { Precall } from './Precall'
import { RoomProvider, type PrecallTracks } from '../sdk'
import { useSession } from '../session/useSession'
import { suggestedName, useAuth } from '../auth/context'
import type { RoomSession } from '../session/types'

/* /c/:roomId - the one way into a class.

   A path param rather than a query string, deliberately: step 6 exists to
   stop configuration arriving from the URL, and ?room= invites ?role= next.
   The room id is the only thing the URL carries, and it decides nothing on
   its own - the server derives the role from who owns that room. */

interface Joined {
  tracks: PrecallTracks
  micOn: boolean
  camOn: boolean
  name: string
}

export function JoinRoute() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { status, session, error, retry, refresh } = useSession(roomId)

  if (status === 'loading') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-canvas">
        <Spinner />
        <span className="text-base text-ink-secondary">Opening the class</span>
      </div>
    )
  }

  if (status === 'error' || !session) {
    const ended = error?.code === 'room_ended'
    const missing = error?.code === 'room_not_found'
    return (
      <div className="flex h-full items-center justify-center bg-canvas p-6">
        <div className="flex w-full max-w-[420px] flex-col gap-4">
          <Alert tone={ended ? 'info' : 'danger'} title={ended ? 'This class has ended' : 'Cannot open this class'}>
            {error?.message ?? 'Something went wrong.'}
          </Alert>
          <div className="flex gap-2">
            {!ended && !missing && (
              <Button size="lg" onClick={retry}>
                Try again
              </Button>
            )}
            <Button size="lg" variant="secondary" onClick={() => navigate('/')}>
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return <PrecallThenRoom session={session} refresh={refresh} />
}

/* Precall and the room are SIBLINGS, never nested.

   MeetingProvider reads its config on first mount and ignores later changes -
   reinitialiseMeetingOnConfigChange defaults to false - so precall tracks only
   take effect if they exist before the provider mounts. Rendering precall
   inside a mounted provider would make the handoff a silent no-op and send
   someone hunting through the SDK for a bug that is in the tree shape. */
function PrecallThenRoom({
  session,
  refresh,
}: {
  session: RoomSession
  refresh: () => Promise<RoomSession>
}) {
  const [joined, setJoined] = useState<Joined | null>(null)
  const [fresh, setFresh] = useState<RoomSession>(session)
  const [joining, setJoining] = useState(false)
  const { user } = useAuth()

  if (!joined) {
    return (
      <Precall
        title={session.title}
        suggestedName={suggestedName(user)}
        busy={joining}
        onJoin={async (details) => {
          setJoining(true)
          /* Re-mint before mounting the provider. Ten minutes can pass while
             someone picks a microphone, and the token is checked at join. */
          try {
            setFresh(await refresh())
          } catch {
            /* Keep the token we already hold; if it has expired the join will
               fail loudly, which beats blocking on a transient network hiccup. */
          }
          setJoined(details)
        }}
      />
    )
  }

  return (
    <RoomProvider
      meetingId={fresh.meetingId}
      token={fresh.token}
      name={joined.name}
      participantId={fresh.participantId}
      isTeacher={fresh.role === 'teacher'}
      micEnabled={joined.micOn}
      camEnabled={joined.camOn}
      customCameraVideoTrack={joined.tracks.camera}
      customMicrophoneAudioTrack={joined.tracks.microphone}
    >
      <LiveClassroom mode={fresh.mode} title={fresh.title} />
    </RoomProvider>
  )
}
