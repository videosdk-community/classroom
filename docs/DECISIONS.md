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

## Leaving the class is guarded, and the gesture is blocked outright

A two-finger horizontal swipe on a trackpad is a Back gesture. The whiteboard is
the one surface in this app people swipe across for minutes at a time, and the
hosted board only consumes those wheel events while its toolbar is live - so a
student in read-only mode overscrolled past it into the browser's own history
navigation and left the class without touching anything.

`overscroll-behavior-x: none` on `html, body, #root` is the fix: it stops the
scroll chaining the gesture depends on. Nothing in this app scrolls sideways, so
it costs nothing.

`useExitGuard` covers what CSS cannot - a keyboard Back, a mouse thumb button, a
reload, a closed tab. It parks a sentinel history entry and re-pushes it on
`popstate`, so the room URL never changes and React Router never renders anything
else; the class carries on behind the confirmation. `beforeunload` handles the
unload cases, where the browser draws its own dialog and ignores any message we
pass.

`LeavePrompt` is shown only for a caught Back. The Leave button does not raise
it - a confirmation on a deliberate click is friction, not safety.

The trap has one cost, and it is deliberate: leaving replaces the sentinel rather
than the room entry, so Back from the home screen returns to that room's precall
instead of to whatever came before it. Precall is a screen the participant can
safely see.

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

The name shows on every tile, in chat, in the teacher's knock queue and in the recording's name
tags, and nothing in auth supplies one - a magic link gives an email, a guest gives nothing at all.

Where it is asked for moved twice, and the shipped answer is **the sign-in screen**. It is the only
field there, so asking costs nothing, and it rides in `user_metadata.display_name` so a guest keeps
their name even after localStorage is cleared. `src/lib/displayName.ts` mirrors it to localStorage
for a first paint that does not wait on the session, and `suggestedName()` falls back to the email's
local part. Home lets you change it from the header, beside the avatar, writing through on every
keystroke - it is account identity rather than part of starting a class, so it does not belong on the
composer. Precall no longer collects it; it carries the chosen name through to the join.

A student can therefore type any name they like. That is fine and it is worth being plain about:
**the name is not a security boundary, the role is.** The knock queue shows the name, and it should
not be mistaken for an identity. `user_metadata` is writable by the account it belongs to, which is
the same reason the `role` field in the session response decides nothing.

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

## The Class rail is capped at twelve, and the overflow opens the roster

`src/components/VideoRail.tsx` was deleted along with the fixture route `/room` and then rebuilt for
the live path, which is why this section used to say the file was gone. It is back, and it carries
the cap it was deleted with.

Twelve tiles is roughly what fits across a laptop before a face stops being readable. Past that the
rail shows a **"+N" chip that opens the People panel**, because a class of forty is legible as a list
and not as a strip of thumbnails.

The order is not join order. **Self and the teacher are pinned to the front**, so the two faces a
student actually looks for - "am I muted" and "is the teacher still here" - cannot fall off the end
of the cap.

The rail exists in Class only. Lecture has no rail at all: the teacher's tile lives in the side
column on `LectureStage`, with promoted students beside them and a small self tile underneath. One
face stretched across a 112px full-width band is waste, and the height it costs comes off the board.

## Guests are real users, and that is why the security model did not move

The way in is a name and a button. `signInAnonymously()` creates a row in `auth.users` with a real
id and a real JWT carrying the `authenticated` role; the only thing a guest lacks is an identity to
sign back in with once the browser storage is gone.

That is what makes it safe here. `api/session.ts` reads exactly one fact - does `room.owner_id`
equal the verified `user.id` - and a guest has a `user.id` like anyone else. So `requireUser`, the
ownership comparison, the permission mint, `participantId`, and all three owner-scoped RLS policies
work unchanged. **Not one line of `api/` changed to ship this.** Verified by posting
`{"role":"teacher","permissions":["allow_mod"]}` alongside a guest's `roomId` and getting
`ask_join` back.

