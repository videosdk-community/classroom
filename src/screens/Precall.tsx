import { useEffect, useRef } from 'react'
import { MicMeter } from '../components/MicMeter'
import { PermissionHelp } from '../components/PermissionHelp'
import { RoomIcon } from '../components/icons'
import { Button, Select, Spinner } from '../design/ui'
import { usePrecall, type PrecallTracks } from '../sdk'

/* Precall: check the devices before the class sees you.

   Runs OUTSIDE MeetingProvider, and that is structural rather than tidy.
   MeetingProvider's reinitialiseMeetingOnConfigChange defaults to false, so
   custom tracks are read on its first mount and ignored afterwards - the
   handoff only works if the tracks exist before the provider exists. */

export function Precall({ onJoin }: { onJoin: (tracks: PrecallTracks, micOn: boolean, camOn: boolean) => void }) {
  const p = usePrecall()
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.srcObject = p.preview ?? null
    if (p.preview) el.play().catch(() => {})
  }, [p.preview])

  /* Abandoning precall without joining must release the camera. Joining must
     NOT - the live tracks become the meeting's, which is what stops the
     camera blinking between the two screens.

     Depends on p.discard, NOT on p. usePrecall returns a fresh object every
     render, so `[p]` re-runs this effect on every render and its cleanup
     tears down the track that was just acquired - the preview then resolves
     and vanishes in the same breath, with nothing logged and no error. It
     presents as a camera that will not turn on. p.discard is a stable
     useCallback, so this now runs only on real unmount. */
  const joined = useRef(false)
  const discard = p.discard
  useEffect(() => {
    return () => {
      if (!joined.current) discard()
    }
  }, [discard])

  const join = () => {
    joined.current = true
    onJoin(p.handOff(), p.micOn, p.camOn)
  }

  return (
    <div className="flex h-full items-center justify-center bg-canvas p-6">
      <div className="flex w-full max-w-[880px] flex-col items-center gap-6">
        <h1 className="text-2xl font-semibold text-ink">Ready to join?</h1>

        {p.state === 'checking' && <Spinner />}

        {p.state === 'blocked' && <PermissionHelp onContinue={() => onJoin({}, false, false)} />}

        {p.state === 'unavailable' && (
          <div className="flex max-w-[520px] flex-col items-center gap-4 text-center">
            <p className="text-base text-ink-secondary">
              No camera or microphone is available. Another application may be using it, or none is
              attached. You can still join and listen.
            </p>
            <Button onClick={() => onJoin({}, false, false)}>Join to listen</Button>
          </div>
        )}

        {(p.state === 'askable' || p.state === 'requesting') && (
          <div className="flex max-w-[520px] flex-col items-center gap-4 text-center">
            <p className="text-base text-ink-secondary">
              Classroom needs your camera and microphone. Your browser will ask next.
            </p>
            <Button onClick={() => void p.ask()} disabled={p.state === 'requesting'}>
              {p.state === 'requesting' ? 'Waiting for your browser' : 'Allow camera and microphone'}
            </Button>
          </div>
        )}

        {p.state === 'granted' && (
          <div className="flex w-full flex-col gap-5 md:flex-row">
            <div
              className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-inset md:w-[520px]"
              style={{ boxShadow: '0 24px 64px rgba(0,0,0,.45), 0 0 0 1px var(--border-default)' }}
            >
              {p.camOn && p.preview ? (
                /* Muted, always. An unmuted preview of your own microphone is
                   a feedback loop before the class has even started. */
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full scale-x-[-1] object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-base text-ink-tertiary">
                  Camera is off
                </div>
              )}

              {/* A scrim under the controls. They sit over whatever the camera
                  happens to see, and a mid-grey fill disappears against a
                  bright wall or a window. The gradient costs nothing and makes
                  them legible over any frame. */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
                <button
                  type="button"
                  aria-label={p.micOn ? 'Mute yourself' : 'Unmute yourself'}
                  onClick={() => p.setMicOn(!p.micOn)}
                  className="flex size-10 cursor-pointer items-center justify-center rounded-pill border-0 backdrop-blur-sm"
                  style={{
                    background: p.micOn ? 'rgba(24,24,27,.72)' : 'var(--red-600)',
                    color: '#fff',
                  }}
                >
                  <RoomIcon name={p.micOn ? 'mic' : 'micOff'} size={18} />
                </button>
                <button
                  type="button"
                  aria-label={p.camOn ? 'Turn camera off' : 'Turn camera on'}
                  onClick={() => p.setCamOn(!p.camOn)}
                  className="flex size-10 cursor-pointer items-center justify-center rounded-pill border-0 backdrop-blur-sm"
                  style={{
                    background: p.camOn ? 'rgba(24,24,27,.72)' : 'var(--red-600)',
                    color: '#fff',
                  }}
                >
                  <RoomIcon name={p.camOn ? 'cam' : 'camOff'} size={18} />
                </button>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm text-ink-tertiary">Camera</span>
                <Select
                  className="w-full"
                  size="lg"
                  value={p.cameraId}
                  options={p.cameras.map((c) => ({ label: c.label, value: c.id }))}
                  onChange={(v) => p.setCameraId(v)}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm text-ink-tertiary">Microphone</span>
                <Select
                  className="w-full"
                  size="lg"
                  value={p.microphoneId}
                  options={p.microphones.map((m) => ({ label: m.label, value: m.id }))}
                  onChange={(v) => p.setMicrophoneId(v)}
                />
                <MicMeter stream={p.micOn ? p.preview : undefined} />
                <span className="text-sm text-ink-tertiary">
                  Speak and the bar should move. If it does not, pick another microphone.
                </span>
              </label>

              <Button size="lg" onClick={join}>
                Join the class
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
