import { useEffect, useRef, useState } from 'react'

/* Board geometry.

   Every constant here was measured against the real hosted board
   (https://whiteboard.videosdk.live) during the step-0 probe, not inferred
   and not copied from the prototype's mimic. The evidence lives in
   campaigns/classroom/assets/probe/{MEASUREMENTS.md,ladder.json}.

   The single most important fact: the board has NO intrinsic aspect ratio.
   It fills whatever box it is given, exactly, less a 2px border, at every one
   of the nine ladder steps. useBaseRect below used to spend that freedom on a
   fixed 16:9 letterbox, chosen (not imposed - nothing requires it) to match
   the cloud recording's assumed 1280x720 composite. On a tall narrow phone
   that letterbox left the board a thin strip between two black bars, which is
   the more concrete cost - the composite was never actually coupled to it in
   code, only in the choice to keep the two numbers equal. The board now
   fills its container exactly, at every screen size; the recording composite
   is unaffected either way, since nothing here ever configured it. */

/** Smallest size at which the board is still comfortable to teach on.
    At this size tldraw keeps its toolbar to a single 56px row and every piece
    of its furniture is present. Width feeds PANEL_OVERLAY_BREAKPOINT below;
    height is informational only now that the board no longer fits a ratio. */
export const MIN_BOARD = { width: 900, height: 506 } as const

/** The point where the board stops being usable, measured rather than guessed.

    At 800 wide tldraw's toolbar wraps from 56px to 104px and eats the board
    from the bottom; by 640 the style panel has disappeared entirely. So this
    is where the shell must stop shrinking the board and start taking width
    back from the side panel instead. The panel collapses before the board
    does. */
export const BOARD_HARD_FLOOR_WIDTH = 800

/** Sampled from the rendered canvas, not read off a computed style.

    Worth knowing: the board wrapper's own backgroundColor computes to
    rgba(0,0,0,0). Anything that tries to read this value back off the element
    at runtime gets transparent, not #f9fafb. */
export const BOARD_BG = '#f9fafb'

/** The board draws a 1px border on each edge, so its inner surface is 2px
    smaller than the box we give it in both axes. Held true at every ladder
    step. */
export const BOARD_BORDER = 2

/** Where tldraw puts its own furniture, in board-inner coordinates.

    No app chrome may float over any of these. The prototype guessed a left
    tool rail and a top-right style panel and was wrong about both, so the
    free space is very nearly the inverse of what it assumed: top-centre,
    top-right and left-middle are clear.

    `x` and `y` are functions of the board's inner size so a keepout can be
    resolved at any board size rather than only at the probed ones. */
export interface KeepoutRegion {
  readonly id: string
  readonly label: string
  rect: (w: number, h: number) => { x: number; y: number; width: number; height: number }
}

/** Width of tldraw's page menu, which is a fixed pixel size rather than a
    fraction of the board. App chrome that centres itself on the board is
    narrower than the board at every size, so on a small board a centred pill
    reaches back into this. */
export const PAGE_MENU_WIDTH = 346

/** Height of the collaborator row in the board's top-right corner.

    NOT in the step-0 measurements, because the probe drove a board with one
    participant in it and the row only appears once somebody else is present.
    It is where tldraw stacks the avatar chips for everyone on the board, and
    it grows leftwards as the class does, so anything anchored top-right has
    to start below it. */
export const COLLABORATORS_HEIGHT = 40