The alternative people reach for - dropping Supabase because "it is only a demo" - deletes the
thing `owner_id` binds to. Role would then come from the client, and anyone could claim `allow_mod`.
`allow_mod` is the only real enforcement in this app, so that is not a smaller version of the
product, it is a different one.

Magic link stays, behind a toggle, as the way to get an account that survives a cleared browser.

**The name is collected on the sign-in screen** rather than on Precall, reversing the earlier note in
`SignIn.tsx`. It is the only field on the screen, so asking costs nothing, and it rides in
`user_metadata.display_name`. `suggestedName()` reads it there first, which is why a guest whose
localStorage is wiped still comes back with their name. `user_metadata` is writable by the account
it belongs to and must never decide anything - it is decoration, exactly like the `role` field in
the session response.

Three consequences worth knowing before editing this:

- **Anonymous sign-in is rate-limited to 30 per hour per IP**, and it is raised in the dashboard, not
  in code. A class of twenty on one venue network shares one IP. This is the trap that actually bites.
- **Signing a guest out is one way.** `signOut()` does not delete the `auth.users` row, so their
  classes survive as rows with an owner nobody can be again. Home says so in a `confirm` and calls
  the button "Start over" rather than "Sign out".
- **Guest accounts expire.** `public.delete_expired_guests()` runs nightly under `pg_cron` and
  deletes guests older than 30 days; `rooms.owner_id` is `on delete cascade`, so their classes go
  with them. Supabase has no automatic cleanup for anonymous users - without this the table grows
  for as long as the demo is up.

Advisor lint `0012_auth_allow_anonymous_sign_ins` reports at INFO once this is enabled, and is
correct to leave. Every policy on `public.rooms` is already `(select auth.uid()) = owner_id`, there
is no insert policy, and `insert` is revoked from `authenticated`.

## A guest can keep everything by adding an email

"Sign in" in the header, for a guest, does not sign them out and start over. It goes to `/signin`,
which recognises a signed-in guest and calls `updateUser({ email })` instead of `signInWithOtp`.
That links an email identity to the account that already exists. **The user id does not change.**
That is the whole reason this works: `owner_id` on every one of their rooms already points at that
id, so the classes come along with no migration, no reassignment and nothing for `api/session.ts`
to notice. `is_anonymous` flips to false once the address is confirmed, and the header switches
from "Sign in" to "Sign out" on its own.

The branch is the point. Calling `signInWithOtp` for a signed-in guest would create a **second**
account and silently strand every class the first one owned. Verified at the wire rather than by
reading the code - the two paths hit different endpoints:

```
signed out    POST /auth/v1/otp   ?redirect_to=...%2Fauth%2Fcallback%3Fnext%3D%252F
signed-in guest  PUT /auth/v1/user   ?redirect_to=...%2Fauth%2Fcallback%3Fnext%3D%252F%26confirm%3Demail
```

And the linking itself, probed on a live guest that owned a class:

```
BEFORE is_anonymous: true   identities: []
AFTER  is_anonymous: false  identities: ['email']   SAME USER ID: true
```
with the room row still there, same `room_id`, display name intact.

`/signin` therefore serves three states, and the third is why it no longer redirects the moment
someone is signed in: signed out gets name + Continue; a signed-in guest gets the email form; a
signed-in permanent account gets sent where it was going.

Requires **Manual Linking** enabled on the project (`GOTRUE_SECURITY_MANUAL_LINKING_ENABLED`).
Separate from the anonymous provider toggle, and there is no capability to feature-detect - the
refusal is the only sign it is off.

**The stale-claim trap.** `is_anonymous` is a claim inside the access token, not something read
live. An account upgraded out of band keeps showing the guest UI until the token is refreshed,
because the stored JWT still says `true`. The real flow does not hit this: confirming the address
returns a fresh session through the redirect. Anything that changes an account server-side does,
and the fix is `refreshSession()`, not a reload.

