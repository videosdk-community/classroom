import { CtrlBtn } from './CtrlBtn'
import { RoomIcon, type IconName } from './icons'
import { BottomSheet, Toggle } from '../design/ui'
import type { ControlBarProps } from './ControlBar'

/* The phone control bar. A different button set from desktop's, not a
   CSS-hidden subset of it - the fixed order is a product decision (student:
   Mic, Camera, Hand, More, End; teacher: Mic, Camera, More, End), and hiding
   desktop buttons with Tailwind would leave dead DOM taking up space on the
   most cramped surface in the app.

   Everything else desktop's control bar carries - Chat, Participants, the
   board, screen share, recording, mute-all, plus the teacher "more"
   popover's own two toggles - flattens into one BottomSheet. Desktop's
   two-tier structure (bar -> nested popover) has no room to nest again
   inside a sheet on a phone. */

function SheetRow({
  icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: IconName
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-40"
      style={active ? { background: 'var(--surface-raised)' } : undefined}
    >
      <RoomIcon name={icon} size={18} className="text-ink-secondary" />
      <span className="flex-1 text-base text-ink">{label}</span>
    </button>
  )
}

function SheetToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className="flex w-full cursor-pointer items-center gap-3 px-4 py-3">
      <span className="flex-1 text-base text-ink-secondary">{label}</span>
      <Toggle size="sm" checked={checked} onChange={onChange} />
    </label>
  )
}

export function PhoneControlBar({
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
  sharingScreen,
  shareTakenBy,
  shareSupported,
  onToggleShare,
  isRecording,
  onToggleRecording,
  onMuteAll,
  chatEnabled,
  onToggleChatEnabled,
  onToggleHandsEnabled,
  panel,
  onSetPanel,
  participantCount,
  waitingCount,
  moreOpen,
  onSetMoreOpen,
  onLeave,
}: ControlBarProps) {
  const openPanel = (next: 'chat' | 'people') => {
    onSetMoreOpen(false)
    onSetPanel(panel === next ? null : next)
  }

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

      {!isTeacher && (
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
      )}

      <div className="relative">
        <CtrlBtn
          label="More controls"
          active={moreOpen}
          onClick={() => onSetMoreOpen(!moreOpen)}
        >
          <RoomIcon name="more" size={18} />
        </CtrlBtn>
        {(waitingCount > 0 || participantCount > 0) && (
          <span
            className="pointer-events-none absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-pill px-1 text-xs font-semibold"
            style={
              waitingCount > 0
                ? { background: 'var(--primary-500)', color: 'var(--primary-on)' }
                : { background: 'var(--surface-raised)', color: 'var(--text-secondary)' }
            }
          >
            {waitingCount > 0 ? waitingCount : participantCount}
          </span>
        )}
      </div>

      <CtrlBtn label={isTeacher ? 'End class for everyone' : 'Leave class'} danger onClick={onLeave}>
        <RoomIcon name="phoneOff" size={18} />
      </CtrlBtn>

      <BottomSheet open={moreOpen} onClose={() => onSetMoreOpen(false)} title="More controls">
        <SheetRow
          icon="chat"
          label={chatEnabled ? 'Chat' : 'Chat is off for this class'}
          active={panel === 'chat'}
          onClick={() => openPanel('chat')}
        />
        <SheetRow
          icon="users"
          label={waitingCount > 0 ? `Participants - ${waitingCount} waiting` : 'Participants'}
          active={panel === 'people'}
          onClick={() => openPanel('people')}
        />

        {isTeacher && (
          <>
            <div className="border-t border-line" />
            <SheetRow
              icon="board"
              label={boardOn ? 'Stop the whiteboard' : 'Start the whiteboard'}
              active={boardOn}
              disabled={boardBusy}
              onClick={onToggleBoard}
            />
            <SheetRow
              icon="share"
              label={
                sharingScreen
                  ? 'Stop sharing your screen'
                  : !shareSupported
                    ? 'Screen sharing needs a desktop browser'
                    : shareTakenBy
                      ? `${shareTakenBy} is sharing a screen`
                      : 'Share your screen'
              }
              active={sharingScreen}
              disabled={!sharingScreen && (!shareSupported || shareTakenBy !== null)}
              onClick={onToggleShare}
            />
            <SheetRow
              icon="record"
              label={isRecording ? 'Stop recording' : 'Start recording'}
              active={isRecording}
              onClick={onToggleRecording}
            />
            <SheetRow icon="muteAll" label="Mute everyone" onClick={onMuteAll} />

            <div className="border-t border-line" />
            <SheetToggleRow
              label="Chat enabled"
              checked={chatEnabled}
              onChange={onToggleChatEnabled}
            />
            <SheetToggleRow
              label="Raise hand enabled"
              checked={handsEnabled}
              onChange={onToggleHandsEnabled}
            />
          </>
        )}
      </BottomSheet>
    </div>
  )
}
