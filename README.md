<div align="center">

# Classroom

**An interactive online classroom where a shared whiteboard is the centre of the screen, built entirely on [VideoSDK](https://videosdk.live).**

[![VideoSDK](https://img.shields.io/badge/built%20on-VideoSDK-9d7bff)](https://videosdk.live)
[![React](https://img.shields.io/badge/React-19-149eca)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646cff)](https://vite.dev)
[![Deploy](https://img.shields.io/badge/deploy-Vercel-000000)](https://vercel.com/new)

[Quickstart](#quickstart) · [How it works](#how-it-works) · [What the SDK does and does not do](#what-the-sdk-does-and-does-not-do) · [Whiteboard docs](https://docs.videosdk.live/react/guide/video-and-audio-calling-api-sdk/collaboration-in-meeting/whiteboard)

<!-- Live demo: add the deployed URL here, and a classroom screenshot above this line. -->

</div>

---

A teacher opens a class and teaches on a whiteboard the whole room watches live, with video, chat
and raised hands arranged around it. Students knock to get in and the teacher lets them through.
Every real-time piece of that is VideoSDK. The rooms, the tokens, the video and audio, the chat, the
recording and the whiteboard all come from one platform, and no second vendor appears anywhere in
the app.

The whole product turns on one hook with three members:

```jsx
import { useWhiteboard } from "@videosdk.live/react-sdk";

const { startWhiteboard, stopWhiteboard, whiteboardUrl } = useWhiteboard();

{whiteboardUrl && <iframe src={whiteboardUrl} title="Whiteboard" />}
```

`whiteboardUrl` flips from `null` to a URL for every participant at once. That is the entire sync
mechanism. Render it in an iframe and a video call is a teaching surface.

## What is in the app

- **One board, the teacher's pen.** The teacher opens the board and draws on it. Every student
  watches the same strokes land in real time on a board they cannot draw on, and keeps the zoom
  menu, so nothing drawn off-screen is out of reach.
- **Two class shapes.** Class puts everyone onstage with a video rail. Lecture puts the teacher
  onstage and lists students below, with promote-to-stage. Mode is picked at creation and fixed for
  the life of the room.
- **Server-derived roles.** A teacher holds `allow_join` + `allow_mod`, a student holds `ask_join`,
  and which one you get is decided from Supabase room ownership on the server.
- **A real lobby.** Students hold a weaker token, so they do not join, they knock. The teacher gets
  a queue with admit and deny; the student gets a waiting screen, a denied screen and an "Ask again".
- **Class controls.** Chat, raise hand, mute-all, ask-to-unmute, remove a student, and teacher
  toggles that disable chat or hand-raising for the room. Toggle state is persisted pubsub, so a
  student who joins late or reloads arrives in the state the teacher chose.
- **Screen share** covers the board while it runs and gives the board back untouched when it stops.
- **Cloud recording**, with an indicator every participant can see, plus a recordings list and an
  in-page player for the classes you own. The composite captures the board, including ink drawn
  before recording started, and live cursors with name tags.
- **Guest sign-in.** A name and a button. A guest is a real Supabase user, so ownership,
  permissions and RLS work untouched, and they can add an email later and keep every class they made.

## Quickstart

```bash
git clone https://github.com/videosdk-live/classroom
cd classroom
pnpm install
cp .env.example .env    # fill it in, see below
pnpm vercel login && pnpm vercel link
pnpm dev:api            # http://localhost:3000
```

Use `pnpm dev:api`. It runs `vercel dev`, which serves the app **and** the functions in `api/` from
one origin on port 3000. `pnpm dev` is Vite alone on the same port with no `/api` at all, so a
sign-in there fails on a request that answers with `index.html` instead of JSON. It exists for UI
work where that does not matter.

`vercel dev` cannot be the `dev` script itself. It reads `package.json`'s `dev` to decide what to
run, finds itself, and refuses with "must not recursively invoke itself".

### Environment

Get an API key and secret from the [VideoSDK dashboard](https://app.videosdk.live), and a URL,
publishable key and service role key from your Supabase project.

```bash
# Server-only. Never prefix these with VITE_.
VIDEOSDK_API_KEY=
VIDEOSDK_SECRET=
SUPABASE_SERVICE_ROLE_KEY=

# Safe in the browser. These are meant to ship.
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Anything `VITE_`-prefixed is inlined into the browser bundle at build time. `pnpm build` runs
`scripts/check-bundle-secrets.mjs` afterwards and fails if a server-only name or value reaches
`dist/`, sourcemaps included. A trailing space in the VideoSDK key signs a token the API rejects
with an error that blames the key, so the loader trims every value it reads.

### Supabase

Run both files in `supabase/migrations/` against a fresh project, oldest first, either with
`supabase db push` or by pasting them into the SQL editor. They create `public.rooms` with
owner-scoped RLS and no insert policy, and a daily `pg_cron` job that deletes guest accounts older
than 30 days.

Then, in the dashboard:

1. **Authentication - Providers - Anonymous sign-ins**: on. This is the default way in.
2. **Authentication - Rate Limits**: raise the anonymous sign-in limit. The default is 30 an hour
   per IP, and a class sharing one network shares one IP.
3. **Authentication - URL Configuration**: set the Site URL and add `http://localhost:3000/**` plus
   your deployed domain to the redirect allowlist. Magic link is how a guest turns into an account
   that outlives the browser.

The built-in email sender is capped at a few messages an hour, which is enough to sign in once and
not enough to iterate. `node scripts/dev-session.mjs <email>` mints and redeems the link for you.

### Deploy

Import the repo on Vercel, set the same five variables, and ship. `vercel.json` already routes
`api/` to functions and everything else to the SPA. Add the deployed origin to the Supabase
redirect allowlist before you test the magic link in production.

## How it works

### Roles come from the server, from ownership, and from nothing else

`api/session.ts` verifies the Supabase session, compares the caller to `public.rooms.owner_id`, and
mints `['allow_join','allow_mod']` or `['ask_join']` from that comparison alone. No role, mode or
participant id is ever read from the request body, the query string or the URL.

The `role` field in the response decides which buttons to draw. Enforcement is the `permissions`
array inside the signed token and nowhere else.

`participantId` is derived from the Supabase user id, so a seat belongs to an account rather than a
tab. The same login in two tabs collides, and the app says so instead of showing a bare disconnect.

Room creation needs the account secret, so it cannot happen in a browser. `public.rooms` has no
insert policy and the grant is revoked, which leaves `api/rooms.ts` under the service role as the
only way a row exists. A student never reads the table at all.

### One directory imports the SDK

`src/sdk/` is the only place allowed to import `@videosdk.live/react-sdk`, enforced by an oxlint
`no-restricted-imports` rule with an override for the seam itself.

The reason is not only SDK bumps. `useMeeting`, `useParticipant`, `useWhiteboard` and `usePubSub`
each open a subscription **per call site**, so calling them from feature code multiplies
subscriptions by however many components happen to render. Each one is subscribed once in a bridge
under `src/sdk/bridges/` that renders nothing and pushes into `src/sdk/store.ts`. Feature hooks read
that store through `useSyncExternalStore`. The one rule that keeps it from looping forever is that
`getSnapshot` never constructs.

`src/sdk/index.ts` is a hand-curated export list. No SDK hook or type is re-exported from it.

### Class controls ride persisted pubsub

Chat-disabled, hand-raise-disabled, the promoted list and raised hands are published on persisted
topics in `src/sdk/topics.ts`, so `onOldMessagesReceived` replays them to anyone who joins late.

Control state is a full snapshot per message rather than a delta, and only messages whose `senderId`
matches the server-derived teacher id count, so replay order cannot leave a client half-toggled.
Measured end to end: a student already in the room loses the chat composer 783ms after the teacher
turns chat off.

Be precise about what this is. Each client honors the toggles; nothing server-side stops a crafted
publish. `allow_mod` is the only real enforcement in the app.

## What the SDK does and does not do

None of this is a workaround. It is what the platform offers, written down so you can design around
it instead of discovering it late. `docs/DECISIONS.md` carries the reasoning and the probe evidence.

- **The pen is a URL parameter, not an SDK permission.** `useWhiteboard` is three members and none
  of them is a role, so the hook itself cannot tell a teacher from a student. The board can. It
  honours `&drawOnWhiteboard=false` in its own URL, which refuses every stroke and hides the toolbar
  and the style panel. Prebuilt documents that lever as `permissions.drawOnWhiteboard`; on the React
  path it is undocumented, and `src/lib/boardSrc.ts` appends it for everyone but the teacher. Two
  things come with it. Read-only takes pointer panning and ctrl-wheel zoom away, which is why the
  bottom-left zoom menu matters. And a parameter in a URL is something the participant can read and
  edit, so this withholds the pen at the board rather than enforcing anything. `allow_mod` remains
  the only real permission in the app.
- **A teacher can mute but cannot force-unmute.** `disableMic()` lands with no consent;
  `enableMic()` only fires `onMicRequested` on the target, who accepts or rejects. The button is
  named "Ask to unmute" for that reason.
- **A denied student does not disconnect.** The SDK holds them at `CONNECTING`, so the app calls
  `leave()` itself on denial. Without that line, denied and frozen look identical.
- **The board has no intrinsic aspect ratio.** It fills its container exactly, so the ratio is the
  app's choice and a bad one is the app's bug. Below 900x506 the toolbar wraps and eats the board
  from the bottom, which is why the shell takes width back from the side panel instead of shrinking
  the board past 800.
- **Where the docs and the typings disagree, the shipped bundle wins.** `onEntryResponded` arrives
  as two positional arguments while the `.d.ts` declares one object. Pubsub message ids can be empty
  strings, which collide silently as React keys, so keys are synthesised at the seam. Whiteboard
  error codes 4054, 4055 and 4056 have no exported symbol and are hard-coded there too. There is no
  host-left or room-ended event at all.

## Project layout

| Path | What is in it |
|---|---|
| `api/` | Vercel functions. `session.ts` mints the meeting token, `rooms.ts` creates a class, `recordings.ts` lists your own |
| `src/sdk/` | The seam. Bridges, store, normalisation, topics, media. The only SDK importer |
| `src/domain/` | The classroom's own vocabulary: Person, ChatMessage, ClassMode. Deliberately outside the seam |
| `src/session/` | Fetches the room session above the precall and room pair, because `MeetingProvider` reads its config once |
| `src/screens/` | Home, sign-in, precall, the live classroom, classes, recordings |
| `src/components/` | Everything the classroom is made of, from the board stage to the knock queue |
| `src/design/` | Vendored VideoSDK design tokens and primitives |
| `supabase/migrations/` | The rooms table, its RLS, and the guest cleanup job |
| `docs/DECISIONS.md` | Every settled decision, with what was probed and what it cost |

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev:api` | App and `api/` functions on `localhost:3000`, via `vercel dev`. Use this |
| `pnpm dev` | Vite alone on port 3000. No `/api`, UI work only |
| `pnpm build` | `tsc -b`, Vite build, then the bundle secret check |
| `pnpm lint` | oxlint, including the SDK seam rule |
| `node scripts/dev-session.mjs <email>` | Sign a test account in without waiting for an email |
| `node scripts/link.mjs <email>` | A full redeemed session as JSON, for seeding a test browser |

There are no unit tests, by decision. Verification is two real browsers plus one Playwright spec for
the flows that matter. Cross-participant tests need Chromium's
`--use-fake-device-for-media-stream` (`-stream`, not `-capture`, which Chrome ignores silently while
driving your real webcam) and should assert the device really is fake before anything else.

## Learn more

- [Whiteboard guide](https://docs.videosdk.live/react/guide/video-and-audio-calling-api-sdk/collaboration-in-meeting/whiteboard)
- [Authentication and tokens](https://docs.videosdk.live/react/guide/video-and-audio-calling-api-sdk/authentication-and-token)
- [useWhiteboard reference](https://docs.videosdk.live/react/api/sdk-reference/use-whiteboard)
- [Get an API key](https://app.videosdk.live) - 10,000 free minutes a month
