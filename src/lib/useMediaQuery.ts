import { useSyncExternalStore } from 'react'

/* A media query as reactive state.

   useSyncExternalStore rather than useState + useEffect so the first paint
   already knows the answer. The alternative renders the wide layout for one
   frame on a narrow window, and on this screen that frame is the side panel
   shoving the board below its usable width and back again. */
export function useMediaQuery(query: string) {
  const subscribe = (onChange: () => void) => {
    const mql = window.matchMedia(query)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    /* Server snapshot. There is no SSR here, but the argument is required
       and guessing `true` would flip the layout on hydration. */
    () => false,
  )
}
