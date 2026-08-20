import { useEffect, useRef } from 'react'

/* A live level bar for the selected microphone.

   Worth its forty lines: it is the only thing on the screen that proves the
   chosen mic is actually producing audio. "My mic was on the wrong device" is
   the precall failure people actually hit, and a picker alone cannot show it.

   The level is written straight to the DOM node rather than held in state.
   This updates every animation frame, and routing sixty re-renders a second
   through React to move one bar would re-render the whole precall screen for
   no benefit. */

export function MicMeter({ stream }: { stream: MediaStream | undefined }) {
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const bar = barRef.current
    if (!bar) return

    if (!stream || stream.getAudioTracks().length === 0) {
      bar.style.width = '0%'
      return
    }

    const ctx = new AudioContext()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser)

    const buf = new Uint8Array(analyser.frequencyBinCount)
    let frame = 0

    const tick = () => {
      analyser.getByteTimeDomainData(buf)
      let peak = 0
      for (const v of buf) peak = Math.max(peak, Math.abs(v - 128))
      bar.style.width = `${Math.round(Math.min(1, peak / 64) * 100)}%`
      frame = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      cancelAnimationFrame(frame)
      source.disconnect()
      void ctx.close()
    }
  }, [stream])

  return (
    <div className="flex items-center gap-2" aria-hidden>
      <div className="h-1.5 flex-1 overflow-hidden rounded-pill bg-inset">
        <div
          ref={barRef}
          className="h-full w-0 rounded-pill"
          style={{ background: 'var(--primary-button)' }}
        />
      </div>
    </div>
  )
}
