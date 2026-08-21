import { useState, type ReactNode } from 'react'
import {
  BOARD_BG,
  BOARD_HARD_FLOOR_WIDTH,
  BOARD_KEEPOUT,
  isBoardBelowFloor,
  useBaseRect,
} from '../lib/boardGeometry'

/* The board region.

   This is a stacking context on purpose: the board itself sits underneath and
   app chrome sits above it. In step 4 the <img> below becomes the SDK's
   whiteboardUrl in an iframe and nothing else in this file changes.

   Step 3 renders the real board rather than a drawing of one. The image is
   the step-0 probe capture, straight out of assets/probe/, so the dark
   surround is being judged against the actual thing and not against a mimic.
   The prototype's mimic put tldraw's tool rail on the left and its style
   panel top-right; both are wrong, and judging a surround against a wrong
   board is how you ship a surround that only works in a screenshot. */

export interface BoardStageProps {
  boardOn: boolean
  /** App chrome that must sit over the board and inside its edges.

      It goes in here rather than in the parent because the board is
      ratio-locked and centred: on a short window the fitted rect is narrower
      than the region around it, so anything anchored to the container hangs
      off the board's edge and into the surround. Rendered in the
      pointer-events-none layer, so an interactive leaf must opt back in. */
  overlay?: ReactNode
  /** Dev-only. Paints the regions tldraw's own furniture occupies, so app
      chrome can be checked against them rather than placed by eye. */
  showKeepout?: boolean
}

export function BoardStage({ boardOn, overlay, showKeepout = false }: BoardStageProps) {
  const { ref, rect } = useBaseRect()
  const [hintDismissed, setHintDismissed] = useState(false)
  const squeezed = isBoardBelowFloor(rect)

  return (
    <div ref={ref} className="relative isolate h-full w-full">
      {rect.width > 0 && (
        <div
          className="absolute overflow-hidden"
          style={{
            left: rect.extraX,
            top: rect.extraY,
            width: rect.width,
            height: rect.height,
            background: BOARD_BG,
            borderRadius: 16,
            /* A deep, soft drop plus a hairline. The board is a white
               rectangle on a near-black room; without the lift it reads as a
               hole punched in the shell rather than a surface sitting on it. */
            boxShadow: '0 24px 64px rgba(0,0,0,.55), 0 0 0 1px var(--border-default)',
          }}
        >
          {boardOn ? (
            <img
              src="/board-probe-1280x720.png"
              alt="Whiteboard"
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-center">
              <span className="text-lg font-semibold" style={{ color: '#3f3f46' }}>
                The board is not open yet
              </span>
              <span className="text-base" style={{ color: '#71717a' }}>
                Your teacher starts it for the class.
              </span>
            </div>
          )}

          {/* Overlay chrome. Positions are fractions of the base rect rather
              than pixels, so this lands identically on a 13-inch laptop and a
              27-inch monitor.

              Top-centre, because that is one of the three regions the probe
              found free. tldraw owns top-left (page menu), the whole bottom
              edge (toolbar), the right edge (style panel) and bottom-left
              (zoom).

              The layer is pointer-events-none and every interactive leaf opts
              back in. In step 4 the board underneath becomes an iframe, and a
              full-bleed layer that accepts pointer events would eat every
              stroke before it reached the canvas. */}
          <div className="pointer-events-none absolute inset-0">
          {boardOn && !hintDismissed && (
            <div
              /* pointer-events-auto on the pill itself, because the layer it
                 sits in is pointer-events-none. An iframe swallows nothing and
                 blocks everything: any transparent overlay above it that still
                 accepts pointer events makes the board undrawable, and that
                 reads as "the embed broke" rather than as a CSS mistake. The
                 rule is enforced by the wrapper below, not by remembering. */
              className="pointer-events-auto absolute left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-pill py-1.5 pl-3 pr-1.5"
              style={{
                top: 0.022 * rect.height,
                background: 'rgba(9,9,11,.86)',
                backdropFilter: 'blur(4px)',
              }}
            >
              {/* The failure here runs opposite to the documented one. The
                  risk is not that a student draws when they should not - it
                  is that nobody draws at all, because a board reads as
                  something to watch rather than something to touch. So it is
                  said on the surface, not only in the docs. */}
              <span className="text-base text-white">Everyone can draw on this board</span>
              <button
                type="button"
                onClick={() => setHintDismissed(true)}
                aria-label="Dismiss"
                className="flex size-6 cursor-pointer items-center justify-center rounded-pill border-0 bg-transparent text-white/60 hover:text-white"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Top-right: one of the three regions the probe found free.
              tldraw's style panel is on the right edge but low down, at
              y = H-344, so the top of that edge is clear. */}
          {overlay && <div className="absolute right-4 top-4">{overlay}</div>}
          </div>

          {showKeepout &&
            BOARD_KEEPOUT.map((region) => {
              const r = region.rect(rect.width, rect.height)
              return (
                <div
                  key={region.id}
                  className="pointer-events-none absolute flex items-start justify-end p-1"
                  style={{
                    left: r.x,
                    top: r.y,
                    width: r.width,
                    height: r.height,
                    background: 'rgba(239,68,68,.14)',
                    outline: '1px dashed rgba(239,68,68,.65)',
                  }}
                >
                  <span className="text-xs font-semibold" style={{ color: '#b91c1c' }}>
                    {region.label}
                  </span>
                </div>
              )
            })}
        </div>
      )}

      {/* Only reachable when the window is genuinely too small - the panel has
          already collapsed by this point, so there is nothing left to reclaim
          and no action to suggest beyond a bigger window. Telling the user to
          hide a panel that is not there would be the more annoying bug. */}
      {squeezed && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
          <span className="rounded-pill bg-warning-bg px-3 py-1 text-sm text-warning-fg">
            This window is small for a whiteboard. The board's own toolbar will wrap below {BOARD_HARD_FLOOR_WIDTH}px.
          </span>
        </div>
      )}
    </div>
  )
}