`/auth/callback` needed one change. A guest confirming an address is **already signed in** when
they land, so the existing `status === 'signedIn'` redirect fired before the confirmation applied.
The redirect URL carries `confirm=email`, and the screen waits for `is_anonymous === false`
instead.

**Linking an address that already has an account** - the forgot-I-signed-up-before case. Probed:

```
{ status: 422, code: 'email_exists',
  message: 'A user with this email address has already been registered' }
```

A hard refusal, and a good one. It answers **before** the send, so it is never masked by the rate
limit; no enumeration obfuscation, so there is no fake "check your email" to strand anyone; and it
writes nothing - the guest is left byte-for-byte as it was, `is_anonymous` still true, `identities`
still empty, every class still theirs. Match on `code`, not on the message, which is prose.

Supabase does not merge the two, and neither do we. Merging would mean rewriting `rooms.owner_id`
across two users, which `rooms_update_own` cannot express - its `with check` is
`auth.uid() = owner_id`, so nobody can hand a row to somebody else. That is a service-role
endpoint, and it does not exist.

What saves this from being a trap is that **a guest cannot switch accounts from inside the app at
all**. There is no sign-out for a guest, and `/signin` never calls `signInWithOtp` while one is
signed in - only `updateUser`. So the failure mode is a person reading an error, not a person
silently losing a class. Reaching the older account means another browser, and the guest classes
stay where they are.

**The built-in sender is what blocks this end to end, and it is two limits, not one.** It caps
messages per hour for the whole project - `over_email_send_rate_limit`, HTTP 429, which the
dashboard rate-limit setting does not lift past the service's own ceiling - and separately it
**refuses to deliver to any address that is not on the project team**. So no `@example.com` probe
can ever complete this flow, and the send-and-click leg is untested for that reason. Custom SMTP
is the fix, and is the only way to demo it live.

`generateLink({ type: "email_change_new" })` is not a way around it: it answers
`400 An email address is required`, because a guest has no current address for the change to be
*from*.

## Listing recordings: VideoSDK has no owner, so ownership is decided here

`GET /v2/recordings` is account-wide. Every recording made under the API key is reachable by
anything holding the secret, and a row carries `apiKey`, `roomId` and `sessionId` but nothing that
says which of our teachers it belongs to. A shared account means an unfiltered list is other
people's classes.

So `api/recordings.ts` decides ownership before a single REST call goes out: it reads the caller's
rooms from `public.rooms` under the service role, keyed on the verified session, and asks about
those roomIds and no others. A roomId is never read from the request - same rule as
`api/session.ts`. The fan-out is capped at the 25 most recent rooms; one `roomId` query costs about
900ms and six run in parallel in roughly the same, so the cap is about a bounded blast radius, not
about latency.

Probed against the live API on 2026-08-22, because the REST reference documents none of this:

- `GET /v2/recordings?roomId=` **filters correctly** and returns `{pageInfo, data}`. `roomIds=`,
  `meetingId=` and v1's `?roomId=` are all silently **ignored** - they answer 200 with the whole
  account. A filter that fails open is worse than one that errors, so the param spelling here is
  load-bearing.
- `sessionId=` also filters, on both v2 and v1 `/v1/meeting-recordings`.
- A row exists from the moment recording **starts**, with no `file` on it. Key off `file.fileUrl`,
  never off the row - that is why the handler drops fileless rows rather than showing a dead Play.
- `file.accessMode` is `"public"` and `fileUrl` is a plain `https://cdn.videosdk.live/...mp4` that
  answers 200 to an unauthenticated HEAD. No presigning, so `<video src>` is the whole player and
  Download is an `<a download>`.
- `file.meta.duration` is seconds, `file.size` is bytes.

Nothing is mirrored into Postgres. A recordings table would need a webhook or a poller and would
hold a second, staler copy of a list read a handful of times a day.