export const BOARD_KEEPOUT: readonly KeepoutRegion[] = [
  {
    id: 'page-menu',
    label: 'Page menu',
    rect: () => ({ x: 0, y: 0, width: PAGE_MENU_WIDTH, height: 44 }),
  },
  {
    id: 'collaborators',
    label: 'Collaborators',
    /* Grows leftwards with the class, so the width is a guess at a roomful
       rather than a measurement of two. */
    rect: (w) => ({ x: w - 200, y: 0, width: 200, height: COLLABORATORS_HEIGHT }),
  },
  {
    id: 'toolbar',
    label: 'Main toolbar',
    /* Full-width container with a centred pill inside it. The container is
       what blocks, not the pill - a FAB dropped into the empty stretch beside
       the pill still lands on a hit-testing surface. */
    rect: (w, h) => ({ x: 0, y: h - 56, width: w, height: 56 }),
  },
  {
    id: 'style-panel',
    label: 'Style panel',
    /* Rigid 148x284 at every size until it vanishes below 800 wide. */
    rect: (w, h) => ({ x: w - 156, y: h - 344, width: 148, height: 284 }),
  },
  {
    id: 'zoom',
    label: 'Zoom control',
    rect: (_w, h) => ({ x: 0, y: h - 40, width: 60, height: 40 }),
  },
] as const

export interface BaseRect {
  width: number
  height: number
  /** Letterbox offsets. Left/top inset of the ratio-locked box inside its
      container, so overlay geometry converts back with
      `x * baseRect.width + extraX`. */
  extraX: number
  extraY: number
}

const EMPTY_RECT: BaseRect = { width: 0, height: 0, extraX: 0, extraY: 0 }

/** The observed container, exactly - no ratio lock, no letterbox.

    extraX/extraY are always 0 now; kept on BaseRect rather than dropped so
    fractionToPx and every overlay call site below keep working unchanged.
    Overlay positions are stored as fractions of this rect (0-1) rather than
    as pixels, so a raise-hand FAB lands in the same place on a 13-inch laptop
    and a 27-inch monitor. Converting back is fractionToPx below. */
export function useBaseRect() {
  const ref = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<BaseRect>(EMPTY_RECT)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      /* Under a `flex-1 min-h-0` parent the first callback can arrive with a
         0x0 rect. Writing it means a wasted render and a frame where the
         board is absent rather than merely unsized. */
      if (width === 0 || height === 0) return
      setRect({ width, height, extraX: 0, extraY: 0 })
    })

    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return { ref, rect }
}

/** Convert a fractional overlay position (0-1 of the base rect) to pixels
    inside the board container. */
export function fractionToPx(rect: BaseRect, fx: number, fy: number) {
  return {
    left: fx * rect.width + rect.extraX,
    top: fy * rect.height + rect.extraY,
  }
}

/** Whether the board has been squeezed past the point tldraw stays usable.
    Below this the shell should reclaim width from the side panel rather than
    keep shrinking the board. */
/* Device-agnostic on purpose: this describes tldraw's own measured chrome
   behaviour and the fixed 1280x720 recording composite, neither of which
   changes based on who is looking at the board. A phone can never reach
   BOARD_HARD_FLOOR_WIDTH - BoardStage's `warnOnSqueeze` prop is where that
   gets handled, as presentation policy layered on this unchanged fact, not
   by changing the measurement itself. */
export function isBoardBelowFloor(rect: BaseRect) {
  return rect.width > 0 && rect.width < BOARD_HARD_FLOOR_WIDTH
}

/* The window width below which the side panel must stop taking width from the
   board and overlay it instead.

   Derived rather than chosen: the board wants MIN_BOARD.width, the stage adds
   24px of surround on each side, and the panel is 320px. Below the sum,
   something has to give, and the rule is that the panel gives first. The board
   is the product; the chat is not.

   Keyed to MIN_BOARD (900, comfortable) and NOT to BOARD_HARD_FLOOR_WIDTH
   (800, where tldraw's toolbar wraps). Keying it to the hard floor would be
   self-defeating: 800 is below 900, so the panel would only yield after the
   board had already been squeezed past comfortable, and the rule would fire
   exactly too late to be worth having. The hard floor is what the warning
   below is for - the case where the window is short rather than narrow, and
   giving the panel's width back cannot help. */
export const STAGE_SURROUND = 24
export const PANEL_OVERLAY_BREAKPOINT =
  MIN_BOARD.width + STAGE_SURROUND * 2 + 320
