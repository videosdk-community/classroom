import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../design/ui'
import wordmark from '../assets/videosdk-wordmark-white.svg'

/* The frame the secondary pages share: same canvas, same sticky bar, same
   760px column as home, with a way back instead of the account block. */

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="h-full overflow-y-auto bg-canvas">
      <header className="sticky top-0 z-10 h-14 border-b border-hairline bg-canvas/80 backdrop-blur">
        <div className="mx-auto flex h-full w-full max-w-[760px] items-center justify-between gap-4 px-6">
          <div className="flex min-w-0 items-center gap-3">
            <img src={wordmark} alt="VideoSDK" className="h-3.5 shrink-0" />
            <span className="hidden h-4 w-px shrink-0 bg-hairline sm:block" />
            <span className="hidden truncate text-base font-medium text-ink sm:inline">
              Classroom
            </span>
          </div>
          <Link to="/" className="shrink-0">
            <Button variant="text">Back</Button>
          </Link>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[760px] px-6 pt-10 pb-16">
        <section className="flex flex-col gap-3">{children}</section>
      </div>
    </div>
  )
}
