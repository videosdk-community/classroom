import { CtrlBtn } from './CtrlBtn'
import { PhoneControlBar } from './PhoneControlBar'
import { RoomIcon } from './icons'
import { Toggle } from '../design/ui'
import { useDeviceClass } from '../lib/useDeviceClass'
import type { ClassMode } from '../domain/classroom'

/* The control bar. Everything the spec's room surface names: self controls,
   the board, teacher controls, panel toggles, leave.

   Screen share sits with the teacher controls rather than with the self
   controls, next to the board it displaces. It is the one control here that
   takes centre stage away from the board, so it reads as a teaching decision
   and not as a personal media toggle like the mic. */

export type PanelKind = 'chat' | 'people' | null

/* In Class the top bar is gone and its contents live out here, flanking the
   controls, so the rail and the board keep the 56px the header used to take.
   Lecture still has the header, and passes no meta. */
export interface ControlBarMeta {
  title: string
  mode: ClassMode
  recording: boolean
  elapsed: string
}

export interface ControlBarProps {
  meta?: ControlBarMeta

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
  /** Whether the LOCAL participant is presenting, not whether anyone is. The
      SDK offers no way to stop someone else's share, so a control lit by
      another person's presence would be a button that cannot do its job. */
  sharingScreen: boolean
  /** Somebody else is presenting. One presenter at a time is the SDK's model,
      so the control disables itself rather than failing on the click. */
  shareTakenBy: string | null
  /** Whether this browser can share a screen at all. getDisplayMedia is
      absent on mobile and tablet browsers, so the control says why it is off
      rather than opening nothing. */
  shareSupported: boolean
  onToggleShare: () => void
  isRecording: boolean
  onToggleRecording: () => void
  onMuteAll: () => void

  chatEnabled: boolean
  onToggleChatEnabled: (next: boolean) => void
  onToggleHandsEnabled: (next: boolean) => void

  panel: PanelKind
  onSetPanel: (next: PanelKind) => void
  participantCount: number
  /** Students knocking. Teacher-only in practice - a student's queue is
      always empty, because only allow_mod receives the event. */
  waitingCount: number

  moreOpen: boolean
  onSetMoreOpen: (next: boolean) => void

  onLeave: () => void
}

export function ControlBar(props: ControlBarProps) {
  if (useDeviceClass() === 'phone') return <PhoneControlBar {...props} />
  return <DesktopControlBar {...props} />
}

