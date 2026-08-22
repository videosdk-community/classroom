import { useEffect, useState } from 'react'
import { PageShell } from '../components/PageShell'
import { ClassList } from '../components/ClassList'
import { SectionHeader } from '../components/SectionHeader'
import { listMyRooms, type Room } from '../lib/rooms'

/* Every class you own. Home shows the three most recent; this is the rest of
   them, with the same rows and the same behaviour. */

export function Classes() {
  const [rooms, setRooms] = useState<Room[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void listMyRooms()
      .then(setRooms)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Your classes could not be loaded.'),
      )
  }, [])

  return (
    <PageShell>
      <SectionHeader title="Your classes" count={rooms?.length} />
      <ClassList
        rooms={rooms}
        error={error}
        emptyText="Nothing yet. The class you start on the home page will appear here."
      />
    </PageShell>
  )
}
