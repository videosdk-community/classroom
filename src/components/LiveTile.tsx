import { useEffect, useRef } from 'react'
import { useParticipantView, useTrack } from '../sdk'
import { RoomIcon } from './icons'
import { cn } from '../design/ui'

/* A tile backed by a real video track.

   Same shape as the fixture Tile - the two rings mean the same things - but
   the camera-off placeholder is a gradient over a stable per-id hue rather
   than a fixture field, so a participant does not change colour on re-render. */

function hueFor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360
  return h
}

export function LiveTile({
  id,
  selfId,
  className,
}: {
  id: string
  selfId: string | null
  className?: string
}) {
  const p = useParticipantView(id)
  const stream = useTrack(id, 'cam')
  const ref = useRef<HTMLVideoElement>(null)
  const self = id === selfId

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.srcObject = stream ?? null
    if (stream) el.play().catch(() => {})
  }, [stream])

  if (!p) return null

  const ring = p.isActiveSpeaker
    ? 'inset 0 0 0 2.5px var(--primary-button)'
    : self
      ? 'inset 0 0 0 1.5px var(--text-tertiary)'
      : 'inset 0 0 0 1px rgba(255,255,255,.06)'

  const initials = p.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)

  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-inset', className)} style={{ boxShadow: ring }}>
      {p.camOn && stream ? (
        /* Always muted. This element carries video only; audio is one
           <audio> per participant in the seam, with the local one skipped. An
           unmuted video element here would reintroduce the feedback howl. */
        <video ref={ref} autoPlay playsInline muted className="h-full w-full object-cover" />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center"
          style={{ background: `linear-gradient(135deg, hsl(${hueFor(id)} 45% 26%), #0f0f12)` }}
        >
          <div
            className="flex size-10 items-center justify-center rounded-[50%] text-base font-semibold"
            style={{ background: 'var(--primary-200)', color: 'var(--primary-900)' }}
          >
            {initials}
          </div>
        </div>
      )}

      <div
        className="absolute bottom-1.5 left-1.5 flex h-6 max-w-[calc(100%-12px)] items-center gap-1 rounded-md px-2 text-sm text-white backdrop-blur-[4px]"
        style={{ background: 'rgba(0,0,0,.55)' }}
      >
        <RoomIcon
          name={p.micOn ? 'mic' : 'micOff'}
          size={12}
          style={p.micOn ? undefined : { color: 'var(--red-400)' }}
        />
        <span className="truncate">{self ? 'You' : p.name}</span>
      </div>
    </div>
  )
}
