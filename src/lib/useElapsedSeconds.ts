import { useEffect, useState } from 'react'

/* Seconds since this hook mounted.

   The lobby needs it because "nobody is answering" is derived and nothing
   sends it. It ticks words, never navigation: a student about to be admitted
   at second 95 must not be ejected at 90, so nothing in this app schedules a
   transition off a timer.

   Mount it where it is needed and unmount it when it is not - there is no
   `active` flag, because parking a clock is what unmounting already does. */
export function useElapsedSeconds(): number {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    /* Wall clock, not a tick count. An interval that fires 60 times is not 60
       seconds - a backgrounded tab throttles timers to once a minute, so a
       student who switched away and came back would find the copy stuck in
       its first tier. */
    const startedAt = Date.now()
    const id = window.setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  return seconds
}
