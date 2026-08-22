import { useState } from 'react'
import { Alert } from '../design/ui'
import { RecordingRow } from './RecordingRow'
import { RecordingPlayer } from './RecordingPlayer'
import { RowSkeleton } from './RowSkeleton'
import type { Recording } from '../lib/recordings'

/* The recordings list and the player it opens.

   Which recording is playing is this component's business, so both pages get
   playback by rendering the list and nothing else. */

export interface RecordingListProps {
  /** null means still loading. */
  recordings: Recording[] | null
  error: string | null
  emptyText: string
}

export function RecordingList({ recordings, error, emptyText }: RecordingListProps) {
  const [playing, setPlaying] = useState<Recording | null>(null)

  if (error) return <Alert tone="danger">{error}</Alert>
  if (recordings === null) return <RowSkeleton />
  if (recordings.length === 0) {
    return (
      <p className="border-t border-hairline pt-6 text-base text-ink-secondary">{emptyText}</p>
    )
  }

  return (
    <>
      <ul className="flex flex-col">
        {recordings.map((recording) => (
          <RecordingRow
            key={recording.id}
            recording={recording}
            onPlay={() => setPlaying(recording)}
          />
        ))}
      </ul>
      {playing && <RecordingPlayer recording={playing} onClose={() => setPlaying(null)} />}
    </>
  )
}
