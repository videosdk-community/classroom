# Decisions

Why this app is shaped the way it is. Written as engineering precision, not as
apology. Anything recorded here is settled - reopen it with new evidence, not
with an argument.

## The board's permission is a URL parameter, not an SDK member

`useWhiteboard()` has exactly three members: `startWhiteboard`, `stopWhiteboard`,
`whiteboardUrl`. No role, no read-only flag, and no whiteboard events on
`useMeeting` at all - the board's state reaches other participants only as
`whiteboardUrl` flipping non-null.

The hosted board is a second surface, and it does have one. Appending
`drawOnWhiteboard=false` to `whiteboardUrl` loads it read-only. Nothing in the
React docs mentions it; Prebuilt documents the same lever as
`permissions.drawOnWhiteboard`, and VideoSDK's own team appends it by hand.
`src/lib/boardSrc.ts` is where this app adds it.

Measured on 2026-08-22 against a live board, two browsers. Read-only:

- refuses every stroke, from every tool
- drops the toolbar and the style panel entirely
- keeps the page menu, the zoom menu and the minimap toggle
- kills pointer panning, ctrl-wheel zoom and middle-drag pan with the toolbar
- leaves the zoom menu working - zoom in, zoom out, 100%, zoom to fit, zoom to
  selection, and their keyboard equivalents

That last line is the one that matters to a student. Everyone shares one canvas
but each has their own camera, so a teacher who draws off to one side leaves the
class looking at blank board. Zoom to fit is how they catch up.

The app used to enforce read-only itself, with a transparent
`pointer-events: auto` div over the iframe. An iframe blocks everything, so that
layer stopped strokes and stopped panning and zooming along with them - the
student was pinned to whatever camera the board loaded with, permanently. The
parameter replaces it.

What we still do not paper over:

- **A URL parameter is not enforcement.** It rides in a URL the participant can
  read out of the DOM and re-open without it. `allow_mod` remains the only
  server-side control in this app. This is the same class of guarantee as the
  class-control toggles.
- **"Only the teacher starts the board" is a UI convention in this app, not an
  SDK guarantee.** `startWhiteboard` and `stopWhiteboard` are not permission
  gated; any participant holding a meeting token can call them.
- **Follow-the-teacher does not exist.** The hosted build renders no
  collaborator chips, and the SDK has no viewport, camera or postMessage
  surface, so one participant's camera cannot be driven from another's.

Interactive live streaming does not fix any of this. ILS controls who publishes
media, not who draws, and whiteboard appears nowhere in its docs. This app is
plain RTC.

## Class controls are broadcast state, not enforcement

"Chat disabled" and "hand-raise disabled" are published to a `CLASS_CONTROLS`
pubsub topic with `persist: true`, so a late joiner picks them up through
`onOldMessagesReceived`. Each client honors them: a student's UI hides the chat
input. **Nothing server-side stops a crafted publish.**

`allow_mod` is the only real enforcement anywhere in the room. Real classroom
control, client-honored - and it is worth being exact about which is which.

Every message carries the **whole** control state rather than a delta, and only
messages whose `senderId` matches the server-derived `teacherParticipantId` count.
A full snapshot means replay order cannot leave one client with chat off and
hands on. The sender check means no student can publish the class into a state
the teacher did not choose - which is a real narrowing, not enforcement: the
teacher's own client is all that stands between that account and a crafted
publish.

Raised hands ride the same mechanism on a `HANDS` topic, also persisted, so a
hand survives the raiser's reload and reaches a teacher who joins later. The fold
is narrowed to participants still in the room, so a hand raised by someone who
has since left does not live on in the replay. Anyone may raise or lower their
own hand; only the teacher may lower somebody else's.

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
audience out of the board.**

Promote is layout plus a request. It puts a student's tile on the Lecture stage
for everyone, then calls `enableMic()`, which only asks: the SDK fires
`onMicRequested` on the student and they accept or reject. **A teacher can mute
but cannot force-unmute.** `disableMic()` lands immediately with no consent;
there is no opposite anywhere in the SDK, so the action is named "Ask to unmute"
and demote takes the tile back without touching the microphone.

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

