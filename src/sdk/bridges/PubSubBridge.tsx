import { useEffect, useRef } from 'react'
import { usePubSub } from '@videosdk.live/react-sdk'
import { normalisePubSubMessage } from '../normalise'
import type { RoomStore } from '../store'

/* One subscription per topic, mounted once each. */

export function PubSubBridge({
  topic,
  store,
  persist,
}: {
  topic: string
  store: RoomStore
  persist: boolean
}) {
  const { publish } = usePubSub(topic, {
    onMessageReceived(message) {
      store.appendMessages(topic, [normalisePubSubMessage(message, topic)])
    },
    /* Late joiners get history here, which is how a persisted CLASS_CONTROLS
       topic reaches a student who arrives after the teacher toggled it. */
    onOldMessagesReceived(messages) {
      store.appendMessages(
        topic,
        (messages ?? []).map((m) => normalisePubSubMessage(m, topic)),
      )
    },
  })

  /* Updated in an effect, not during render - see MeetingBridge for why.
     publish is only ever called from an event handler. */
  const publishRef = useRef(publish)
  useEffect(() => {
    publishRef.current = publish
  })

  useEffect(() => {
    const existing = store.getActions()
    if (!existing) return
    store.setActions({
      ...existing,
      publish: async (t, text, shouldPersist) => {
        if (t !== topic) return
        /* The options object is declared as a REQUIRED positional parameter,
           so `publish(text)` fails tsc even though the runtime allows it.
           Always passed explicitly. */
        await publishRef.current(text, { persist: shouldPersist })
      },
    })
  }, [store, topic, persist])

  return null
}
