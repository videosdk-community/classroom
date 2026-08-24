import { useSyncExternalStore } from 'react'

/* Phone / tablet / desktop, as reactive state.

   A second, independent axis from `ClassMode` (fixed per room) and from
   PANEL_OVERLAY_BREAKPOINT in boardGeometry.ts (board-width arithmetic, not
   device category). This one answers "what kind of screen is this", nothing
   else, and every phone/tablet-specific component keys off it alone.

   768/1024 are not invented here - they are Tailwind v4's own default
   `md`/`lg` breakpoints, unmodified in this project's @theme block. Kept in
   sync with the `md:`/`lg:` classes ControlBar's tablet squeeze uses, so a
   future breakpoint change has to update both on purpose rather than drift.

   useSyncExternalStore rather than useState + useEffect, same reasoning as
   useMediaQuery: the first paint already knows the answer, so a phone never
   renders the desktop tree for one frame first. */

export type DeviceClass = 'phone' | 'tablet' | 'desktop'

export const PHONE_MAX_WIDTH = 767
export const TABLET_MAX_WIDTH = 1023

const TABLET_QUERY = `(min-width: ${PHONE_MAX_WIDTH + 1}px)`
const DESKTOP_QUERY = `(min-width: ${TABLET_MAX_WIDTH + 1}px)`

function classify(isTablet: boolean, isDesktop: boolean): DeviceClass {
  if (isDesktop) return 'desktop'
  if (isTablet) return 'tablet'
  return 'phone'
}

export function useDeviceClass(): DeviceClass {
  const subscribe = (onChange: () => void) => {
    const tablet = window.matchMedia(TABLET_QUERY)
    const desktop = window.matchMedia(DESKTOP_QUERY)
    tablet.addEventListener('change', onChange)
    desktop.addEventListener('change', onChange)
    return () => {
      tablet.removeEventListener('change', onChange)
      desktop.removeEventListener('change', onChange)
    }
  }

  return useSyncExternalStore(
    subscribe,
    () => classify(window.matchMedia(TABLET_QUERY).matches, window.matchMedia(DESKTOP_QUERY).matches),
    /* Server snapshot. No SSR here, but the argument is required - desktop is
       the least disruptive guess since it matches today's only layout. */
    () => 'desktop',
  )
}
