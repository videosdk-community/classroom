import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Avatar, Badge, Button, Input, Skeleton, Tooltip, cn } from '../design/ui'
import { RoomIcon, type IconName } from '../components/icons'
import { useAuth } from '../auth/context'
import { supabase } from '../lib/supabase'
import { classLink, createRoom, listMyRooms, type Room } from '../lib/rooms'
import { readDisplayName, writeDisplayName } from '../lib/displayName'
import type { ClassMode } from '../domain/classroom'
import wordmark from '../assets/videosdk-wordmark-white.svg'

/* Home: start a class, join one, or reopen one you own.

   Composed as one command line rather than a stack of cards. Starting a class
   is a single gesture - type the title, pick the mode, press Start - so the
   screen is that one control, and everything else sits quietly under it. The
   name field and the join field are secondary lines because they are the
   exception, not the path.

   The room list is read straight from Supabase under RLS rather than through
   api/. The owner-scoped select policy exists for exactly this, and putting
   it on the real path means a mistake in that policy shows up here instead of
   hiding behind the service role.

   Joining by link does NOT preview the room. RLS is per-row, not per-column,
   so "let anyone read the title and mode" is not expressible without making
   the whole table enumerable. The title and mode arrive from api/session.ts
   at join instead, in the same trusted response as the token. */

/* The mode is a two-way choice with real consequences, so it sits on the
   command line itself rather than inside a dropdown: both options are visible
   and each one says what it costs on hover and on focus. The `value`s are the
   wire values and must stay 'class' | 'lecture'. */
const MODE_OPTIONS: { label: string; value: ClassMode; description: string; icon: IconName }[] = [
  { label: 'Class', value: 'class', description: 'Everyone onstage', icon: 'users' },
  { label: 'Lecture', value: 'lecture', description: 'Teacher onstage', icon: 'cam' },
]

/* One state holds all three labels: the id while the copy landed, the id
   behind a `failed:` prefix while it did not, and null the rest of the time. */
