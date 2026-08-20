# Decisions

Why this app is shaped the way it is. Written as engineering precision, not as
apology. Anything recorded here is settled - reopen it with new evidence, not
with an argument.

## The board has no permission model

`useWhiteboard()` has exactly three members: `startWhiteboard`, `stopWhiteboard`,
`whiteboardUrl`. No role, no read-only, no URL parameters, and no whiteboard
events on `useMeeting` at all - the board's state reaches other participants only
as `whiteboardUrl` flipping non-null.

Two consequences we do not paper over:

- **Anyone who loads the board can draw on it.** There is no supported way to
  hand out or withhold the pen. The UI says so, because a student's first
  instinct is that the board is something to watch rather than something to
  touch, and they will not draw unless told they may.
- **"Only the teacher starts the board" is a UI convention in this app, not an
  SDK guarantee.** `startWhiteboard` and `stopWhiteboard` are not permission
  gated; any participant holding a meeting token can call them.

Interactive live streaming does not fix this. ILS controls who publishes media,
not who draws, and whiteboard appears nowhere in its docs. This app is plain RTC.

## Class controls are broadcast state, not enforcement

"Chat disabled" and "hand-raise disabled" are published to a `CLASS_CONTROLS`
pubsub topic with `persist: true`, so a late joiner picks them up through
`onOldMessagesReceived`. Each client honors them: a student's UI hides the chat
input. **Nothing server-side stops a crafted publish.**

`allow_mod` is the only real enforcement anywhere in the room. Real classroom
control, client-honored - and it is worth being exact about which is which.

## Mode is fixed at room creation

Class vs Lecture is chosen once on Home, stored as `public.rooms.mode`, and
returned by `api/session.ts` alongside the meeting token, so every client reads
it at join from a source it cannot forge.

There is deliberately **no mid-class switch**. A live mode change would need the
mode broadcast over pubsub as well as stored on the row, giving it two sources of
truth to reconcile, and it would need a notification answering "can they still
see and hear me?" - because a chip flipping from `CLASS` to `LECTURE` reads as
decoration, not as news. Neither cost buys anything the campaign needs.

Both modes are layout plus convention. **Lecture makes no claim to lock the
audience out of the board.** What promote-to-stage grants is mic and camera,
enforced by `allow_mod`.

## Students knock - the lobby is real product surface

Students hold `ask_join`, not `allow_join`. That is not a UI label; it is a
materially weaker token that cannot enter a room unattended. The SDK holds the
student at `CONNECTING` and fires `onEntryRequested` on every client holding
`allow_mod`. The property this buys: **a student cannot enter a class the teacher
is not running.**

The SDK gives us the mechanism and none of the UX, so four states are ours:

| State | Where it comes from |
|---|---|
| Teacher's knock queue | **Received** - `onEntryRequested({ participantId, name, allow, deny })` |
| "Waiting to be let in" | **Derived.** Nothing sends this - it is role plus connection state |
| "The teacher declined" | **Received** - `onEntryResponded` |
| "Nobody is answering" | **Derived.** There is no host-left or room-ended event at all |

Three rules the implementation cannot get wrong:

- **On denial the app calls `leave()` itself.** The SDK does not disconnect a
  denied guest - they sit at `CONNECTING` forever, and "denied" becomes
  indistinguishable from "frozen". This is the most load-bearing line in the lobby.
- **`allow` / `deny` are closures on the event**, not addressable by participant
  id afterwards. Display rows live in reactive state; the closures live in a
  separate non-reactive map, because closures are neither serialisable nor
  comparable and would churn every render inside a snapshot.
- **`onEntryResponded` ships two shapes.** The 1.1.x bundle emits two positional
  arguments while the shipped `.d.ts` declares a single object. Normalise both at
  the seam.

**A hole we cannot close:** if the teacher reloads mid-knock, the allow/deny
closures die with their event and the student is stranded in silence, with no
event ever arriving. Nothing in the SDK fixes this. The whole mitigation is
escalating copy plus an "Ask again" button, and it is written down here rather
than pretended away. The wait never auto-navigates - a student about to be
admitted at second 95 must not be ejected at 90.

## A teacher can mute but cannot force-unmute

Host moderation is asymmetric. `disableMic()` and `disableWebcam()` land
immediately with no consent. `enableMic()` and `enableWebcam()` only **request**,
firing `onMicRequested` / `onWebcamRequested` on the target, who accepts or
rejects. We do not work around it - the action is named **"Ask to unmute"**.

## The SDK lives behind a seam

`src/sdk/` is the only directory allowed to import `@videosdk.live/react-sdk`,
enforced by an oxlint `no-restricted-imports` rule with an override for the seam
itself. Discipline is not a mechanism; a linter is.

The reason is not only SDK bumps. Each of `useMeeting`, `useParticipant`,
`useWhiteboard` and `usePubSub` opens a subscription **per call site**, so
calling them from feature components multiplies subscriptions invisibly. Each is
subscribed once in a bridge component that renders nothing and pushes into a
store; feature hooks read that store through `useSyncExternalStore`.

## No screen share

It competes with the board for centre stage, in a campaign whose entire angle is
that the board *is* the class.
