import { useEffect, useRef } from 'react'
import { IconButton } from '../design/ui'
import { RoomIcon } from './icons'
import { formatRecordedAt, type Recording } from '../lib/recordings'

/* The recording, playing over the page.

   A bare <video> on the fileUrl VideoSDK returns - the composite is a plain
   MP4, so a player library would buy nothing but bytes. Download is an <a>,
   for the same reason.

   Escape and a backdrop click both close, and focus goes back to the row
   that opened this so a keyboard user is not dropped at the top of the
   document. */

export interface RecordingPlayerProps {
  recording: Recording
  onClose: () => void
}

export function RecordingPlayer({ recording, onClose }: RecordingPlayerProps) {
  const opener = useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const restore = opener.current
    return () => {
      window.removeEventListener('keydown', onKey)
      restore?.focus()
    }
  }, [onClose])

  const recordedAt = formatRecordedAt(recording.createdAt)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recording-player-title"
      /* Only the backdrop itself closes - a click that started inside the
         video and ended out here must not count. */
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="flex w-[880px] max-w-full flex-col gap-3 rounded-xl border border-line-strong bg-card p-5"
        style={{ boxShadow: 'var(--elevation-popover)' }}
      >
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2
              id="recording-player-title"
              className="truncate text-lg font-semibold text-ink-primary"
            >
              {recording.title}
            </h2>
            <span className="truncate text-sm text-ink-tertiary">
              {recordedAt ? `Recorded ${recordedAt}` : recording.roomId}
            </span>
          </div>
          <IconButton aria-label="Close" variant="ghost" onClick={onClose}>
            <RoomIcon name="close" size={18} />
          </IconButton>
        </div>

        {/* autoPlay, because opening the player is the request to watch. */}
        <video
          autoPlay
          controls
          src={recording.fileUrl}
          className="w-full rounded-lg bg-black"
          style={{ aspectRatio: '16 / 9' }}
        />

        <div className="flex justify-end">
          {/* An anchor, not a Button: Button renders a <button> and a
              download is a navigation. */}
          <a
            href={recording.fileUrl}
            download
            className="rounded-md px-3 py-1.5 text-base font-medium text-ink-link hover:underline"
          >
            Download
          </a>
        </div>
      </div>
    </div>
  )
}
