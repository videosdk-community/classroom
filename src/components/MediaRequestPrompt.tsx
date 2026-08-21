import { RoomIcon } from './icons'
import type { MediaRequest } from '../sdk'

/* "Your teacher asked you to turn your microphone on."

   This is the other half of a teacher's "Ask to unmute". enableMic() and
   enableWebcam() only REQUEST - they fire onMicRequested / onWebcamRequested
   on the target, who decides. There is no force-unmute anywhere in the SDK,
   and without this prompt the request lands on a student who is never told.

   It sits above the control bar rather than floating over the board, because
   the answer is about the two buttons directly below it. */

export interface MediaRequestPromptProps {
  request: MediaRequest
  teacherName: string
  onRespond: (accept: boolean) => void
}

export function MediaRequestPrompt({ request, teacherName, onRespond }: MediaRequestPromptProps) {
  const thing = request.kind === 'mic' ? 'microphone' : 'camera'

  return (
    <div className="flex justify-center px-3 pb-1">
      <div
        className="flex items-center gap-2.5 rounded-pill border border-line-strong bg-card py-1.5 pl-3 pr-1.5"
        style={{ boxShadow: 'var(--elevation-popover)' }}
      >
        <RoomIcon name={request.kind === 'mic' ? 'mic' : 'cam'} size={16} />
        <span className="text-base text-ink-secondary">
          {teacherName} asked you to turn your {thing} on
        </span>

        <button
          type="button"
          onClick={() => onRespond(false)}
          className="h-7 cursor-pointer rounded-pill border border-line-strong bg-transparent px-2.5 text-sm text-ink-secondary hover:bg-raised"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={() => onRespond(true)}
          className="h-7 cursor-pointer rounded-pill border-0 px-2.5 text-sm font-medium"
          style={{ background: 'var(--primary-500)', color: 'var(--primary-on)' }}
        >
          Turn on
        </button>
      </div>
    </div>
  )
}
