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

## What the SDK actually does, where the docs and typings disagree

Every claim here was checked against the shipped `@videosdk.live/react-sdk@1.1.1` and
`@videosdk.live/js-sdk@1.1.1` in `node_modules`, or driven in a browser. None of it is inferred. It
is recorded because each one costs an afternoon to rediscover, and because the typings are wrong
often enough that reading them alone is not enough.

**`onEntryResponded` ships two different shapes.** The bundle emits two positional arguments -
`useCallback(function (id, d) { eventEmitter.emit(events['entry-responded'], id, d) })` - while the
`.d.ts` declares a single `{ participantId, decision }` object. Both are normalised at the seam, and
the decision is matched on substrings rather than equality: the value passes straight through from
the server, and a casing difference would strand a student on the waiting screen forever.

**Pubsub messages carry an id, and that is the problem.** js-sdk builds it as
`id: serverMessage.messageId || ""`. An empty string is falsy *and* equal to every other empty
string, so `key={m.id}` collides silently and React reuses the wrong node, which looks like messages
changing author. Keys fall back to `persistMsgId`, then to `senderId` plus `seqNum`. Both `seqNum`
and `persistMsgId` exist and neither is in the `.d.ts`. `seqNum` is the server's monotonic sequence
and the only trustworthy ordering key; `timestamp`'s clock domain is unestablished and is never read.
`topic` lives on the batch, not the message, despite the typings saying otherwise.

**Moderation is per-participant.** `enableMic` / `disableMic` hang off the `Participant` object
(`participant.d.ts:70-82`), not off `useMeeting()`. And the asymmetry is real: `disableMic` lands
immediately, `enableMic` only *requests* and fires `onMicRequested` on the target. The action is
named "Ask to unmute" so the UI cannot imply otherwise.

**The whiteboard error codes are not on `Constants.errors`.** 4054, 4055 and 4056 have no exported
symbol and are hard-coded. `startWhiteboard()` reports a failure twice, emitting to `onError` and
then rethrowing, so a bare call leaves an unhandled rejection and a doubled message. And 4056 is
never raised client-side - it arrives from the server *after* a double-click has happened - so it
cannot drive the in-flight disable. That flag is ours, set optimistically and cleared in `finally`.

**`checkPermissions` cannot see the permission door.** js-sdk collapses both states with
`if (res.state == "prompt" || res.state == "denied") allowed = false`, so "never asked" and "blocked"
are indistinguishable - a UI built on it either sends a first-time user to a settings walkthrough or
hands a blocked user a Retry button that cannot work. It also throws where the descriptor is
unsupported, which breaks precall outright on Firefox rather than degrading. Precall reads
`navigator.permissions.query` directly.

**`createCameraVideoTrack` and `createMicrophoneAudioTrack` are top-level exports**, not members of
`useMediaDevice`. Destructuring them off the hook gives `undefined` and fails at call time.
`checkPermissions` returns a `Map`, so results need `.get('audio')` rather than a property read.

**`MeetingProvider` reads its config once.** `reinitialiseMeetingOnConfigChange` defaults to false,
so custom precall tracks only take effect if they exist before the provider mounts. Precall and the
room are siblings for that reason, not for tidiness.

**Two `getUserMedia` calls on one device can deadlock.** Hardware that cannot be opened twice leaves
the second call neither resolving nor rejecting, so the preview never appears and nothing is logged.
Acquisition is gated on a known device id, the previous stream is released before the next is opened,
and every call is raced against a deadline so a hang reports itself.

**Whiteboard state does reach late joiners.** `useWhiteboard` is plain `useState(null)` fed only by
the `whiteboard-started` event with no initial query, which reads like a participant joining after
the board started would never receive the URL. Probed in three browsers on 2026-08-20: the board
reached both an existing participant and one who joined afterwards. The server replays the event on
join. Settled, and not a reason to add a pubsub fallback.

**`respondEntry(id, decision)` exists on `useMeeting`**, so an admit or deny is addressable by
participant id and the allow/deny closures are not the only handle. It needs probing before being
relied on - the typings disagree with themselves on whether `decision` is a string or a boolean -
but it may soften the teacher-reload hole described above.
