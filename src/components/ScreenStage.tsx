import { useEffect, useRef, type ReactNode } from 'react'
import { useTrack } from '../sdk'
import { RoomIcon } from './icons'
import { Button } from '../design/ui'

/* The presenter's screen, on centre stage.

   It covers the board rather than replacing it. The board is an iframe on a
   foreign origin, and an iframe that unmounts reloads on the way back - the
   class would watch the whiteboard blank and redraw itself every time a share
   ended. Covering it costs one layer and keeps the board exactly where the
   teacher left it.

   `object-contain`, never `cover`. A shared screen is the one video in this
   app where cropping loses the content: a cover fit on a 16:10 desktop in a
   16:9 region eats the top and bottom of whatever is being demonstrated. The
   letterbox bars are the honest result.

   There is no keep-out geometry here the way the board has, because there is
   no tldraw furniture underneath - the surround is ours and the only chrome
   is what the caller passes in. */

export interface ScreenStageProps {
  /** Who is presenting. From onPresenterChanged, never from a local flag. */
  presenterId: string
  presenterName: string
  /** Whether the local participant is the one sharing. */
  isSelf: boolean
  /** Stops the local share. Only rendered when `isSelf`, because nothing in
      the SDK lets one participant stop another's screen share - a teacher
      facing a student's share can only ask. */
  onStop: () => void
  /** Chrome that must stay reachable while a share covers the board, knocks
      above all. A student waiting to be let in has no other surface. */
  overlay?: ReactNode
}

export function ScreenStage({
  presenterId,
  presenterName,
  isSelf,
  onStop,
  overlay,
}: ScreenStageProps) {
  const stream = useTrack(presenterId, 'screen')
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.srcObject = stream ?? null
    if (stream) el.play().catch(() => {})
  }, [stream])

  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-2xl"
      style={{
        background: '#0a0a0c',
        /* The same lift the board has, so the swap reads as one surface
           replacing another rather than as a panel opening over it. */
        boxShadow: '0 24px 64px rgba(0,0,0,.55), 0 0 0 1px var(--border-default)',
      }}
    >
      {stream ? (
        /* Muted like every other video element in this app. Tab audio, when
           the presenter shared it, arrives as a separate screenShareAudio
           stream and is not played here - see DECISIONS.md. */
        <video ref={ref} autoPlay playsInline muted className="h-full w-full object-contain" />
      ) : (
        /* presenter-changed lands before the track does, so this is a real
           beat rather than a defensive branch nobody sees. */
        <div className="flex h-full w-full items-center justify-center text-base text-ink-tertiary">
          Waiting for {isSelf ? 'your screen' : `${presenterName}'s screen`}
        </div>
      )}

      <div
        className="absolute left-4 top-4 flex items-center gap-2 rounded-pill px-3 py-1 text-sm text-white backdrop-blur-[4px]"
        style={{ background: 'rgba(0,0,0,.6)' }}
      >
        <RoomIcon name="share" size={13} />
        {isSelf ? 'You are sharing your screen' : `${presenterName} is sharing a screen`}
      </div>

      {/* A second stop, next to the thing being stopped. The control bar has
          one too, but a teacher mid-demo is looking at the screen, not at the
          bar - and the browser's own sharing bar is off-window on a second
          display often enough to be no help at all. */}
      {isSelf && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <Button size="md" variant="destructive" onClick={onStop}>
            Stop sharing
          </Button>
        </div>
      )}

      {overlay && <div className="absolute right-4 top-4">{overlay}</div>}
    </div>
  )
}
