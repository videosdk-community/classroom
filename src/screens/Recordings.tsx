import { useEffect, useState } from 'react'
import { PageShell } from '../components/PageShell'
import { RecordingList } from '../components/RecordingList'
import { SectionHeader } from '../components/SectionHeader'
import { listMyRecordings, type Recording } from '../lib/recordings'

/* Every recording of a class you own. */

const ALL = 50

export function Recordings() {
  const [recordings, setRecordings] = useState<Recording[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void listMyRecordings(ALL)
      .then(setRecordings)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Your recordings could not be loaded.'),
      )
  }, [])

  return (
    <PageShell>
      <SectionHeader title="Recordings" count={recordings?.length} />
      <RecordingList
        recordings={recordings}
        error={error}
        emptyText="No recordings yet. A class you record appears here a minute or two after it ends."
      />
    </PageShell>
  )
}
