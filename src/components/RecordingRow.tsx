import { Badge, Button } from '../design/ui'
import { RoomIcon } from './icons'
import { formatDuration, formatRecordedAt, formatSize, type Recording } from '../lib/recordings'

/* One recording. Deliberately the same row geometry as a class - same icon
   tile, same title-over-mono second line - because they are two lists of the
   same thing at two points in its life. */

export interface RecordingRowProps {
  recording: Recording
  onPlay: () => void
}

export function RecordingRow({ recording, onPlay }: RecordingRowProps) {
  const meta = [formatRecordedAt(recording.createdAt), formatSize(recording.sizeBytes)]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="group flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border-b border-hairline px-2 py-3 transition-colors duration-[120ms] ease-standard last:border-b-0 hover:bg-subtle">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-inset text-ink-secondary">
        <RoomIcon name="record" size={18} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-base font-medium text-ink">{recording.title}</span>
        <span className="truncate text-sm text-ink-tertiary">{meta || recording.roomId}</span>
      </div>
      <span className="shrink-0">
        <Badge tone="neutral" outline>
          {formatDuration(recording.durationSeconds)}
        </Badge>
      </span>
      <span className="flex shrink-0 items-center gap-1 max-sm:w-full max-sm:justify-end">
        <Button variant="secondary" onClick={onPlay}>
          Play
        </Button>
      </span>
    </li>
  )
}
