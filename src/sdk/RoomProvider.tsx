import { useMemo, type ReactNode } from 'react'
import { MeetingProvider } from '@videosdk.live/react-sdk'
import { MeetingBridge } from './bridges/MeetingBridge'
import { ParticipantBridges } from './bridges/ParticipantBridges'
import { PubSubBridge } from './bridges/PubSubBridge'
import { WhiteboardBridge } from './bridges/WhiteboardBridge'
import { RemoteAudio } from './RemoteAudio'
import { RoomStoreContext } from './hooks'
import { createRoomStore } from './store'

/* The single mount point. MeetingProvider plus every bridge, all of which
   render nothing.

   Structural constraint worth knowing before step 5 lands: MeetingProvider's
   `reinitialiseMeetingOnConfigChange` defaults to FALSE, so config is read on
   the first mount and changes afterwards are ignored. Custom precall tracks
   therefore have to be in hand before this component mounts, which is why
   precall must be a sibling screen and not something rendered inside here. */

export const CLASS_CONTROLS_TOPIC = 'CLASS_CONTROLS'
export const CHAT_TOPIC = 'CHAT'

export interface RoomProviderProps {
  meetingId: string
  token: string
  name: string
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
  micEnabled,
  camEnabled,
  customCameraVideoTrack,
  customMicrophoneAudioTrack,
  children,
}: RoomProviderProps) {
  /* One store per provider instance, created once. */
  const store = useMemo(() => createRoomStore(), [])

  return (
    <MeetingProvider
      token={token}
      config={{
        meetingId,
        name,
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
        <RemoteAudio />
        {children}
      </RoomStoreContext.Provider>
    </MeetingProvider>
  )
}
