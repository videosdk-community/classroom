import { ParticipantBridge } from './ParticipantBridge'
import { useParticipantIds } from '../hooks'
import type { RoomStore } from '../store'

/* Reads ids from the STORE, not from useMeeting. Calling useMeeting here would
   be a second subscription and defeat the whole arrangement. */

export function ParticipantBridges({ store }: { store: RoomStore }) {
  const ids = useParticipantIds()
  return (
    <>
      {ids.map((id) => (
        <ParticipantBridge key={id} id={id} store={store} />
      ))}
    </>
  )
}
