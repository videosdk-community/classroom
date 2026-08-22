import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Avatar, Button, Input, Tooltip, cn } from '../design/ui'
import { RoomIcon, type IconName } from '../components/icons'
import { ClassList } from '../components/ClassList'
import { RecordingList } from '../components/RecordingList'
import { SectionHeader } from '../components/SectionHeader'
import { useAuth } from '../auth/context'
import { supabase } from '../lib/supabase'
import { createRoom, listMyRooms, type Room } from '../lib/rooms'
import { listMyRecordings, type Recording } from '../lib/recordings'
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

/* Home is a summary, not an archive: three of each, and everything else is
   one click away on its own page.

   Recordings are fetched one over the preview so "View all" can appear on
   evidence rather than on a guess - the count VideoSDK reports is per room,
   not per account, so there is no total to ask for. */
const PREVIEW = 3

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

  const [recordings, setRecordings] = useState<Recording[] | null>(null)
  const [recordingsError, setRecordingsError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [mode, setMode] = useState<ClassMode>('class')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [name, setName] = useState(() => readDisplayName(user))
  const [editingName, setEditingName] = useState(false)

  /* A guest has no email to show, and nothing to sign out of that would do
     them any good - the auth.users row survives a sign-out, so their classes
     would survive too, as rows with an owner nobody can ever be again.

     So a guest is not offered an exit, they are offered an upgrade. "Sign in"
     goes to the sign-in screen, which recognises a signed-in guest and links
     an email to the account they already have rather than making a new one.
     Same user id, same classes. */
  const isGuest = user?.is_anonymous === true
  const account = isGuest ? 'Guest account' : (user?.email ?? '')

  const [joining, setJoining] = useState(false)
  const [link, setLink] = useState('')

  /* One field serves both modes, so the toggle has to move the caret into it
     itself - nothing unmounts and remounts to carry autoFocus. */
  const fieldRef = useRef<HTMLInputElement>(null)

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

  /* Recordings are a separate fetch on purpose. They go through api/ and out
     to VideoSDK, so they land after the class list does - and a slow or dead
     recordings call must not keep the classes off the screen. */
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void listMyRecordings(PREVIEW + 1)
      .then(setRecordings)
      .catch((err: unknown) =>
        setRecordingsError(
          err instanceof Error ? err.message : 'Your recordings could not be loaded.',
        ),
      )
  }, [])

  const create = async () => {
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

  /* The command line is one control in two modes, so it is one form with one
     submit. Which branch runs is the only thing `joining` decides. */
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (joining) {
      join()
      return
    }
    void create()
  }

  return (
    <div className="h-full overflow-y-auto bg-canvas">
      <header className="sticky top-0 z-10 h-14 border-b border-hairline bg-canvas/80 backdrop-blur">
        <div className="mx-auto flex h-full w-full max-w-[760px] items-center justify-between gap-4 px-6">
          {/* min-w-0 plus a truncating label: below ~360px the two groups
              would otherwise overlap rather than give way. */}
          <div className="flex min-w-0 items-center gap-3">
            <img src={wordmark} alt="VideoSDK" className="h-3.5 shrink-0" />
            {/* On a phone the account block takes the room this needs, and a
                product name shaved to "Clas..." is worse than the wordmark
                alone - the h1 underneath says where you are. */}
            <span className="hidden h-4 w-px shrink-0 bg-hairline sm:block" />
            <span className="hidden truncate text-base font-medium text-ink sm:inline">
              Classroom
            </span>
          </div>
          {/* The name the class sees is account identity, not part of
              starting a class, so it lives with the avatar. Click it to edit;
              it writes through on every keystroke, so there is nothing to
              save and nothing to lose by clicking away. */}
          <div className="flex shrink-0 items-center gap-2">
            <Avatar size="sm" name={name || account} />
            {editingName ? (
              <Input
                autoFocus
                size="sm"
                className="w-[140px] sm:w-[180px]"
                maxLength={60}
                aria-label="Your name"
                placeholder="How the class sees you"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  writeDisplayName(e.target.value)
                }}
                onBlur={() => setEditingName(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false)
                }}
              />
            ) : (
              <Tooltip
                placement="bottom"
                label={`${account} - click to change the name the class sees`}
              >
                <Button
                  variant="text"
                  className="max-w-[7rem] [&>span]:truncate sm:max-w-[12rem]"
                  onClick={() => setEditingName(true)}
                >
                  {name || 'Add your name'}
                </Button>
              </Tooltip>
            )}
            {/* Pulled right by its own padding so the label lines up with the
                page gutter rather than sitting 12px inside it. */}
            {isGuest ? (
              <Button
                variant="text"
                className="-mr-3"
                onClick={() => navigate('/signin?next=%2F')}
              >
                Sign in
              </Button>
            ) : (
              <Button
                variant="text"
                className="-mr-3"
                onClick={() => void supabase.auth.signOut()}
              >
                Sign out
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[760px] flex-col px-6 pt-8 pb-16 sm:pt-12">
        {/* The one authored entrance on this screen. The list rows below land
            without it, so the composer is the thing that arrives. */}
        <form className="vsdk-enter flex flex-col" onSubmit={submit}>
          {/* The role is not a choice here, it is a consequence: the room's
              owner is the teacher and everyone else knocks as a student. The
              heading says which one this line is about to make you. */}
          <h1 className="flex flex-wrap items-baseline gap-x-3 text-4xl font-semibold tracking-tight text-ink">
            {joining ? 'Join a class' : 'Start a class'}
            <span className="text-lg font-normal tracking-normal text-ink-tertiary">
              {joining ? 'as student' : 'as teacher'}
            </span>
          </h1>

          {/* One elevation, and it is the hairline: an inset ring that
              thickens to the focus colour when anything inside has focus, so
              the whole line reads as a single control without shifting layout
              the way a border swap would. */}
          <div
            className={cn(
              'mt-5 flex flex-col gap-2 rounded-2xl bg-card p-2 sm:h-16 sm:flex-row sm:items-center sm:gap-3',
              'shadow-[inset_0_0_0_1px_var(--border-default)]',
              'focus-within:shadow-[inset_0_0_0_1.5px_var(--focus-ring)]',
              'transition-[box-shadow] duration-[120ms] ease-standard',
            )}
          >
            <input
              required
              ref={fieldRef}
              maxLength={joining ? 200 : 120}
              placeholder={joining ? 'Paste a class link, or just the class id' : 'Calculus II'}
              aria-label={joining ? 'Class link or class id' : 'Class title'}
              value={joining ? link : title}
              onChange={(e) => (joining ? setLink(e.target.value) : setTitle(e.target.value))}
              className={cn(
                'min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 outline-none sm:py-0',
                'text-xl text-ink placeholder:text-ink-tertiary',
              )}
            />

            {/* The mode belongs to a class being created. Joining one that
                already exists cannot change it, so the switcher leaves rather
                than sitting there disabled. */}
            <span className={cn('hidden h-7 w-px bg-hairline sm:block', joining && 'sm:hidden')} />

            <div
              hidden={joining}
              role="radiogroup"
              aria-label="Mode"
              className={cn(
                'flex shrink-0 items-center gap-1 rounded-pill bg-inset p-1 max-sm:w-full',
                joining && 'hidden',
              )}
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
              disabled={
                joining ? roomIdFromLink(link) === '' : creating || title.trim() === ''
              }
            >
              {joining ? 'Join' : creating ? 'Creating' : 'Start'}
            </Button>
          </div>

          {/* The note and the join affordance share the line under the
              command line: one says what starting a class costs, the other is
              the way out of starting one at all. */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-1">
            <p className="text-sm text-ink-tertiary">
              {joining
                ? 'A full link works, and so does the class id on its own.'
                : 'The mode is fixed when the class is created. There is no switching it later.'}
            </p>
            <Button
              variant="link"
              className="shrink-0 whitespace-normal text-left"
              onClick={() => {
                setJoining(!joining)
                /* The caret follows the mode. Focus left behind on a field
                   that just changed what it means is a keyboard dead end. */
                window.setTimeout(() => fieldRef.current?.focus(), 0)
              }}
            >
              {joining ? 'Start a class instead' : 'Join a class with a link'}
            </Button>
          </div>
        </form>

        {createError && (
          <div className="mt-4">
            <Alert tone="danger">{createError}</Alert>
          </div>
        )}

        <section className="mt-10 flex flex-col gap-3">
          <SectionHeader
            title="Your classes"
            count={rooms?.length}
            action={
              rooms &&
              rooms.length > PREVIEW && (
                <Button variant="text" onClick={() => navigate('/classes')}>
                  View all
                </Button>
              )
            }
          />
          <ClassList
            rooms={rooms ? rooms.slice(0, PREVIEW) : null}
            error={listError}
            emptyText="Nothing yet. The class you start above will appear here."
          />
        </section>

        <section className="mt-10 flex flex-col gap-3">
          {/* No count here: the fetch is capped at four, so a badge would
              say "4" for a teacher with forty. The full page counts. */}
          <SectionHeader
            title="Recordings"
            action={
              recordings &&
              recordings.length > PREVIEW && (
                <Button variant="text" onClick={() => navigate('/recordings')}>
                  View all
                </Button>
              )
            }
          />
          <RecordingList
            recordings={recordings ? recordings.slice(0, PREVIEW) : null}
            error={recordingsError}
            emptyText="No recordings yet. A class you record appears here a minute or two after it ends."
          />
        </section>
      </div>
    </div>
  )
}
