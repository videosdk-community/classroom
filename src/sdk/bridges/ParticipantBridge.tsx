import { useEffect } from 'react'
import { useParticipant } from '@videosdk.live/react-sdk'
import type { RoomStore } from '../store'

/* useParticipant is inherently per-id, so this is the one bridge that renders
   more than once. Still exactly one subscription per participant, which is
   the floor rather than a choice.

   Media streams go to the store's non-reactive registry, not the snapshot: a
   MediaStream identity change on one person must not bump the version for the
   whole tree. */

export function ParticipantBridge({ id, store }: { id: string; store: RoomStore }) {
  const {
    displayName,
    micOn,
    webcamOn,
    isLocal,
    isActiveSpeaker,
    micStream,
    webcamStream,
    screenShareStream,
  } = useParticipant(id)

  useEffect(() => {
    store.upsertParticipant(id, {
      name: displayName || 'Someone',
      micOn: Boolean(micOn),
      camOn: Boolean(webcamOn),
      isLocal: Boolean(isLocal),
      isActiveSpeaker: Boolean(isActiveSpeaker),
    })
  }, [store, id, displayName, micOn, webcamOn, isLocal, isActiveSpeaker])

  useEffect(() => {
    const stream = micStream?.track ? new MediaStream([micStream.track]) : undefined
    store.setTrack(id, 'mic', stream)
    return () => store.setTrack(id, 'mic', undefined)
  }, [store, id, micStream])

  useEffect(() => {
    const stream = webcamStream?.track ? new MediaStream([webcamStream.track]) : undefined
    store.setTrack(id, 'cam', stream)
    return () => store.setTrack(id, 'cam', undefined)
  }, [store, id, webcamStream])

  /* The share track, on whoever is presenting. Never rendered in a tile - the
     stage reads it by presenter id. object-fit differs from a camera's too:
     a cropped screen loses the line of code the class is being shown. */
  useEffect(() => {
    const stream = screenShareStream?.track
      ? new MediaStream([screenShareStream.track])
      : undefined
    store.setTrack(id, 'screen', stream)
    return () => store.setTrack(id, 'screen', undefined)
  }, [store, id, screenShareStream])

  return null
}