function copyLabel(copied: string | null, roomId: string): string {
  if (copied === roomId) return 'Copied'
  if (copied === `failed:${roomId}`) return 'Copy failed'
  return 'Copy link'
}

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

  const [name, setName] = useState(() => readDisplayName(user))

  const [joinOpen, setJoinOpen] = useState(false)
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

  const join = () => {
    const id = roomIdFromLink(link)
    if (id !== '') navigate(`/c/${id}`)
  }

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

  return (
    <div className="h-full overflow-y-auto bg-canvas">
      <header className="sticky top-0 z-10 h-14 border-b border-hairline bg-canvas/80 backdrop-blur">
        <div className="mx-auto flex h-full w-full max-w-[760px] items-center justify-between gap-4 px-6">
          {/* min-w-0 plus a truncating label: below ~360px the two groups
              would otherwise overlap rather than give way. */}
          <div className="flex min-w-0 items-center gap-3">
            <img src={wordmark} alt="VideoSDK" className="h-3.5 shrink-0" />
            {/* Below 360px the account block leaves no room for the product
                name, and a wordmark truncated to "Clas..." is worse than a
                wordmark alone - the h1 underneath says where you are. */}
            <span className="h-4 w-px shrink-0 bg-hairline max-[359px]:hidden" />
            <span className="truncate text-base font-medium text-ink max-[359px]:hidden">
              Classroom
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Avatar size="sm" name={user?.email ?? ''} />
            <span className="hidden text-sm text-ink-tertiary sm:inline">{user?.email}</span>
            {/* Pulled right by its own padding so the label lines up with the
                page gutter rather than sitting 12px inside it. */}
            <Button variant="text" className="-mr-3" onClick={() => void supabase.auth.signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[760px] flex-col px-6 pt-16 pb-16 sm:pt-24">
        {/* The one authored entrance on this screen. The list rows below land
            without it, so the composer is the thing that arrives. */}
        <form className="vsdk-enter flex flex-col" onSubmit={(e) => void create(e)}>
          <h1 className="text-4xl font-semibold tracking-tight text-ink">Start a class</h1>

          {/* One elevation, and it is the hairline: an inset ring that
              thickens to the focus colour when anything inside has focus, so
              the whole line reads as a single control without shifting layout
              the way a border swap would. */}
          <div
            className={cn(
              'mt-5 flex flex-col gap-2 rounded-2xl bg-card p-2 sm:h-16 sm:flex-row sm:items-center sm:gap-1',
              'shadow-[inset_0_0_0_1px_var(--border-default)]',
              'focus-within:shadow-[inset_0_0_0_1.5px_var(--focus-ring)]',
              'transition-[box-shadow] duration-[120ms] ease-standard',
            )}
          >
            <input
              required
              maxLength={120}
              placeholder="Calculus II"
              aria-label="Class title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={cn(
                'min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 outline-none sm:py-0',
                'text-xl text-ink placeholder:text-ink-tertiary',
              )}
            />

            <span className="mx-1 hidden h-7 w-px bg-hairline sm:block" />

            <div
              role="radiogroup"
              aria-label="Mode"
              className="flex shrink-0 items-center gap-0.5 rounded-pill bg-inset p-0.5 max-sm:w-full"
            >
              {MODE_OPTIONS.map((option) => {
                const selected = mode === option.value
                return (
                  /* The flex child here is Tooltip's own wrapper span, so the
                     mobile half-width has to be set on it and not on the
                     button inside. */
                  <span key={option.value} className="flex max-sm:flex-1 max-sm:[&>span]:flex-1">
                    <Tooltip label={option.description}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setMode(option.value)}
                        className={cn(
                          'inline-flex h-8 items-center justify-center gap-1.5 rounded-pill px-3',
                          'text-base font-medium',
                          /* Two halves of one track on a phone; content-width
                             on the desktop command line. */
                          'max-sm:w-full',
                          'border-0 transition-[background,color] duration-[120ms] ease-standard',
                          /* accent-tint is the same light lavender in both
                             themes, so the selected pill carries fixed dark ink
                             rather than text-ink - text-ink is white in dark
                             and would vanish on the fill. */
                          selected
                            ? 'bg-accent-tint text-[var(--primary-900)]'
                            : 'cursor-pointer bg-transparent text-ink-secondary hover:text-ink',
                        )}
                      >
                        <RoomIcon name={option.icon} size={16} />
                        {option.label}
                      </button>
                    </Tooltip>
                  </span>
                )
              })}
            </div>

            <Button
              size="lg"
              type="submit"
              className="shrink-0 max-sm:w-full"
              disabled={creating || title.trim() === ''}
            >
              {creating ? 'Creating' : 'Start'}
            </Button>
          </div>

          <p className="mt-3 px-1 text-sm text-ink-tertiary">
            The mode is fixed when the class is created. There is no switching it later.
          </p>
        </form>

        {createError && (
          <div className="mt-4">
            <Alert tone="danger">{createError}</Alert>
          </div>
        )}

        {/* The two secondary lines. Both are one field wide, sit on the page
            rather than in a container, and stay visually below the command
            line they are the exception to. */}
        <div className="mt-8 flex flex-col gap-4 border-t border-hairline pt-6">
          <label className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="w-28 shrink-0 text-base text-ink-secondary">Your name</span>
            <Input
              className="min-w-0 flex-1 max-sm:basis-full sm:max-w-[280px]"
              maxLength={60}
              placeholder="How the class should see you"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                writeDisplayName(e.target.value)
              }}
            />
          </label>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="w-28 shrink-0 text-base text-ink-secondary">Join a class</span>
            {joinOpen ? (
              <span className="flex min-w-0 flex-1 items-center gap-2 max-sm:basis-full sm:max-w-[400px]">
                <Input
                  /* The reveal moves the caret with it - a field that appears
                     and leaves focus behind is a keyboard dead end. */
                  autoFocus
                  className="min-w-0 flex-1"
                  placeholder="Paste a class link"
                  aria-label="Class link or class id"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') join()
                  }}
                />
                <Button variant="secondary" disabled={roomIdFromLink(link) === ''} onClick={join}>
                  Join
                </Button>
              </span>
            ) : (
              <Button
                variant="link"
                className="whitespace-normal text-left max-sm:basis-full"
                onClick={() => setJoinOpen(true)}
              >
                Paste a class link, or just the class id
              </Button>
            )}
          </div>
        </div>

        <section className="mt-14 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold text-ink">Your classes</h2>
            {rooms && rooms.length > 0 && (
              <Badge tone="neutral" outline>
                {rooms.length}
              </Badge>
            )}
          </div>

          {listError && <Alert tone="danger">{listError}</Alert>}

          {/* Three placeholder rows rather than a spinner, so the list does not
              jump when the real rows land. */}
          {rooms === null && !listError && (
            <ul className="flex flex-col">
              {[0, 1, 2].map((i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 border-b border-hairline px-2 py-3.5 last:border-b-0"
                >
                  <Skeleton circle height={36} />
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Skeleton height={14} width="40%" />
                    <Skeleton height={12} width="24%" />
                  </span>
                </li>
              ))}
            </ul>
          )}

          {rooms?.length === 0 && (
            <p className="border-t border-hairline pt-6 text-base text-ink-secondary">
              Nothing yet. The class you start above will appear here.
            </p>
          )}

          {rooms && rooms.length > 0 && (
            <ul className="flex flex-col">
              {rooms.map((room) => (
                <li
                  key={room.id}
                  className={cn(
                    'group flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-2 py-3',
                    'border-b border-hairline last:border-b-0',
                    'transition-colors duration-[120ms] ease-standard hover:bg-subtle',
                    room.endedAt && 'opacity-60',
                  )}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-inset text-ink-secondary">
                    <RoomIcon name={room.mode === 'lecture' ? 'cam' : 'users'} size={18} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-base font-medium text-ink">{room.title}</span>
                    <span className="truncate font-mono text-sm text-ink-tertiary">
                      {room.roomId}
                    </span>
                  </div>
                  {/* Outline, not filled: the neutral fill is --bg-muted, which in
                      dark resolves to the same value as --surface-card - a filled
                      badge on this row would be an invisible rectangle. */}
                  <span className="shrink-0">
                    {room.endedAt ? (
                      <Badge tone="neutral" outline>
                        ended
                      </Badge>
                    ) : (
                      <Badge tone={room.mode === 'lecture' ? 'primary' : 'neutral'} outline>
                        {room.mode}
                      </Badge>
                    )}
                  </span>
                  {/* An ended room cannot be joined, so offering Open and a
                      link that both dead-end is worse than offering neither.

                      The pair is full width on a phone, so it drops to its own
                      line and the title keeps the one above it rather than
                      being truncated to three letters. */}
                  {!room.endedAt && (
                    <span className="flex shrink-0 items-center gap-1 max-sm:w-full max-sm:justify-end">
                      <Button
                        variant="text"
                        /* Sized for the wider of its two labels: "Copied" is
                           shorter than "Copy link", and without a floor the
                           Open button slides left for the 1.6s it shows. */
                        className="min-w-[5.5rem]"
                        aria-live="polite"
                        onClick={() => void copy(room.roomId)}
                      >
                        {copyLabel(copied, room.roomId)}
                      </Button>
                      <Button variant="secondary" onClick={() => navigate(`/c/${room.roomId}`)}>
                        Open
                      </Button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
