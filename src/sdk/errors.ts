/* Whiteboard errors, as human sentences.

   These three numerals are hard-coded on purpose. They are NOT on the SDK's
   exported `Constants.errors`, which runs from INVALID_API_KEY to
   ERROR_MULTISTREAM_NOT_SUPPORTED and carries no whiteboard entries, so there
   is no symbol to reference. Source: the docs' SDK error-code table.

   Two behaviours worth knowing before writing UI against them:

   1. `startWhiteboard()` reports a failure TWICE. The js-sdk catch block emits
      the error to `onError` and then rethrows, so the returned promise also
      rejects. A bare call therefore produces an unhandled rejection in the
      console, and a naive implementation shows the same message twice. The
      seam awaits inside try/catch and dedupes against onError.

   2. 4056 is never raised client-side in 1.1.x. It comes from the server,
      which means it arrives AFTER a double-click has already happened. So it
      cannot be what disables the control; that has to be our own optimistic
      in-flight flag. An incoming 4056 is confirmation, not the source of
      truth. */

export const WHITEBOARD_START_FAILED = 4054
export const WHITEBOARD_STOP_FAILED = 4055
export const WHITEBOARD_OPERATION_IN_PROGRESS = 4056

const SENTENCES: Record<number, string> = {
  [WHITEBOARD_START_FAILED]: 'The whiteboard did not start. Try again in a moment.',
  [WHITEBOARD_STOP_FAILED]: 'The whiteboard did not stop. It may still be open for everyone.',
  [WHITEBOARD_OPERATION_IN_PROGRESS]: 'The whiteboard is already starting or stopping. Give it a second.',
}

export function whiteboardErrorSentence(code: number): string | null {
  return SENTENCES[code] ?? null
}

export function isWhiteboardError(code: number) {
  return code in SENTENCES
}

/* The SDK can deliver the same failure through onError and through a rejected
   promise within a millisecond of each other. Showing it twice makes the app
   look confused, so a repeat of the same code inside this window is dropped. */
const DEDUPE_MS = 500
let lastCode: number | null = null
let lastAt = 0

export function isDuplicateError(code: number, now: number) {
  const duplicate = lastCode === code && now - lastAt < DEDUPE_MS
  lastCode = code
  lastAt = now
  return duplicate
}