---

The sections below were settled while the app was being built rather than before it, which is why
they arrived after the first pass of this document. Everything here is in the shipped code.

## The teacher's exit ends the class for everyone

The teacher's control says **End**, not Leave, and it calls `end()` rather than `leave()`.

`leave()` drops the teacher and leaves the room open, so students sit in a class with no teacher and
a board nobody owns. `end()` closes the room, and every student's `onMeetingLeft` carries the
room-close code the gate already reads, so they land on a centred "Teacher left" screen instead of an
error card. The end of a class is not a failure and does not get an error card.

Exits caused by the room closing must **not** call `leave()` on the way out. The SDK has already
dropped that participant, and calling it anyway throws `ERROR_ALREADY_IN_REQUESTED_STATE` across
every student's console at the moment the class ends. `RoomGate` only calls `leave()` for the exits
it decides itself: a denial, and the lobby's own buttons.

## Removing a student is the only moderation action with no consent step

`participant.remove()` hangs off the `Participant` object, the same as the mute calls. There is no
prompt, no request and no acceptance: the student is dropped and finds out from the leave reason.

Three server codes mean the same thing to them, and the app treats them as one - **1002** an SDK
`remove()`, **1008** remove-all, **1010** the REST endpoint. Who did it is not the student's question
to answer. The code arrives on the websocket close frame, so it is checked **before** the room-closed
codes: being removed and the class ending both land as a disconnect, and the student is owed the one
that is actually about them.

**Nothing here bars a rejoin, and the copy does not pretend otherwise.** The link still works and the
student comes back as a knock, which is why their exit screen still offers "Ask again".

The roster action is icon-only and drawn in danger red. It never appears on a teacher's row: a room
can hold more than one `allow_mod` holder and they do not get to eject each other. There is no
confirmation dialog - the button is already icon-only and red, and a modal over a live class costs
more than the mis-click it prevents - but a toast names who went, and the name is read **before** the
call, because `onParticipantLeft` lands in the same beat and takes the roster row with it.

Removing also drops the student from the promoted list. Raised hands narrow themselves against the
roster; the promoted list does not, so without that line a removed student who knocks again walks
straight back onto the Lecture stage.

## The teacher's board opens itself, and the retry is not optional

A class that opens on an empty board region reads as a product that has not loaded, so the teacher's
board starts on arrival. The panel starts closed for the same reason: the board is the first thing a
class should see.

The retry is the whole reason this is a loop rather than one call. **A `startWhiteboard()` issued in
the same beat as `onMeetingJoined` is accepted and then silently dropped** - no throw, no `onError`,
no 4056, just a board that never opens. Driven in the browser rather than reasoned about: the
one-shot version left the teacher looking at "The board is not open yet" while the same call from the
control bar a second later worked every time.

Five attempts, each awaiting the last, 1500ms apart. Awaiting serialises them so the in-flight flag is
never contended and the server never sees the double-start that 4056 exists to reject. It stops the
moment the board opens and **never fires again afterwards**, tracked in a ref rather than derived: a
null url cannot tell "the teacher stopped the board" from "it has not started yet", and reopening a
board the teacher deliberately closed reads as a broken control.

## The recording composites SPOTLIGHT, and `startRecording`'s arguments are positional

The config is `{ layout: { type: 'SPOTLIGHT', priority: 'PIN' }, theme: 'DARK', mode:
'video-and-audio', quality: 'high', orientation: 'landscape' }`. SPOTLIGHT rather than GRID because
this is a board-centric class: what is worth keeping is the board and whoever is talking over it, not
forty tiled faces shrinking as the room fills. The board is ratio-locked to 16:9 partly for this - the
cloud composites at 1280x720, so the shape on screen is the shape the class gets back.

