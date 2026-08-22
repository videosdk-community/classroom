import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, Button, Spinner } from '../design/ui'
import { RoomGate, type ExitReason } from './RoomGate'
import { Precall } from './Precall'
import { RoomProvider, type PrecallTracks } from '../sdk'
import { useSession } from '../session/useSession'
import { useAuth } from '../auth/context'
import { readDisplayName } from '../lib/displayName'
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
          <Alert
            tone={ended ? 'info' : 'danger'}
            title={ended ? 'This class has ended' : 'Cannot open this class'}
          >
            {/* The server's sentence IS the title in the ended case, so
                repeating it verbatim underneath reads as a bug. Say the next
                useful thing instead. */}
            {ended
              ? 'The teacher closed it. Ask for a new link if it is running again.'
              : (error?.message ?? 'Something went wrong.')}
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
  const navigate = useNavigate()
  const [joined, setJoined] = useState<Joined | null>(null)
  const [fresh, setFresh] = useState<RoomSession>(session)
  const [joining, setJoining] = useState(false)
  /* Bumped on every re-knock, and used as RoomProvider's key.

     MeetingProvider reads its config once - reinitialiseMeetingOnConfigChange
     defaults to false - so there is no way to ask again except to build a new
     provider. The key IS the mechanism; without it "Ask again" silently
     re-renders the same dead meeting. */
  const [attempt, setAttempt] = useState(0)
  const [exit, setExit] = useState<ExitReason | null>(null)
  const { user } = useAuth()

  /* Back to precall rather than straight into a new join.

     leave() stops the tracks handed to the previous provider, so reusing them
     would give the next attempt a dead camera - a failure that shows up as a
     black tile and no error at all. Precall re-acquires, and it is one click. */
  const askAgain = () => {
    setExit(null)
    setJoined(null)
    setAttempt((n) => n + 1)
  }

  if (exit && exit !== 'ask-again') {
    return <ExitScreen reason={exit} onAskAgain={askAgain} onHome={() => navigate('/')} />
  }

  if (!joined) {
    return (
      <Precall
        title={session.title}
        name={readDisplayName(user)}
        busy={joining}
        /* Only ever set by a re-knock, so a student sent back here knows why
           they are looking at a device picker again instead of a classroom. */
        notice={attempt > 0 ? 'You can ask to join again when you are ready.' : undefined}
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
          setJoining(false)
          setJoined(details)
        }}
      />
    )
  }

  return (
    <RoomProvider
      key={attempt}
      meetingId={fresh.meetingId}
      token={fresh.token}
      name={joined.name}
      participantId={fresh.participantId}
      teacherId={fresh.teacherParticipantId}
      micEnabled={joined.micOn}
      camEnabled={joined.camOn}
      customCameraVideoTrack={joined.tracks.camera}
      customMicrophoneAudioTrack={joined.tracks.microphone}
    >
      <RoomGate
        mode={fresh.mode}
        title={fresh.title}
        roomId={fresh.meetingId}
        name={joined.name}
        participantId={fresh.participantId}
        isTeacher={fresh.role === 'teacher'}
        onExit={(reason) => {
          if (reason === 'ask-again') askAgain()
          else setExit(reason)
        }}
      />
    </RoomProvider>
  )
}

/* Every way out of a class, said plainly.

   These render with the provider UNMOUNTED, which is the point: a student who
   was declined is looking at a page with no meeting behind it, so "declined"
   can never be confused with "still connecting". */
const EXIT_COPY: Record<
  Exclude<ExitReason, 'ask-again'>,
  { tone: 'info' | 'danger'; title: string; body: string; canAskAgain: boolean }
> = {
  declined: {
    tone: 'info',
    title: 'The teacher did not let you in',
    body: 'They may be mid-class, or expecting you at a different time. You can ask again.',
    canAskAgain: true,
  },
  left: {
    tone: 'info',
    title: 'You left the waiting room',
    body: 'Nobody was told. You can ask to join again whenever you like.',
    canAskAgain: true,
  },
  ended: {
    tone: 'info',
    title: 'Teacher left',
    body: 'The class ended when they left. Ask for a new link if it runs again.',
    canAskAgain: false,
  },
  /* The second-tab collision. participantId is the Supabase user id, so one
     account is one seat and the newer tab evicts the older - by design, and
     worth a sentence rather than a bare disconnect nobody can explain. */
  evicted: {
    tone: 'danger',
    title: 'This class is open in another tab',
    body: 'One account can hold one seat, and the newest tab keeps it. Close the others and rejoin here.',
    canAskAgain: true,
  },
  /* Removed by the teacher. Ask again is offered because it is true: nothing
     bars this student, the link still works, and asking again puts them back
     in the lobby where the teacher decides. Saying otherwise would be a
     stronger promise than the app can keep. */
  removed: {
    tone: 'danger',
    title: 'The teacher removed you from the class',
    body: 'You can ask to join again, and they will see your request in the same place as everyone else.',
    canAskAgain: true,
  },
}

function ExitScreen({
  reason,
  onAskAgain,
  onHome,
}: {
  reason: Exclude<ExitReason, 'ask-again'>
  onAskAgain: () => void
  onHome: () => void
}) {
  const copy = EXIT_COPY[reason]

  /* The end of a class is not an error, so it does not get an error card. It
     gets the middle of the screen, at the size of the thing that happened. */
  if (reason === 'ended') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-canvas p-6 text-center">
        <span className="text-2xl font-semibold text-ink">{copy.title}</span>
        <span className="max-w-[420px] text-base text-ink-secondary">{copy.body}</span>
        <Button size="lg" variant="secondary" className="mt-2" onClick={onHome}>
          Back to Home
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full items-center justify-center bg-canvas p-6">
      <div className="flex w-full max-w-[420px] flex-col gap-4">
        <Alert tone={copy.tone} title={copy.title}>
          {copy.body}
        </Alert>
        {/* Centred under the card rather than ragged-left. These screens are
            the whole page - there is nothing else on it to align to - and a
            left-aligned pair under a full-width card reads as the start of a
            form that never arrives. */}
        <div className="flex justify-center gap-2">
          {copy.canAskAgain && (
            <Button size="lg" onClick={onAskAgain}>
              Ask again
            </Button>
          )}
          <Button size="lg" variant="secondary" onClick={onHome}>
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  )
}
