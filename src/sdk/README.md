# The SDK seam

**This is the only directory allowed to import `@videosdk.live/react-sdk`.**
The rule is enforced by oxlint (`no-restricted-imports` in `.oxlintrc.json`,
switched off for `src/sdk/**` by an override), not by discipline. An SDK bump
touches this directory and nowhere else.

Built in step 4. What lands here:

- One bridge component per SDK hook, rendered once, rendering nothing, pushing
  into a store that feature hooks read via `useSyncExternalStore`. Every one of
  `useMeeting` / `useParticipant` / `useWhiteboard` / `usePubSub` opens a
  subscription *per call site*, so they must not be called from feature code.
  `useParticipant` is inherently per-id, so its bridge renders once per participant.
- Normalisation of the SDK's rough edges, so no feature component ever sees them:
  - `onEntryResponded` arrives as **two positional args** in 1.1.x despite the
    `.d.ts` declaring a single object. Handle both shapes; log and drop anything
    unrecognised rather than crashing.
  - Whiteboard error codes 4054 / 4055 / 4056 mapped to human sentences, and the
    in-flight disable that 4056 implies.
  - Pubsub messages carry **no id field** - synthesise React keys. Do not sort by
    `timestamp`; its clock domain is unestablished.