**`startRecording(webhookUrl, awsDirPath, config, transcription)` takes four positional arguments and
all four are optional.** So `startRecording(RECORDING_CONFIG)` passes the config as the webhook URL
and the recording runs with the default layout, silently, with no error anywhere. The two leading
nulls are load-bearing. Do not tidy them away.

The typings disagree with the runtime on three points at once: `meeting.d.ts` declares `webhookUrl`
and `awsDirPath` as required `string`, requires `config.layout.gridSize`, and has no `orientation`
field. One cast at that call site, the same treatment `onEntryResponded` gets, rather than loosening
the config's own type.

Start and stop are fire-and-forget. The truth about whether recording is running arrives on
`onRecordingStateChanged`, so nothing awaits a promise whose value would be stale by the time a caller
read it, and the toast fires on the **transition** rather than on the click - the teacher is told what
the SDK actually did, and their message and every other participant's badge agree.

## `StrictMode` is off, deliberately

React double-invokes effects in development. `MeetingBridge`'s join is one of them, so with
`StrictMode` on, one browser joins the meeting twice and appears in the room as two participants, each
holding a live microphone. It presents as an SDK bug or as broken participant bookkeeping, and it is
neither.

A ref guard would suppress it and would also suppress a genuine double-mount, which is the class of
bug `StrictMode` exists to reveal. The trade is made once, in `src/main.tsx`, rather than papered over
at the join site. If you are putting it back: join a real room first and count the participants.

## Audio is one element per remote participant, and not the SDK's `AudioPlayer`

The SDK ships an `AudioPlayer` that gets the important parts right. `RemoteAudio` exists anyway for
two reasons: `AudioPlayer` opens a **second** `useParticipant` subscription for someone the seam
already bridges, doubling the per-participant listener count, and it reports autoplay rejections to
`console.error`, where a silent room is indistinguishable from a broken one.

The seam's version reads the track from the store's non-reactive registry, so it adds no
subscriptions at all, and it catches the autoplay rejection with a named warning.

**The local participant is skipped by the parent and muted on the element.** Belt and braces on
purpose: the classic feedback howl is a live local mic played back through local speakers, and
`muted` alone has been flipped by a well-meaning refactor before. Every `<video>` in the app is muted
for the same reason - tiles, the precall preview and the screen stage all carry video only.

## The class clock counts from mount, not from when the class started

The SDK exposes no session start time, so there is nothing to anchor a shared clock to. The elapsed
time in the top bar is seconds since **this participant** mounted, and a per-viewer clock that is
honest about what it measures beats a shared one the app would have to invent.

`useElapsedSeconds` reads the wall clock rather than counting ticks. An interval that fires sixty
times is not sixty seconds - a backgrounded tab throttles timers to once a minute - and the lobby
copy escalates off the same hook, so a student who switched away and came back would otherwise find
it stuck in its first tier.

**Nothing in this app navigates off a timer.** The clock ticks words and reveals buttons. A student
about to be admitted at second 95 must not be ejected at 90.

## Class mode has no top bar

Lecture keeps the 56px header. Class drops it and moves the title, the mode chip, the recording badge
and the clock into the control bar, flanking the controls absolutely so they stay centred on the
window rather than on whatever is left after the title. That 56px goes back to the rail and the board.

The recording badge is **never hidden at any width**, in either mode. A cold student named the absence
of a recording indicator as the thing that would stop them unmuting, and the composite genuinely does
capture the board, the ink and live cursors with name tags.

## Board chrome is anchored inside the fitted rect, below a row the probe never saw

The board is ratio-locked and centred, so on a short window the fitted rect is narrower than the
region around it. Chrome anchored to the container hangs off the board's edge into the dark surround -
visible at 1100x780, and it reads as a bug rather than as chrome. `BoardStage` takes an `overlay`
prop and renders it **inside** the fitted rect instead.

That layer is `pointer-events-none` and every interactive leaf opts back in. The board underneath is
an iframe, and a full-bleed layer that still accepts pointer events eats every stroke before it
reaches the canvas.

