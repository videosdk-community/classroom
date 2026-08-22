import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert } from '../design/ui'
import { ClassRow } from './ClassRow'
import { RowSkeleton } from './RowSkeleton'
import { classLink, type Room } from '../lib/rooms'

/* The list of classes you own, with its loading, empty and error states.

   The copy-link state lives here rather than in either page: one state holds
   all three labels - the id while the copy landed, the id behind a `failed:`
   prefix while it did not, and null the rest of the time. */

export interface ClassListProps {
  /** null means still loading. */
  rooms: Room[] | null
  error: string | null
  emptyText: string
}

function copyLabel(copied: string | null, roomId: string): string {
  if (copied === roomId) return 'Copied'
  if (copied === `failed:${roomId}`) return 'Copy failed'
  return 'Copy link'
}

export function ClassList({ rooms, error, emptyText }: ClassListProps) {
  const navigate = useNavigate()
  const [copied, setCopied] = useState<string | null>(null)

  /* The clipboard write can be refused - a browser with the permission
     denied, or the page served over plain http - and a button that silently
     does nothing is worse than one that says so. */
  const copy = async (roomId: string) => {
    try {
      await navigator.clipboard.writeText(classLink(roomId))
      setCopied(roomId)
    } catch {
      setCopied(`failed:${roomId}`)
    }
    window.setTimeout(() => setCopied(null), 1600)
  }

  if (error) return <Alert tone="danger">{error}</Alert>
  if (rooms === null) return <RowSkeleton />
  if (rooms.length === 0) {
    return (
      <p className="border-t border-hairline pt-6 text-base text-ink-secondary">{emptyText}</p>
    )
  }

  return (
    <ul className="flex flex-col">
      {rooms.map((room) => (
        <ClassRow
          key={room.id}
          room={room}
          copyLabel={copyLabel(copied, room.roomId)}
          onCopy={() => void copy(room.roomId)}
          onOpen={() => navigate(`/c/${room.roomId}`)}
        />
      ))}
    </ul>
  )
}
