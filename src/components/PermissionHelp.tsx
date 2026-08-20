import { Alert } from '../design/ui'

/* Recovery instructions for a blocked permission.

   A blocked permission is a one-way door: the browser dialog cannot be
   re-triggered from script, so a "Retry" button here would do nothing at all
   and would make the product look broken rather than blocked. These are
   instructions instead, and they name the actual control, because "check your
   browser settings" is not instructions.

   Reached only from the `blocked` state. A user who merely dismissed the
   dialog stays `askable` and gets the ask button again. */

type Browser = 'chromium' | 'firefox' | 'safari' | 'other'

function detect(): Browser {
  const ua = navigator.userAgent
  if (/Firefox\//.test(ua)) return 'firefox'
  if (/Edg\/|Chrome\/|Chromium\//.test(ua)) return 'chromium'
  if (/Safari\//.test(ua)) return 'safari'
  return 'other'
}

const STEPS: Record<Browser, string[]> = {
  chromium: [
    'Click the camera icon at the right-hand end of the address bar.',
    'Choose "Always allow" for camera and microphone, then reload this page.',
    'No icon there? Settings > Privacy and security > Site settings > Camera.',
  ],
  firefox: [
    'Click the padlock in the address bar.',
    'Under Permissions, clear the blocked entries for Camera and Microphone.',
    'Reload this page and allow when asked.',
  ],
  safari: [
    'Open Safari > Settings > Websites.',
    'Select Camera, then Microphone, and set this site to Allow.',
    'Reload this page.',
  ],
  other: [
    'Open your browser’s site settings for this page.',
    'Allow camera and microphone access.',
    'Reload this page.',
  ],
}

export function PermissionHelp({ onContinue }: { onContinue: () => void }) {
  const steps = STEPS[detect()]

  return (
    <div className="flex w-full max-w-[520px] flex-col gap-4">
      <Alert tone="warning" title="Camera and microphone are blocked">
        Your browser is refusing access, and a page cannot ask again once that has happened. Change
        it here and reload.
      </Alert>

      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-base text-ink-secondary">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>

      {/* Always an exit. A class you can hear is worth more than a dead end,
          and this is the only honest recovery while the door is shut. */}
      <button
        type="button"
        onClick={onContinue}
        className="h-10 cursor-pointer rounded-lg border-0 bg-raised px-4 text-base font-medium text-ink hover:bg-muted"
      >
        Join to listen instead
      </button>
    </div>
  )
}
