import { useState } from 'react'
import { RoomIcon } from './icons'
import { Input } from '../design/ui'
import type { ChatMessage } from '../domain/classroom'

/* Chat, on an unpersisted pubsub topic.

   Keys are synthesised at the seam. A message's wire id is built as
   `messageId || ""`, so the hazard is not an absent field but an empty
   string: falsy, equal to every other empty string, and `key={m.id}` collides
   silently instead of failing loudly.

   This list renders in arrival order and never sorts. `timestamp`'s clock
   domain is not established, and sorting a live conversation by an untrusted
   clock reorders it in front of the class. */

export interface ChatPanelProps {
  messages: ChatMessage[]
  /** False once the teacher turns chat off. The teacher's own composer stays
      live: the toggle is aimed at the class, not at whoever pressed it. */
  enabled: boolean
  onSend: (text: string) => Promise<void>
}

export function ChatPanel({ messages, enabled, onSend }: ChatPanelProps) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const text = draft.trim()
  const canSend = enabled && text !== '' && !sending

  /* Cleared only after the publish resolves. Clearing on click looks faster
     and loses the message when the publish throws. */
  const send = async () => {
    if (!canSend) return
    setSending(true)
    try {
      await onSend(text)
      setDraft('')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.mine ? 'items-end' : 'items-start'}`}>
            {!m.mine && <span className="mb-0.5 px-1 text-sm text-ink-tertiary">{m.who}</span>}
            <div
              className="max-w-[85%] px-2.5 py-1.5 text-base leading-[18px]"
              style={
                m.mine
                  ? {
                      background: 'var(--primary-button)',
                      color: 'var(--on-primary)',
                      borderRadius: '12px 12px 4px 12px',
                    }
                  : {
                      background: 'var(--surface-inset)',
                      color: 'var(--text-secondary)',
                      borderRadius: '12px 12px 12px 4px',
                    }
              }
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>

      {/* h-16 matches the control bar in the main column, so the two border-t
          lines meet across the panel seam instead of missing by a dozen px. */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-t border-line px-2">
        <Input
          size="lg"
          className="flex-1"
          disabled={!enabled}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void send()
          }}
          placeholder={enabled ? 'Message the class' : 'Chat is off for this class'}
        />
        <button
          type="button"
          disabled={!canSend}
          onClick={() => void send()}
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-ink-tertiary hover:bg-raised hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RoomIcon name="send" size={16} />
        </button>
      </div>
    </>
  )
}
