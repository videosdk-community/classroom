import { useEffect, useRef, useState } from 'react'

/* Board geometry.

   Every constant here was measured against the real hosted board
   (https://whiteboard.videosdk.live) during the step-0 probe, not inferred
   and not copied from the prototype's mimic. The evidence lives in
   campaigns/classroom/assets/probe/{MEASUREMENTS.md,ladder.json}.

   The single most important fact: the board has NO intrinsic aspect ratio.
   It fills whatever box it is given, exactly, less a 2px border, at every one
   of the nine ladder steps. So the ratio is ours to choose, which means a bad
   one is our bug and not the SDK's. */

/** 16:9. Chosen, not imposed.

    Two reasons. The cloud recording composites at 1280x720, so an on-screen
    board of the same shape is the one the class actually gets back. And
    MIN_BOARD below is already 16:9 to within half a pixel, so the ratio and
    the floor agree instead of fighting each other. */
export const BOARD_RATIO = 16 / 9

/** Smallest size at which the board is still comfortable to teach on.
    At this size tldraw keeps its toolbar to a single 56px row and every piece
    of its furniture is present. */
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

export const BOARD_KEEPOUT: readonly KeepoutRegion[] = [
  {
    id: 'page-menu',
    label: 'Page menu',
    rect: () => ({ x: 0, y: 0, width: 346, height: 44 }),
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

/** The largest ratio-locked box that fits the observed container, plus the
    letterbox offsets needed to centre it.

    Overlay positions are stored as fractions of this rect (0-1) rather than
    as pixels, so a raise-hand FAB lands in the same place on a 13-inch laptop
    and a 27-inch monitor. Converting back is fractionToPx below.

    Maths carried over from the prototype's Board.tsx, which got this part
    right even though it got the board's furniture wrong. */
export function useBaseRect(ratio: number = BOARD_RATIO) {
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
      const fittedHeight = width / ratio
      if (fittedHeight <= height) {
        setRect({ width, height: fittedHeight, extraX: 0, extraY: (height - fittedHeight) / 2 })
      } else {
        const fittedWidth = height * ratio
        setRect({ width: fittedWidth, height, extraX: (width - fittedWidth) / 2, extraY: 0 })
      }
    })

    ro.observe(el)
    return () => ro.disconnect()
  }, [ratio])

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