**The teacher-reload hole, measured rather than assumed.** Driven in two
browsers on 2026-08-21, with a temporary probe hook that was not committed.

What actually happens when a teacher reloads while somebody is knocking:

- `onEntryRequested` **does not re-fire**. The rebuilt page has an empty queue
  and the student is invisible on it.
- The student is **still knocking** - they never left, and the server still
  holds the request.
- `respondEntry(participantId, "allowed")` **still admits them**, called with
  no closure anywhere in the process. It resolved, and the student landed in
  the class.

So the hole is narrower than it was written up as. The teacher has not lost the
ability to answer - they have lost the knowledge of **who is asking**. Answering
by id works; there is simply no id on screen.

Closing it properly needs the knock recorded somewhere that survives a reload,
and **pubsub cannot be that place**: a knocking student is not in the meeting,
so they cannot publish and the persisted-topic trick that carries class
controls does not reach them. It would have to be a row written by an endpoint
before the join. That is real product surface and it is not step 7.

Until then the mitigation is unchanged - escalating copy plus "Ask again", both
of which work, and a student who asks again produces a fresh `onEntryRequested`
that the rebuilt queue does show. The wait never auto-navigates: verified out to
95 seconds, the copy escalates at 20s and 60s and the URL never changes. A
student about to be admitted at second 95 must not be ejected at 90.

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

## Screen share covers the board, and only the teacher gets the control

This started as "no screen share", on the grounds that it competes with the
board for centre stage in a campaign whose entire angle is that the board *is*
the class. The competition is real; the answer is to resolve it on screen
rather than to refuse the feature. A share takes centre stage while it runs and
the board comes back the moment it stops, so the two are never arguing over the
same rectangle.

`ScreenStage` **covers** `BoardStage` rather than replacing it. Unmounting the
board would unmount the whiteboard iframe, and an iframe that remounts reloads -
the class would watch the board blank and redraw itself at the end of every
demo.

`object-contain`, never `cover`. This is the one video in the app where
cropping loses the content.

The control is teacher-only in exactly the sense the board control is: a
convention, not a permission. Any token holder can call `enableScreenShare`. The
honest surface is the stage, which names whoever is presenting instead of
assuming it is the teacher.

Presence comes from `onPresenterChanged` and nowhere else - not from a local
flag, not from polling `screenShareOn` across the roster. It is the only signal
that catches the browser's own "Stop sharing" bar, which no app-side click can
listen for. One presenter at a time is the SDK's model, so the control disables
itself when somebody else has the stage rather than failing on the click.

`toggleScreenShare()` wraps `getDisplayMedia`, so a dismissed picker **rejects**
with `NotAllowedError`. That is a teacher changing their mind, not a fault, and
it is swallowed at the seam. `getDisplayMedia` is absent on mobile and tablet
browsers entirely, which the control says rather than opening nothing.

Tab audio arrives as a separate `screenShareAudioStream` and is not played.
`RemoteAudio` owns audio, one `<audio>` per participant with the local one
skipped, and a second audio path would reintroduce the feedback howl that
arrangement exists to prevent.

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

**`respondEntry(id, decision)` works, and `decision` is a string.** Four declarations disagree:
react-sdk `index.d.ts:1444` says `string`, react-sdk `meeting.d.ts:119` says `boolean` with
`true`/`false` in its doc comment, and the generated typedoc HTML demonstrates `"allow"`/`"deny"`.
**js-sdk's `meeting.d.ts` says `"allowed" | "denied"` and it is the one that is right** -
`RoomClient.respondEntry` forwards the value to the socket completely unmodified, and the SDK's own
`allow()` / `deny()` closures are built as `respondEntry(id, "allowed")` and `(id, "denied")`.

When four typings disagree, the bundle decides. Probed end to end: a decision by participant id
admitted a student after the teacher had reloaded and every closure was gone.

