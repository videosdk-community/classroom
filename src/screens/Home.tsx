import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Badge, Button, Input, Select, Spinner } from '../design/ui'
import { useAuth } from '../auth/context'
import { supabase } from '../lib/supabase'
import { classLink, createRoom, listMyRooms, type Room } from '../lib/rooms'
import type { ClassMode } from '../domain/classroom'
import mark from '../assets/videosdk-mark.svg'

/* Home: start a class, join one, or reopen one you own.

   The room list is read straight from Supabase under RLS rather than through
   api/. The owner-scoped select policy exists for exactly this, and putting
   it on the real path means a mistake in that policy shows up here instead of
   hiding behind the service role.

   Joining by link does NOT preview the room. RLS is per-row, not per-column,
   so "let anyone read the title and mode" is not expressible without making
   the whole table enumerable. The title and mode arrive from api/session.ts
   at join instead, in the same trusted response as the token. */

const MODE_OPTIONS = [
  { label: 'Class - everyone onstage', value: 'class' },
  { label: 'Lecture - teacher onstage', value: 'lecture' },
]

function roomIdFromLink(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  /* Accept a full link or a bare id, since people paste both. */
  const match = trimmed.match(/\/c\/([^/?#\s]+)/)
  return match ? match[1] : trimmed
}

export function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [rooms, setRooms] = useState<Room[] | null>(null)
  const [listError, setListError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [mode, setMode] = useState<ClassMode>('class')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [link, setLink] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setRooms(await listMyRooms())
      setListError(null)
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Your classes could not be loaded.')
    }
  }, [])

  /* Fetching the list on mount is what an effect is for. The lint rule cannot
     see that every setState in `refresh` happens after an await, so it reads
     this as a synchronous cascade; it is not. */
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh()
  }, [refresh])

  const create = async (e: FormEvent) => {
    e.preventDefault()
    setCreateError(null)
    setCreating(true)
    try {
      const room = await createRoom(title.trim(), mode)
      setTitle('')
      await refresh()
      navigate(`/c/${room.roomId}`)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'The class could not be created.')
      setCreating(false)
    }
  }

  const copy = async (roomId: string) => {
    await navigator.clipboard.writeText(classLink(roomId))
    setCopied(roomId)
    window.setTimeout(() => setCopied(null), 1600)
  }

  return (
    <div className="h-full overflow-y-auto bg-canvas">
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-8 px-6 py-10">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={mark} alt="" className="size-7" />
            <span className="text-xl font-semibold text-ink">Classroom</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-tertiary">{user?.email}</span>
            <Button variant="text" onClick={() => void supabase.auth.signOut()}>
              Sign out
            </Button>
          </div>
        </header>

        <section
          className="flex flex-col gap-4 rounded-2xl bg-card p-6"
          style={{ boxShadow: '0 24px 64px rgba(0,0,0,.45), 0 0 0 1px var(--border-default)' }}
        >
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-ink">Start a class</h2>
            <p className="text-sm text-ink-secondary">
              The mode is fixed when the class is created. There is no switching it later.
            </p>
          </div>

          <form className="flex flex-col gap-3 md:flex-row md:items-end" onSubmit={(e) => void create(e)}>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-sm text-ink-tertiary">Title</span>
              <Input
                size="lg"
                required
                maxLength={120}
                placeholder="Calculus II"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5 md:w-[260px]">
              <span className="text-sm text-ink-tertiary">Mode</span>
              <Select
                size="lg"
                value={mode}
                options={MODE_OPTIONS}
                onChange={(v) => setMode(v as ClassMode)}
              />
            </label>
            <Button size="lg" type="submit" disabled={creating || title.trim() === ''}>
              {creating ? 'Creating' : 'Start'}
            </Button>
          </form>

          {createError && <Alert tone="danger">{createError}</Alert>}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-ink">Join a class</h2>
          <div className="flex flex-col gap-2 md:flex-row">
            <Input
              size="lg"
              className="flex-1"
              placeholder="Paste a class link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
            <Button
              size="lg"
              variant="secondary"
              disabled={roomIdFromLink(link) === ''}
              onClick={() => navigate(`/c/${roomIdFromLink(link)}`)}
            >
              Join
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-ink">Your classes</h2>

          {listError && <Alert tone="danger">{listError}</Alert>}
          {rooms === null && !listError && <Spinner />}
          {rooms?.length === 0 && (
            <p className="text-base text-ink-secondary">
              Nothing yet. The class you start above will appear here.
            </p>
          )}

          <ul className="flex flex-col gap-2">
            {rooms?.map((room) => (
              <li
                key={room.id}
                className="flex items-center gap-3 rounded-xl bg-card px-4 py-3"
                style={{ boxShadow: '0 0 0 1px var(--border-default)' }}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-base font-medium text-ink">{room.title}</span>
                  <span className="truncate text-sm text-ink-tertiary">{room.roomId}</span>
                </div>
                <Badge tone={room.mode === 'lecture' ? 'primary' : 'neutral'}>{room.mode}</Badge>
                <Button variant="text" onClick={() => void copy(room.roomId)}>
                  {copied === room.roomId ? 'Copied' : 'Copy link'}
                </Button>
                <Button onClick={() => navigate(`/c/${room.roomId}`)}>Open</Button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