function DesktopControlBar({
  meta,
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
  return (
    <div className="relative flex h-16 shrink-0 items-center gap-2 border-t border-line px-3">
      {/* A flex column, not an absolute overlay - the old version centred
          the controls by taking the title out of flow entirely, which let a
          long title run straight through the mic button the moment there
          wasn't room for both. min-w-0 + truncate means this column loses
          the fight for space instead of drawing on top of the buttons next
          to it. */}
      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
        {meta && (
          <>
            {/* Tablet (md-lg) truncates rather than hides - a squeezed title
                still says something, where an absent one says nothing. */}
            <span className="hidden max-w-[120px] truncate text-base font-semibold text-ink md:block lg:max-w-none">
              {meta.title}
            </span>
            <span className="hidden shrink-0 rounded-md bg-inset px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-ink-tertiary md:inline lg:hidden">
              {meta.mode.slice(0, 1)}
            </span>
            <span className="hidden shrink-0 rounded-md bg-inset px-2 py-0.5 text-xs uppercase tracking-wide text-ink-tertiary lg:inline">
              {meta.mode}
            </span>

            {/* Never hidden at any width. A cold student named the absence of a
                recording indicator as the thing that would stop them unmuting
                or turning a camera on, and the recording genuinely does capture
                the board, the ink and live cursors with name tags. */}
            {meta.recording && (
              <span
                className="flex shrink-0 items-center gap-1.5 rounded-pill px-2 py-0.5 text-xs font-semibold uppercase tracking-wide"
                style={{ background: 'var(--danger-bg)', color: 'var(--danger-fg)' }}
              >
                <RoomIcon name="record" size={11} />
                Recording
              </span>
            )}
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
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
      {/* Students only. A teacher raising a hand has nobody to raise it to -
          they are the person the gesture addresses. The Raise hand switch in
          the More popover below is a different control: it governs whether
          the class may raise hands at all. */}
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
          {/* Screen share. Desktop only - getDisplayMedia does not exist on
              mobile browsers, and a control that opens nothing is worse than
              one that says why it is off.

              Teacher-only in the same sense the board control is: any token
              holder can call enableScreenShare, and hiding the button is a
              convention rather than a permission. The difference is that a
              student's share would be visible to the class the moment it
              started, so the honest surface is the stage, which names whoever
              is presenting rather than assuming it is the teacher. */}
          <CtrlBtn
            label={
              sharingScreen
                ? 'Stop sharing your screen'
                : !shareSupported
                  ? 'Screen sharing needs a desktop browser'
                  : shareTakenBy
                    ? `${shareTakenBy} is sharing a screen`
                    : 'Share your screen'
            }
            text="Share"
            active={sharingScreen}
            disabled={!sharingScreen && (!shareSupported || shareTakenBy !== null)}
            onClick={onToggleShare}
          >
            <RoomIcon name="share" size={18} />
          </CtrlBtn>
          {/* Red while recording, because it matches the badge the top bar
              shows the whole class. The state comes from the SDK's own
              recording event rather than from a local flag, so the control is
              already lit during RECORDING_STARTING and cannot be double-fired
              through the transition. */}
          <CtrlBtn
            label={isRecording ? 'Stop recording' : 'Start recording'}
            text={isRecording ? 'Stop' : 'Record'}
            danger={isRecording}
            onClick={onToggleRecording}
          >
            <RoomIcon name="record" size={18} />
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
          label={waitingCount > 0 ? `${waitingCount} waiting to join` : 'Participants'}
          active={panel === 'people'}
          onClick={() => onSetPanel(panel === 'people' ? null : 'people')}
        >
          <RoomIcon name="users" size={18} />
        </CtrlBtn>
        {/* The count turns into the waiting count and takes the accent when
            somebody is knocking. A teacher with the panel closed and the
            board full-screen needs the control itself to carry the news. */}
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
      </div>
      <CtrlBtn
        label={chatEnabled ? 'Chat' : 'Chat is off for this class'}
        active={panel === 'chat'}
        onClick={() => onSetPanel(panel === 'chat' ? null : 'chat')}
      >
        <RoomIcon name="chat" size={18} />
      </CtrlBtn>

      <div className="mx-2 h-6 w-px bg-line" />

      {/* The teacher's exit closes the room for everyone, so the button says
          so. "Leave" on a control that ends the class for forty people is a
          lie the first teacher finds out about the hard way. */}
      <CtrlBtn
        label={isTeacher ? 'End class for everyone' : 'Leave class'}
        text={isTeacher ? 'End' : 'Leave'}
        danger
        onClick={onLeave}
      >
        <RoomIcon name="phoneOff" size={18} />
      </CtrlBtn>
      </div>

      {/* The clock counts from the moment this participant mounted, not from
          when the class actually started, because the SDK gives us no session
          start time to anchor on. justify-end mirrors the title column on the
          other side, so the two shrink symmetrically and the button row stays
          centred. */}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2 overflow-hidden text-sm text-ink-tertiary whitespace-nowrap">
        {meta && (
          <div className="hidden items-center gap-2 sm:flex">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-pill"
              style={{ background: 'var(--red-600)' }}
            />
            {/* "Live" drops on tablet - the dot plus the number is the part
                that is actually load-bearing. */}
            <span className="hidden font-medium text-ink-secondary lg:inline">Live</span>
            {meta.elapsed}
          </div>
        )}
      </div>

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
            Chat, hands and the board are broadcast state each client honors.
            Only muting is enforced server-side.
          </div>
        </div>
      )}
    </div>
  )
}