Two collisions the real board exposed that the step-0 probe could not:

- **The collaborator row.** tldraw stacks avatar chips in the top-right corner and grows them
  leftwards as the class does. The probe drove a board with one participant on it, so the row never
  appeared and it is missing from the measured keepout table. `COLLABORATORS_HEIGHT` is why the knock
  stack starts 40px down.
- **The page menu is a fixed 346px**, not a fraction of the board. App chrome that centres itself on
  the board is narrower than the board at every size, so on a small board a centred pill lands on top
  of the menu. Centre in what is left of the board, not in the board.

Both are recorded in `src/lib/boardGeometry.ts` so the next overlay does not rediscover them.

The teacher's floating stack is one column, top-right, and it belongs to whichever surface is on
centre stage - it follows a screen share up. Knocks sit above hands: somebody waiting to be let in has
nothing else on screen, while a raised hand is also in the rail and in the roster.

## One toast, bottom centre, painted on an opaque surface

The room had no way to say that something just happened. Mute-all did its work and rendered nothing.
The toast primitive is small on purpose - one message at a time, newest wins, no queue and no
positioning API - and its tones come from the same tokens `Alert` uses, so a toast and an inline alert
of the same tone read as the same thing.

**The position was measured rather than chosen.** Bottom centre at the reflex offset lands squarely on
the hosted board's centred toolbar, covering the pen and the eraser for four seconds immediately after
the teacher pressed a button. It sits 156px up instead, which clears the 64px control bar, the 24px
stage padding and the board's own 56px toolbar pill.

That puts the card over a white board, and the dark theme's 25%-alpha tone backgrounds blend toward
white there and leave washed pastel behind light text. **The tone layer is painted over an opaque
surface** so the colour is what the tokens intend on any backdrop, with a drop shadow to lift it off
the board.

## Home is one command line, not a stack of cards

Starting a class and joining one are the same act from two sides, so they are one field with one
submit and a toggle between them, rather than a heading with a composer and a link-styled row
underneath.

The heading says which one the line is about to make you - **teacher when you start, student when you
join** - because the role is a consequence of owning the room and not a choice anyone gets to make
here. The mode switcher leaves rather than sitting disabled while joining: joining a class that
already exists cannot change its mode.

The join field accepts a full link or a bare room id, because people paste both.

Home is a summary and not an archive: three classes and three recordings, with `/classes` and
`/recordings` behind a "View all" that only appears on evidence. Recordings are fetched one over the
preview so that button can be decided on a count rather than on a guess - VideoSDK reports a count per
room, not per account, so there is no total to ask for. They are also a **separate** fetch from the
class list, because they go through `api/` and out to VideoSDK, and a slow or dead recordings call
must not keep the classes off the screen.

## `rooms.ended_at` is written by the teacher's own client, and Home is told separately

For a while this column was read in two places and written in none. `api/session.ts` refused a room
that had it set, `ClassRow` dimmed such a row and dropped Open and Copy link, and nothing ever set it -
so an ended class still looked live on Home and its link dead-ended at the SDK rather than at a
sentence. `endRoom()` in `src/lib/rooms.ts` closes that.

**It goes straight to Supabase under RLS, with no endpoint.** `rooms_update_own` already says only the
owner may write the row and its `with check` repeats the predicate, so a student running the same
update matches zero rows rather than being refused. There is nothing here the service role would
decide differently, and this is the same reasoning that puts `listMyRooms` on the browser client.
`is('ended_at', null)` keeps the first ending, so reopening a link and ending again does not move the
timestamp.

**The write is not awaited, and that was measured rather than assumed.** The first version awaited it
before navigating, on the grounds that Home starts fetching its list immediately and the two would
race. Driven in a browser: the round trip outlived a 1500ms grace period while the meeting was tearing
down, and the teacher still landed on their own ended class with Open and a copyable link on it. Any
timeout long enough to win that race is long enough to hold someone inside a room that has already
closed.

