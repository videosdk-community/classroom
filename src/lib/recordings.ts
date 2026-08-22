import { apiGet } from './api'

/* Recordings, read live from VideoSDK through api/recordings.ts.

   Nothing is stored on our side. A recording is a file VideoSDK renders a
   minute or two after the class ends, and mirroring that into a table would
   mean a webhook, a poller and two sources of truth for a list that is read
   a handful of times a day. */

export interface Recording {
  id: string
  roomId: string
  title: string
  fileUrl: string
  sizeBytes: number | null
  durationSeconds: number | null
  createdAt: string | null
}

export async function listMyRecordings(limit: number): Promise<Recording[]> {
  const { recordings } = await apiGet<{ recordings: Recording[] }>(
    `/api/recordings?limit=${limit}`,
  )
  return recordings
}

/** m:ss under an hour, h:mm:ss over it. */
export function formatDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return '--:--'
  const total = Math.round(seconds)
  const s = String(total % 60).padStart(2, '0')
  const m = Math.floor(total / 60) % 60
  const h = Math.floor(total / 3600)
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

export function formatSize(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes)) return ''
  const mb = bytes / 1_000_000
  return mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${Math.max(1, Math.round(mb))} MB`
}

export function formatRecordedAt(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
