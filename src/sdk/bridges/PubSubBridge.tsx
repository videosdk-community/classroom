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

  useEffect(
    () =>
      store.registerPublisher(topic, async (text, payload) => {
        /* The options object is declared as a REQUIRED positional parameter,
           so `publish(text)` fails tsc even though the runtime allows it.
           Always passed explicitly. `payload` is the third argument and is
           only sent when there is one. */
        await publishRef.current(text, { persist }, payload)
      }),
    [store, topic, persist],
  )

  return null
}