So the navigation carries `state: { endedRoomId }` and Home marks that one row ended on its first
paint. The teacher who just pressed End is first-hand evidence; the fetch agrees a moment later.
Verified end to end: End returns to Home in **39ms**, the row reads "ended" with no Open or Copy link,
a fresh document loading `/classes` shows the same from Postgres alone, and reopening the class link
answers **409** with "This class has ended".

Two honest edges. A failed write leaves the row saying live, logged and not surfaced - the class has
ended either way, and the next end corrects it. And a teacher who closes the tab rather than pressing
End never runs this at all; the VideoSDK room still closes when the last participant leaves, but the
row stays live. Marking that would need a webhook, and the button is the path the product actually
teaches.

**Ended is not terminal, and the teacher's next join is the restart.** The first version of this made
it terminal, and that was wrong in a way only visible from the dashboard: pressing End burned the
class link, so "Your classes" quietly became a history list and teaching the same class next week
meant a new room and a new link for everyone. A VideoSDK `roomId` outlives the session held in it, so
"ended" is a fact about the last class rather than about the room.

`api/session.ts` therefore clears `ended_at` when the **owner** asks for a token on an ended room, and
still answers students 409 until then. Ownership decides it, on the same comparison that mints the
permissions, and nothing in the request is consulted. It is done there rather than through a second
endpoint because the teacher opening the class already is the restart - a separate "reopen" call is
one more thing to forget, and forgetting it would strand the room in a state only the database knows
about. The row's action reads **Start again** instead of Open, and Copy link is withheld while the
class is ended, because that link is a 409 for everyone the teacher would send it to.

Driven end to end: End leaves the row "ended | Start again"; a student on the same link gets "This
class has ended"; Start again puts the teacher back in the same `roomId`; the student's original link
then reaches precall; and a fresh document reading `/classes` shows the row live again with Copy link
and Open back. The student-facing copy says the link keeps working rather than asking for a new one.

## The room screen is responsive: phone, tablet, desktop, as a third axis

Until now the room screen had one real breakpoint - `PANEL_OVERLAY_BREAKPOINT` in `boardGeometry.ts`,
which floats the side panel when there is no longer room for it beside the board. That breakpoint is
board-width arithmetic, not a device category, and it stays exactly as it was. Device class is a
different question and a separate hook: `useDeviceClass()` in `src/lib/useDeviceClass.ts`, phone below
768px, tablet 768-1023px, desktop from 1024px - Tailwind v4's own default `md`/`lg` breakpoints,
unmodified in this project, kept in sync on purpose rather than reinvented. It is `useSyncExternalStore`-based
for the same reason `useMediaQuery` is: the first paint already knows the answer, so a phone never
renders the desktop tree for one frame first.

`ClassMode` (fixed per room), the panel-overlay breakpoint (board width), and device class (screen
size) are three independent axes. Nesting all three ad hoc would be a six-case matrix, so phone is a
full override: it replaces stage assembly regardless of mode. Tablet and desktop keep today's
mode-based tree unchanged (`VideoRail` for Class, `LectureStage` inside `SidePanel` for Lecture), and
differ from each other only in how compact the control bar's title/clock cluster is.

**Phone converges Class and Lecture onto one layout.** `MobileStrip` (`src/components/MobileStrip.tsx`)
replaces both `VideoRail` and `LectureStage` below the phone breakpoint: teacher tile first, then the
viewer's own tile, then everyone else scrollable - the ordering a student actually looks for, and the
same ordering regardless of which mode the room was created in. The pin-then-dedupe-then-cap mechanics
that `VideoRail` already had were extracted into `src/lib/railOrder.ts` so the two rails can't quietly
drift on what "pinned" means; the pin *order* itself stayed a caller choice, because `VideoRail` pins
self first and `MobileStrip` deliberately pins the teacher first, and collapsing that into one shared
default would have silently changed one of the two.

