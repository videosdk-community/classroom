import { type ReactNode } from 'react'
import {
  BOARD_BG,
  BOARD_HARD_FLOOR_WIDTH,
  BOARD_KEEPOUT,
  COLLABORATORS_HEIGHT,
  isBoardBelowFloor,
  useBaseRect,
} from '../lib/boardGeometry'

/* The board region.

   This is a stacking context on purpose: the board itself sits underneath and
   app chrome sits above it.

   The board is the hosted page at whiteboardUrl, in an iframe. It carried the
   step-0 probe screenshot until step 8, which is why the surround was tuned
   against the real thing from the start - the prototype's mimic put tldraw's
   tool rail on the left and its style panel top-right, and both are wrong.
   The iframe needs no sandbox loosening and no allow list: it embeds cleanly
   on a foreign origin, measured in step 0. */

export interface BoardStageProps {
  /** The SDK's whiteboardUrl. Null until somebody starts the board, which is
      the only signal any participant gets that it is open - there are no
      whiteboard events on useMeeting at all. */
  url: string | null
  /** App chrome that must sit over the board and inside its edges.

      It goes in here rather than in the parent because the board is
      ratio-locked and centred: on a short window the fitted rect is narrower
      than the region around it, so anything anchored to the container hangs
      off the board's edge and into the surround. Rendered in the
      pointer-events-none layer, so an interactive leaf must opt back in. */
  overlay?: ReactNode
  /** Whether this participant is meant to draw.

      A UI convention, not a permission. useWhiteboard() exposes exactly three
      members - startWhiteboard, stopWhiteboard, whiteboardUrl - so there is no
      role to send, no read-only flag and no URL parameter the hosted board
      would honour. Everything false does here happens on this side of the
      iframe: any token holder can still start or stop the board, and a student
      who opens devtools can delete the guard div and draw. It is the same
      class of guarantee ControlBar.tsx already writes down, where only muting
      is enforced server-side. Required rather than defaulted, because a
      forgotten prop must not silently hand a student the pen. */
  canDraw: boolean
  /** Dev-only. Paints the regions tldraw's own furniture occupies, so app
      chrome can be checked against them rather than placed by eye. */
  showKeepout?: boolean
}

export function BoardStage({ url, overlay, canDraw, showKeepout = false }: BoardStageProps) {
  const boardOn = url !== null
  const { ref, rect } = useBaseRect()
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
            <iframe
              src={url}
              title="Whiteboard"
              /* No border of its own - the container already draws the
                 hairline and the radius, and a second edge inside it reads as
                 a rendering seam. */
              className="h-full w-full border-0"
              allow="clipboard-write"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-center">
              <span className="text-lg font-semibold" style={{ color: '#3f3f46' }}>
                The board is not open yet
              </span>
              <span className="text-base" style={{ color: '#71717a' }}>
                {canDraw ? 'Opening it for the class.' : 'Your teacher starts it for the class.'}
              </span>
            </div>
          )}

          {/* The read-only guard, and the one place in this file where the
              iframe's worst property is the point rather than the hazard.

              The pill's comment below records it as a trap: an iframe
              swallows nothing and blocks everything, so a transparent layer
              that accepts pointer events makes the board undrawable. That is
              exactly the effect wanted here, so this layer opts into pointer
              events on purpose and every stroke dies on it.

              Invisible on purpose. It paints nothing over the board and dims
              none of the board's own controls: a student watching a lesson
              should see the board the teacher sees, and a scrim over the tool
              rail reads as a rendering fault rather than as a rule. The tools
              are simply inert, which is what "watch this" looks like.

              It sits after the iframe but BEFORE the pointer-events-none
              overlay layer, so teacher chrome still paints and still clicks
              through to its own leaves. Flip the two and the guard would
              cover the chrome as well. */}
          {boardOn && !canDraw && (
            <div
              className="absolute inset-0"
              style={{ pointerEvents: 'auto', cursor: 'default' }}
              aria-hidden="true"
            />
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
          {/* Top-right, below the collaborator row. The style panel is on the
              right edge but low down, at y = H-344, so the top of that edge is
              clear of it - what is NOT clear is tldraw's avatar chips, which
              the probe never saw because it drove a board of one. */}
          {overlay && (
            <div className="absolute right-4" style={{ top: COLLABORATORS_HEIGHT + 8 }}>
              {overlay}
            </div>
          )}
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
