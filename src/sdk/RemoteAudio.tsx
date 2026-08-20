import { useEffect, useRef } from 'react'
import { useLocalId, useParticipantIds, useTrack } from './hooks'
import { warn } from './log'

/* Remote audio, one element per participant.

   The SDK ships an AudioPlayer that already does the important part
   (muted={isLocal} and a caught play()). This exists anyway, for two reasons
   worth being deliberate about: AudioPlayer opens a SECOND useParticipant
   subscription for someone we already bridge, doubling the per-participant
   listener count; and it sends autoplay rejections to console.error, where a
   silent failure is indistinguishable from a broken room.

   This version reads the track from the store's registry, so it adds no
   subscriptions at all. */

function ParticipantAudio({ id, isLocal }: { id: string; isLocal: boolean }) {
  const stream = useTrack(id, 'mic')
  const ref = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!stream) {
      el.srcObject = null
      return
    }
    el.srcObject = stream
    /* Autoplay policy rejects this on a hard reload with no user gesture.
       Caught rather than left floating, because an uncaught rejection here is
       a silent room that looks like a connection problem. */
    el.play().catch((err) => warn(`audio play() rejected for ${id}`, err))
  }, [stream, id])

  /* Never render an element for yourself. The classic feedback howl is a live
     local mic played back through local speakers, and `muted` alone has been
     known to be flipped by a well-meaning refactor - so the local participant
     is skipped entirely by the parent AND muted here. Belt and braces. */
  return <audio ref={ref} autoPlay playsInline muted={isLocal} />
}

export function RemoteAudio() {
  const ids = useParticipantIds()
  const localId = useLocalId()

  return (
    <>
      {ids
        .filter((id) => id !== localId)
        .map((id) => (
          <ParticipantAudio key={id} id={id} isLocal={false} />
        ))}
    </>
  )
}
