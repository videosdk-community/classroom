import { useState } from 'react'
import { RoomIcon } from './icons'
import { Input } from '../design/ui'
import type { ChatMessage } from '../fixtures/classroom'

/* Chat. Step 4 replaces the fixture list with a persisted pubsub topic, at
   which point two things here become load-bearing: pubsub messages carry no
   id field, so keys are synthesised at the seam rather than here; and the
   timestamp's clock domain is unestablished, so this list renders in arrival
   order and never sorts. */

export interface ChatPanelProps {
  messages: ChatMessage[]
  enabled: boolean
}

export function ChatPanel({ messages, enabled }: ChatPanelProps) {
  const [draft, setDraft] = useState('')

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
          placeholder={enabled ? 'Message the class' : 'Chat is off for this class'}
        />
        <button
          type="button"
          disabled={!enabled || draft.trim() === ''}
          onClick={() => setDraft('')}
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-ink-tertiary hover:bg-raised hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RoomIcon name="send" size={16} />
        </button>
      </div>
    </>
  )
}