**There is no host-left, room-ended or waiting-room event.** All 69 react-sdk event keys and every
js-sdk `EV_*` constant were listed to confirm it. The only room-ended signal is the `code` on
`onMeetingLeft`'s reason - 1006 the room closing, 1009 the end API, 1011 the same account joining
from another tab, 1101 our own `leave()`. Discarding that payload, as this app used to, leaves it
unable to tell any of those apart.

**`RECONNECTING` is emitted and is not in the react-sdk typings.** They declare `CLOSING` and
`CLOSED` instead, and the bundle emits neither. A status map written from the typings drops the one
state that actually happens.

## Role is derived from room ownership, server-side

`api/session.ts` verifies the Supabase session, looks up `public.rooms.owner_id`, and mints
`['allow_join','allow_mod']` or `['ask_join']` from that comparison. **Every other field in the
request is ignored** - no role, no mode, no participant id is ever read from the client. Ownership
is the only input.

The response also carries a `role` field. It is **decoration**, for deciding which controls to
draw. The enforcement is the `permissions` array inside the signed token and nowhere else. Never
gate a moderation action on `role` alone.

Verified, not assumed: the same room, requested with two different `Authorization` headers and
nothing else changed, returns `["allow_join","allow_mod"]` to the owner and `["ask_join"]` to
everyone else. In the browser the student then sits at `connecting` - knocking - rather than
walking in.

## The student never reads `public.rooms`

RLS on that table is strictly owner-scoped, and there is **no insert policy at all**; the `insert`
grant is revoked from `anon` and `authenticated` as well, so an insert policy added later by
accident still cannot let a browser claim a roomId it does not own. Rows are written only by
`api/rooms.ts` under the service role, because creating the VideoSDK room needs the signing secret.

A student joining by link therefore reads nothing from the table. `api/session.ts` already has the
row in hand to derive the role, so it returns `mode` and `title` in the same response as the token.
That response is the trust boundary, and a second browser-side path to the same two fields would be
a second source of truth for no gain.

Two alternatives were considered and rejected. A **public select policy** does not work: RLS is
per-row, not per-column, so "let anyone read just the title and mode" is not expressible without
exposing `owner_id` for every room and making the table enumerable. A **`security definer` view or
RPC** works but is a second privileged path to data the session endpoint must fetch anyway, and
`get_advisors` flags it.

The product consequence is accepted: **Home's "Join by link" does not preview the class.** A bogus
id comes back as a 404 with a sentence, before VideoSDK is contacted.

Listing your own classes *does* go straight to Supabase under RLS. That is what the owner-scoped
select policy is for, and using it on the real path means a mistake in that policy shows up on
Home instead of hiding behind the service role forever.

## Session verification is `getUser`, not a local signature check

`api/_lib/supabase.ts` verifies the access token with `auth.getUser(token)` on the service-role
client rather than verifying the JWT signature locally.

Local verification proves a token was **signed**, not that the session still **exists**. A
signed-out or deleted user's unexpired access token would still mint a teacher token, and no test
would show it. Verifying locally would also mean shipping a JWKS fetcher, a cache and key rotation
into a serverless function. The cost is one round trip per join, which happens at most once every
ten minutes.

If this ever becomes hot, the fix is `getClaims()` against a cached JWKS - not a hand-rolled HS256
verify.

## The display name is client-chosen, and is not identity

Magic link gives an email and no name, so Precall asks for one, prefilled from the email's local
part. The field sits **outside** every per-state block on that screen: the blocked and unavailable
paths never render the granted block, so a name asked for only in there would be skipped by exactly
the people who most need to be identifiable in the room.

A student can therefore type any name they like. That is fine and it is worth being plain about:
**the name is not a security boundary, the role is.** Step 7's knock queue shows the name, and it
should not be mistaken for an identity.

## VideoSDK token payload details that are not cosmetic

- **`version: 2` is required** for `roomId` and `participantId` scoping to be honoured at all.
  Without it those fields are ignored and every token is effectively a skeleton key.
