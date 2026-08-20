/* One logger for the seam, so unrecognised SDK shapes are greppable during a
   two-browser test instead of scattered across ad hoc console calls. */

const TAG = '[sdk]'

export function warn(message: string, ...detail: unknown[]) {
  console.warn(`${TAG} ${message}`, ...detail)
}

export function error(message: string, ...detail: unknown[]) {
  console.error(`${TAG} ${message}`, ...detail)
}
