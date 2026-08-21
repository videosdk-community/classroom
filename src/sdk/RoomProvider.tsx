import { useMemo, type ReactNode } from 'react'
import { MeetingProvider } from '@videosdk.live/react-sdk'
import { MeetingBridge } from './bridges/MeetingBridge'
import { ParticipantBridges } from './bridges/ParticipantBridges'
import { PubSubBridge } from './bridges/PubSubBridge'
import { WhiteboardBridge } from './bridges/WhiteboardBridge'
import { RemoteAudio } from './RemoteAudio'
import { RoomStoreContext } from './hooks'
import { createRoomStore } from './store'
import { CHAT_TOPIC, CLASS_CONTROLS_TOPIC, HANDS_TOPIC } from './topics'

/* The single mount point. MeetingProvider plus every bridge, all of which
   render nothing.

   Structural constraint worth knowing before step 5 lands: MeetingProvider's
   `reinitialiseMeetingOnConfigChange` defaults to FALSE, so config is read on
   the first mount and changes afterwards are ignored. Custom precall tracks
   therefore have to be in hand before this component mounts, which is why
   precall must be a sibling screen and not something rendered inside here. */


export interface RoomProviderProps {
  meetingId: string
  token: string
  name: string
  /* Derived from the Supabase user id and already baked into the token, so
     the two agree. Passed separately because the store needs it before the
     SDK reports a local participant. */
  participantId: string
  /* The teacher's participantId, server-derived from room ownership. Every
     participant row's role is decided by comparing against this, so the
     roster and the Lecture stage agree with the server rather than with a
     broadcast claim. Whether the LOCAL user is the teacher is a separate
     concern and stays a prop on the screens - the real enforcement is
     allow_mod inside the token, and nothing here. */
  teacherId: string
  micEnabled: boolean
  camEnabled: boolean
  customCameraVideoTrack?: MediaStream
  customMicrophoneAudioTrack?: MediaStream
  children: ReactNode
}

export function RoomProvider({
  meetingId,
  token,
  name,
  participantId,
  teacherId,
  micEnabled,
  camEnabled,
  customCameraVideoTrack,
  customMicrophoneAudioTrack,
  children,
}: RoomProviderProps) {
  /* One store per provider instance. teacherId is in the dependency list for
     honesty rather than for reactivity - it comes from the session response
     and is fixed for the life of a room - but a store rebuilt mid-meeting
     would drop every participant row, so nothing else may join it here. */
  const store = useMemo(() => createRoomStore(teacherId), [teacherId])

  return (
    <MeetingProvider
      token={token}
      config={{
        meetingId,
        name,
        participantId,
        /* Declared non-optional in the typings, so all three are always
           passed even where a default would do. */
        micEnabled,
        webcamEnabled: camEnabled,
        debugMode: false,
        customCameraVideoTrack,
        customMicrophoneAudioTrack,
      }}
      joinWithoutUserInteraction
    >
      <RoomStoreContext.Provider value={store}>
        <MeetingBridge store={store} />
        <ParticipantBridges store={store} />
        <WhiteboardBridge store={store} />
        <PubSubBridge topic={CHAT_TOPIC} store={store} persist={false} />
        {/* persist so a late joiner picks up the current toggles through
            onOldMessagesReceived rather than starting with chat re-enabled. */}
        <PubSubBridge topic={CLASS_CONTROLS_TOPIC} store={store} persist />
        {/* Persisted too, so a student's hand survives their own reload and a
            teacher who joins late still sees who is asking. Hands from people
            who have since left are dropped when the log is folded, not here. */}
        <PubSubBridge topic={HANDS_TOPIC} store={store} persist />
        <RemoteAudio />
        {children}
      </RoomStoreContext.Provider>
    </MeetingProvider>
  )
}
