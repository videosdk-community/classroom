/* Shared tile ordering for the rails: pin a caller-chosen front, dedupe, cap.

   The order is not join order - callers pin the faces a viewer actually
   looks for so they never fall off the end of a capped strip. The pin order
   itself is a caller choice (VideoRail pins self first; MobileStrip pins the
   teacher first, per the unified phone strip's "teacher, then your own tile"
   requirement), so this only owns the mechanical part: dedupe and cap. */

export function orderTiles(ids: readonly string[], pinned: readonly (string | null)[], cap: number) {
  const front = pinned.filter((id): id is string => id !== null && ids.includes(id))
  const ordered = [...new Set([...front, ...ids])]
  const shown = ordered.slice(0, cap)
  const hidden = ordered.length - shown.length
  return { shown, hidden }
}