- **`roles` is deliberately absent.** `crawler` is REST-only and `rtc` is meeting-only, so setting
  either splits one token into two. Omitting it lets the same signer create a room and join one.
- **`participantId` is the Supabase user id**, so it is stable across reloads and unique per
  person. With `version: 2` this pins one seat per account: the same login in two tabs collides.
  That is intended, and it is why testing this properly needs two real accounts.
- **`POST /v2/rooms` returns `roomId`**, not `meetingId`, and `Authorization` carries the raw JWT
  with **no `Bearer` prefix**.
- **`autoCloseConfig` is not sent at all.** The docs name the enum `session-ends`; the live API
  reports `session-end` back on a room created without one. Rather than guess, we leave it at the
  account default, which already ends the session when the last participant leaves.
- **Values are trimmed when read.** `VIDEOSDK_API_KEY` in this repo's `.env` had a trailing space,
  which signs a token the API rejects with *"'apikey' provided in the token is empty or invalid"* -
  a message that blames the key rather than the whitespace.

## Local development: two servers, both on port 3000

`pnpm dev:api` is `vercel dev`, which serves the SPA and `api/` from one origin.
`pnpm dev` is plain Vite, for UI work, with no `/api` at all - a sign-in there
fails on a request that returns `index.html` instead of JSON, and `apiPost`
detects that shape and says so by name rather than surfacing a parse error.

**Both listen on 3000**, and that is deliberate rather than tidy. Vite's default
is 5173, which would mean the Supabase redirect allowlist had to contain two
origins and that running the wrong server cost an hour before anyone noticed.
Pinning both to one port makes the only difference between them the thing that
actually differs: whether `/api` exists. The allowlist needs
`http://localhost:3000/**` and nothing else.

**`vercel dev` cannot be the `dev` script.** It refuses to start with
*"`vercel dev` must not recursively invoke itself"*, because it reads
`package.json`'s `dev` script to decide what to run and finds itself. It reads
that **before** `vercel.json`'s `devCommand`, so setting `devCommand` alone does
not fix it - the script names have to be the way round they are now. That is
why the full-stack script is `dev:api` and not `dev`.

`vercel.json`'s SPA rewrite excludes the API with a negative lookahead. Without
it every function call returns `index.html` with a 200.

It excludes **`@`, `src/` and `node_modules/` as well**, and that is not
cosmetic. In production those paths do not exist - Vite emits hashed files
under `assets/` - but in development they are Vite's own module namespace, and
`vercel dev` applies the production rewrite to them. Every one of
`/@vite/client`, `/@react-refresh` and `/src/main.tsx` was answered with
`index.html`, which Vite then tried to parse as JavaScript, so the page loaded a
blank body and three 500s that blamed `index.html:16` - a line that is fine.
The app never booted at all under `vercel dev` until this was narrowed.

## Signing in during development, without the email

Supabase's built-in sender is testing-only and rate-limited to a handful of messages an hour for
the whole project - roughly one teacher and one student sign-in, with a typo costing the hour.

`scripts/dev-session.mjs <email>` skips it: `auth.admin.generateLink({ type: 'magiclink' })` under
the service role returns both an `action_link` and a `hashed_token`, and `auth.verifyOtp({ type:
'magiclink', token_hash })` redeems the hash for a real session immediately. Two accounts, no email.

This is the same mechanism step 10's Playwright setup needs, since a test cannot click an emailed
link. **One caveat to carry there:** under PKCE the code verifier lives in the localStorage of the
browser that requested the link, so a `generateLink` URL opened in a fresh automated context has no
verifier and the exchange fails. The test will need either `flowType: 'implicit'` or a seeded
`storageState` - which is why `/auth/callback` is a real route that depends on nothing existing
only in the requesting tab.

## Where VideoRail went

`src/components/VideoRail.tsx` was deleted with `/room`, its only importer. It carried the rail cap
and the **"+N" overflow chip**, which the live rail in `LiveClassroom` does not have - a rail is not
a plan for forty students. That behaviour is recorded here rather than kept alive as dead code;
port it when the live rail gets a cap.
