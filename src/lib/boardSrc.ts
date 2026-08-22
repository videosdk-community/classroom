/* Read-only is a parameter on the board's own URL.

   useWhiteboard() carries no permission - it is three members, and none of
   them is a role - so this was written down as "the board has no permission
   model" until the hosted board turned out to honour drawOnWhiteboard=false.
   It is the same lever Prebuilt documents as permissions.drawOnWhiteboard,
   undocumented on the React path.

   Measured on 2026-08-22 against a live board. Read-only drops the toolbar and
   the style panel, refuses every stroke, and leaves the page menu, the zoom
   menu and the minimap toggle behind. Pointer panning and ctrl-wheel zoom die
   with the toolbar, but the bottom-left zoom menu still works - zoom to fit is
   how a student reaches work the teacher drew off-screen.

   The URL arrives as https://whiteboard.videosdk.live?roomId=... - a bare host
   with a query and no path. searchParams normalises that to a trailing slash,
   which the board accepts; string concatenation is avoided because nothing
   guarantees the query stays non-empty. */
export function boardSrc(url: string, canDraw: boolean): string {
  if (canDraw) return url
  const next = new URL(url)
  next.searchParams.set('drawOnWhiteboard', 'false')
  return next.toString()
}
