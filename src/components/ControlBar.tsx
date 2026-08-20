import { CtrlBtn } from './CtrlBtn'
import { RoomIcon } from './icons'
import { Toggle } from '../design/ui'

/* The control bar. Everything the spec's room surface names: self controls,
   the board, teacher controls, panel toggles, leave.

   Screen share is deliberately absent. It competes with the board for centre
   stage, and the board is the whole point of this product. */

export type PanelKind = 'chat' | 'people' | null

export interface ControlBarProps {
  micOn: boolean
  camOn: boolean
  camDisabled?: boolean
  onToggleMic: () => void
  onToggleCam: () => void

  handRaised: boolean
  handsEnabled: boolean
  onToggleHand: () => void

  isTeacher: boolean
  boardOn: boolean
  boardBusy: boolean
  onToggleBoard: () => void
  onMuteAll: () => void

  chatEnabled: boolean
  onToggleChatEnabled: (next: boolean) => void
  onToggleHandsEnabled: (next: boolean) => void

  panel: PanelKind
  onSetPanel: (next: PanelKind) => void
  participantCount: number

  moreOpen: boolean
  onSetMoreOpen: (next: boolean) => void

  onLeave: () => void
}

export function ControlBar({
  micOn,
  camOn,
  camDisabled,
  onToggleMic,
  onToggleCam,
  handRaised,
  handsEnabled,
  onToggleHand,
  isTeacher,
  boardOn,
  boardBusy,
  onToggleBoard,
  onMuteAll,
  chatEnabled,
  onToggleChatEnabled,
  onToggleHandsEnabled,
  panel,
  onSetPanel,
  participantCount,
  moreOpen,
  onSetMoreOpen,
  onLeave,
}: ControlBarProps) {
  return (
    <div className="relative flex h-16 shrink-0 items-center justify-center gap-2 border-t border-line px-3">
      <CtrlBtn
        label={micOn ? 'Mute yourself' : 'Unmute yourself'}
        off={!micOn}
        onClick={onToggleMic}
      >
        <RoomIcon name={micOn ? 'mic' : 'micOff'} size={18} />
      </CtrlBtn>
      <CtrlBtn
        label={camOn ? 'Turn camera off' : 'Turn camera on'}
        off={!camOn}
        disabled={camDisabled}
        onClick={onToggleCam}
      >
        <RoomIcon name={camOn ? 'cam' : 'camOff'} size={18} />
      </CtrlBtn>
      <CtrlBtn
        label={
          !handsEnabled
            ? 'Hand raising is off for this class'
            : handRaised
              ? 'Lower your hand'
              : 'Raise your hand'
        }
        active={handRaised}
        disabled={!handsEnabled}
        onClick={onToggleHand}
      >
        <RoomIcon name="hand" size={18} />
      </CtrlBtn>

      <div className="mx-2 h-6 w-px bg-line" />

      {/* The board control is a UI convention, not a permission. Any
          participant with a meeting token can start or stop the board, so
          this is hidden from students rather than gated - and the copy on
          the stage says plainly that everyone can draw. */}
      {isTeacher && (
        <>
          <CtrlBtn
            label={boardOn ? 'Stop the whiteboard' : 'Start the whiteboard'}
            text="Whiteboard"
            active={boardOn}
            /* 4056 WHITEBOARD_OPERATION_IN_PROGRESS: the SDK rejects a second
               start/stop while one is in flight, so the control disables
               itself rather than letting the class double-toggle it. */
            disabled={boardBusy}
            onClick={onToggleBoard}
          >
            <RoomIcon name="board" size={18} />
          </CtrlBtn>
          <CtrlBtn label="Mute everyone" text="Mute all" onClick={onMuteAll}>
            <RoomIcon name="muteAll" size={18} />
          </CtrlBtn>
          <CtrlBtn
            label="More teacher controls"
            active={moreOpen}
            onClick={() => onSetMoreOpen(!moreOpen)}
          >
            <RoomIcon name="more" size={18} />
          </CtrlBtn>

          <div className="mx-2 h-6 w-px bg-line" />
        </>
      )}

      <div className="relative">
        <CtrlBtn
          label="Participants"
          active={panel === 'people'}
          onClick={() => onSetPanel(panel === 'people' ? null : 'people')}
        >
          <RoomIcon name="users" size={18} />
        </CtrlBtn>
        <span
          className="pointer-events-none absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-pill px-1 text-xs font-semibold"
          style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}
        >
          {participantCount}
        </span>
      </div>
      <CtrlBtn
        label={chatEnabled ? 'Chat' : 'Chat is off for this class'}
        active={panel === 'chat'}
        onClick={() => onSetPanel(panel === 'chat' ? null : 'chat')}
      >
        <RoomIcon name="chat" size={18} />
      </CtrlBtn>

      <div className="mx-2 h-6 w-px bg-line" />

      <CtrlBtn label="Leave class" text="Leave" danger onClick={onLeave}>
        <RoomIcon name="phoneOff" size={18} />
      </CtrlBtn>

      {moreOpen && isTeacher && (
        <div
          className="absolute bottom-[60px] left-1/2 z-20 w-[280px] -translate-x-1/2 overflow-hidden rounded-xl border border-line-strong bg-card"
          style={{ boxShadow: 'var(--elevation-popover)' }}
        >
          <div className="px-3 pb-1 pt-2 text-xs uppercase tracking-wide text-ink-tertiary">
            Teacher controls
          </div>

          <label className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 hover:bg-raised">
            <span className="flex-1 text-base text-ink-secondary">Chat</span>
            <Toggle size="sm" checked={chatEnabled} onChange={onToggleChatEnabled} />
          </label>
          <label className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 hover:bg-raised">
            <span className="flex-1 text-base text-ink-secondary">Raise hand</span>
            <Toggle size="sm" checked={handsEnabled} onChange={onToggleHandsEnabled} />
          </label>

          {/* Said plainly, here and in DECISIONS.md, because it is true and
              because a later reviewer should not have to rediscover it. */}
          <div className="border-t border-line px-3 py-2 text-xs leading-[15px] text-ink-tertiary">
            Broadcast state each client honors. Only muting is enforced server-side.
          </div>
        </div>
      )}
    </div>
  )
}