**The board renders on phone. Its geometry does not change to get there.** `BOARD_RATIO`,
`MIN_BOARD`, `BOARD_HARD_FLOOR_WIDTH` and `isBoardBelowFloor` in `boardGeometry.ts` are untouched -
they describe tldraw's measured chrome and the fixed 1280x720 recording composite, neither of which
depends on who is looking at the board. What changes is only the shell's reaction: `BoardStage` takes
a `warnOnSqueeze` prop (default `true`), and the phone caller passes `false`. The "this window is
small for a whiteboard" banner is desktop/tablet-only now - its own text names an 800px threshold no
phone can ever cross, so showing it there explained nothing. Driven in a browser at 390px: the board
renders full-width with no banner, letterboxed to 16:9 inside the available stage height exactly as
it is everywhere else, tldraw's own toolbar wrapped the way it does below 800px on any surface.

**The recording badge lives on the strip on phone, not the control bar.** The rule that it is never
hidden at any width predates this work and still holds - what is new is *where* it satisfies that rule
below 768px. The phone control bar is already at capacity (see below), so a `recording` prop on
`MobileStrip` puts a small always-visible "Rec" chip on the one surface that is mounted at every
moment a phone participant is in the room, rather than behind a tap.

**The phone control bar is a different button set, not a hidden subset.** `PhoneControlBar`
(`src/components/PhoneControlBar.tsx`), dispatched from `ControlBar` when `useDeviceClass()` is
`'phone'`. Fixed order: student gets Mic, Camera, Hand-raise, More, End; teacher gets Mic, Camera,
More, End - no hand-raise slot, since a teacher has nobody to raise a hand to. Everything desktop's
bar carries beyond that - Chat, Participants, the whiteboard toggle, screen share, recording,
mute-all, and the two toggles that used to live in a nested teacher-only popover - flattens into one
`BottomSheet`. Desktop's two-tier structure (bar, then a popover opened from it) has no room to nest
again inside a sheet on a phone, so it becomes one tier there. Driven end to end in both a Class room
and a Lecture room, as teacher: the bar shows exactly Mic/Camera/More/End; More opens the sheet with
all six rows plus both toggles; Participants opens a second sheet titled "People (1)"; Escape closes
either from a focus trap that holds while it is open, confirmed by the dialog rendering as the
active/focused element in the accessibility tree.

**`BottomSheet`** (`src/design/ui/BottomSheet.tsx`) is a new shared primitive, since none existed -
scrim, `role="dialog" aria-modal="true"`, a hand-rolled focus trap and Escape-to-close (no library,
matching every other overlay in this app), `max-height: 85dvh` so it never clips under mobile browser
chrome, safe-area bottom padding (`index.html` now carries `viewport-fit=cover` so that resolves on a
notched device), slide-up entrance. It backs both the phone "More" overflow and Chat/Participants on
phone - one primitive, different children, rather than two ad hoc panels. On phone, `SidePanel` is not
used at all: its other job, keeping `LectureStage` mounted, is already covered by `MobileStrip`.

**Tablet squeezes the existing control bar; it does not get a new layout.** Between `md` (768px) and
`lg` (1024px), `ControlBar`'s title/mode-chip/clock cluster truncates instead of the old binary
hidden-below-`lg` / hidden-below-`sm`: the title stays visible and truncates at a fixed max-width, the
mode chip shows its first letter, and the clock drops the word "Live" but keeps the dot and the
number. Recording badge classes are untouched - it already had no responsive hiding, so it already
satisfied "never hidden" through the squeeze band without a change. Driven at 820px in a Class room:
title, mode letter and a bare elapsed time all show at once, none of them absent, and the rest of the
tree (rail, board, control bar buttons) is pixel-identical to the desktop layout beneath it. Desktop
at 1440px is unchanged from before this work.
