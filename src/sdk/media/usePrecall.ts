import { useCallback, useEffect, useRef, useState } from 'react'
import { warn } from '../log'
import { usePrecallDevices, type MediaDeviceOption } from './devices'
import { queryDoor, requestAccess, type DoorState } from './permissions'
import { createPreviewCamera, createPreviewMicrophone, stopStream } from './tracks'

/* The precall state machine.

   Five states, not four. The distinction that earns its keep is dismissed
   versus blocked: pressing Escape on Chrome's permission dialog rejects the
   request but leaves the door at 'prompt', so that user needs the ask button
   again, not a settings walkthrough. Conflating the two is how precall ends
   up showing a dead end to someone who is one click from working.

   'unavailable' is separate from 'blocked' because "no camera attached" and
   "camera blocked" are different problems and only one of them is fixable in
   browser settings. */
export type PrecallState = 'checking' | 'askable' | 'requesting' | 'granted' | 'blocked' | 'unavailable'

export interface PrecallTracks {
  camera?: MediaStream
  microphone?: MediaStream
}

function stateFromDoors(cam: DoorState, mic: DoorState): PrecallState {
  if (cam === 'granted' || mic === 'granted') return 'granted'
  if (cam === 'denied' && mic === 'denied') return 'blocked'
  return 'askable'
}

export function usePrecall() {
  const [state, setState] = useState<PrecallState>('checking')
  const [cameras, setCameras] = useState<MediaDeviceOption[]>([])
  const [microphones, setMicrophones] = useState<MediaDeviceOption[]>([])
  const [cameraId, setCameraId] = useState<string>()
  const [microphoneId, setMicrophoneId] = useState<string>()
  const [camOn, setCamOn] = useState(true)
  const [micOn, setMicOn] = useState(true)

  const devices = usePrecallDevices()
  const tracks = useRef<PrecallTracks>({})
  const [preview, setPreview] = useState<MediaStream | undefined>()

  const refreshDevices = useCallback(async () => {
    const [cams, mics] = await Promise.all([devices.cameras(), devices.microphones()])
    setCameras(cams)
    setMicrophones(mics)
    setCameraId((id) => id ?? cams[0]?.id)
    setMicrophoneId((id) => id ?? mics[0]?.id)
  }, [devices])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [cam, mic] = await Promise.all([queryDoor('camera'), queryDoor('microphone')])
      if (cancelled) return
      const next = stateFromDoors(cam, mic)
      setState(next)
      if (next === 'granted') void refreshDevices()
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ask = useCallback(async () => {
    setState('requesting')
    const outcome = await requestAccess({ video: true, audio: true }, 'camera')

    if (outcome.state === 'granted') {
      /* The probe stream did its job; the real preview tracks come from the
         SDK factories so precall and the meeting use identical encoder
         settings. */
      stopStream(outcome.stream)
      setState('granted')
      await refreshDevices()
      return
    }
    if (outcome.state === 'denied') { setState('blocked'); return }
    /* 'prompt' means dismissed, not refused. Still askable. */
    if (outcome.state === 'prompt') { setState('askable'); return }
    setState('unavailable')
  }, [refreshDevices])

  /* Rebuild the preview whenever the selected camera changes. The previous
     stream is stopped first: skip that and the camera light stays on and the
     handles pile up until the tab is closed. */
  useEffect(() => {
    /* Gated on cameraId as well as state.

       Without it this fires once before the device list resolves and again
       once it does, and the two getUserMedia calls overlap on the same
       hardware. A camera that cannot be opened twice then blocks the second
       call indefinitely: it neither resolves nor rejects, so the preview
       simply never appears and there is nothing in the console to explain it.
       That cost real time to find, which is why it is written down. */
    if (state !== 'granted' || !camOn || !cameraId) {
      stopStream(tracks.current.camera)
      tracks.current.camera = undefined
      setPreview(undefined)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        /* Released BEFORE the next is opened, not after. Holding both at once
           is the same overlap described above, and it is what makes switching
           devices hang rather than flicker. */
        stopStream(tracks.current.camera)
        tracks.current.camera = undefined

        const next = await createPreviewCamera(cameraId)
        if (cancelled) { stopStream(next); return }
        tracks.current.camera = next
        setPreview(next)
      } catch (err) {
        /* Without this the rejection is swallowed by `void` and the preview
           just silently never appears, which looks like a camera that is off
           rather than one that failed. */
        warn('could not open the camera for preview', err)
        if (!cancelled) setPreview(undefined)
      }
    })()
    return () => { cancelled = true }
  }, [state, cameraId, camOn])

  useEffect(() => {
    if (state !== 'granted' || !micOn || !microphoneId) {
      stopStream(tracks.current.microphone)
      tracks.current.microphone = undefined
      return
    }
    let cancelled = false
    void (async () => {
      try {
        stopStream(tracks.current.microphone)
        tracks.current.microphone = undefined

        const next = await createPreviewMicrophone(microphoneId)
        if (cancelled) { stopStream(next); return }
        tracks.current.microphone = next
      } catch (err) {
        warn('could not open the microphone', err)
      }
    })()
    return () => { cancelled = true }
  }, [state, microphoneId, micOn])

  /* Hand off WITHOUT stopping. A stopped MediaStream given to MeetingProvider
     raises ERROR_CUSTOM_VIDEO_TRACK_ENDED; keeping it alive is also the whole
     reason the camera does not blink between precall and the room. */
  const handOff = useCallback((): PrecallTracks => ({ ...tracks.current }), [])

  /* Only for abandoning precall without joining. */
  const discard = useCallback(() => {
    stopStream(tracks.current.camera)
    stopStream(tracks.current.microphone)
    tracks.current = {}
    setPreview(undefined)
  }, [])

  return {
    state,
    cameras,
    microphones,
    cameraId,
    microphoneId,
    camOn,
    micOn,
    preview,
    setCameraId,
    setMicrophoneId,
    setCamOn,
    setMicOn,
    ask,
    handOff,
    discard,
  }
}
