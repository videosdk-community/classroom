<div align="center">

# Classroom

**An interactive online classroom built on [VideoSDK](https://videosdk.live), where a shared whiteboard is the centre of the screen.**

[![VideoSDK](https://img.shields.io/badge/built%20on-VideoSDK-9d7bff)](https://videosdk.live)
[![React](https://img.shields.io/badge/React-19-149eca)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646cff)](https://vite.dev)
[![Deploy](https://img.shields.io/badge/deploy-Vercel-000000)](https://vercel.com/new)

[Quickstart](#quickstart) · [How it works](#how-it-works) · [SDK notes](#sdk-notes) · [Whiteboard docs](https://docs.videosdk.live/react/guide/video-and-audio-calling-api-sdk/collaboration-in-meeting/whiteboard)

<!-- Live demo: add the deployed URL here, and a classroom screenshot above this line. -->

</div>

---

Video, audio, chat, whiteboard, recording and the lobby all come from VideoSDK. No second real-time
vendor appears anywhere in the app.

## The whiteboard

```jsx
import { useWhiteboard } from "@videosdk.live/react-sdk";

const { startWhiteboard, stopWhiteboard, whiteboardUrl } = useWhiteboard();

{whiteboardUrl && <iframe src={whiteboardUrl} title="Whiteboard" />}
```

`whiteboardUrl` flips from `null` to a URL for every participant at once. That is the whole sync
mechanism. Render it in an iframe and a video call becomes a teaching surface.

## Features

| | |
|---|---|
| **Shared board** | Teacher draws, everyone watches the strokes land live. Students get a read-only board with the zoom menu |
| **Two class shapes** | Class puts everyone onstage, capped at 12 tiles. Lecture puts the teacher onstage with promote-to-stage. Fixed at room creation |
| **Real lobby** | Students knock, teacher admits or denies from a queue |
| **Class controls** | Mute all, ask to unmute, remove, raise hand, and teacher toggles that disable chat or hands room-wide |
| **Screen share** | Covers the board while it runs, gives it back untouched when it stops |
| **Cloud recording** | Recorded composite includes the board, prior ink, and live cursors with name tags. Owner-only list and player |
| **Guest sign-in** | Name and a button. A guest is a real Supabase user, so RLS and ownership work untouched |

## Quickstart

```bash
git clone https://github.com/videosdk-live/classroom
cd classroom
pnpm install
cp .env.example .env    # fill it in, see below
pnpm vercel login && pnpm vercel link
pnpm dev:api            # http://localhost:3000
```

Use `pnpm dev:api`. It runs `vercel dev`, which serves the app and the `api/` functions from one
origin. `pnpm dev` is Vite alone with no `/api` at all, for UI work only.

### Environment

Key and secret from the [VideoSDK dashboard](https://app.videosdk.live), the rest from your Supabase
project.

```bash
# Server-only. Never prefix these with VITE_.
VIDEOSDK_API_KEY=
VIDEOSDK_SECRET=
SUPABASE_SERVICE_ROLE_KEY=

# Safe in the browser. These are meant to ship.
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

`VITE_`-prefixed values are inlined into the bundle. `pnpm build` runs
`scripts/check-bundle-secrets.mjs` and fails if a server-only name or value reaches `dist/`.

### Supabase

Run both files in `supabase/migrations/` oldest first. Then in the dashboard:

1. **Authentication - Providers - Anonymous sign-ins**: on. This is the default way in.
2. **Authentication - Rate Limits**: raise the anonymous limit. The default 30/hour per IP is one
   classroom on one network.
3. **Authentication - URL Configuration**: add `http://localhost:3000/**` and your deployed domain
   to the redirect allowlist.

The built-in email sender is capped at a few messages an hour. `node scripts/dev-session.mjs <email>`
signs a test account in without one.

### Deploy

Import the repo on Vercel, set the same five variables, ship. `vercel.json` already routes `api/` to
functions and everything else to the SPA. Add the deployed origin to the Supabase redirect allowlist.

## How it works

**Roles come from the server.** `api/session.ts` verifies the Supabase session, compares the caller
to `public.rooms.owner_id`, and mints `['allow_join','allow_mod']` or `['ask_join']` from that alone.
Nothing role-shaped is ever read from the request body, the query string or the URL. Enforcement is
the `permissions` array inside the signed token; the `role` field in the response only decides which
buttons to draw.

**One directory imports the SDK.** `useMeeting`, `useParticipant`, `useWhiteboard` and `usePubSub`
each open a subscription per call site, so calling them from feature code multiplies subscriptions.
`src/sdk/` subscribes each once in a bridge that renders nothing and pushes into a store; feature
hooks read it through `useSyncExternalStore`. An oxlint rule keeps every other directory out.

**Class controls ride persisted pubsub.** Toggles and raised hands publish on persisted topics, so
`onOldMessagesReceived` replays them to late joiners. Each message is a full snapshot rather than a
delta, and only the server-derived teacher id counts as a sender. Each client honors the toggles;
nothing server-side stops a crafted publish, and `allow_mod` is the only real enforcement.

## SDK notes

Platform behaviour worth knowing before you design around it. `docs/DECISIONS.md` has the reasoning
and the probe evidence for each.

- **The pen is a URL parameter, not an SDK permission.** `useWhiteboard` has no role member. The
  board honours `&drawOnWhiteboard=false` on its own URL, undocumented on the React path, and
  `src/lib/boardSrc.ts` appends it for everyone but the teacher. It also costs pointer pan and
  ctrl-wheel zoom, and a participant can read the URL, so it withholds the pen rather than enforcing.
- **A teacher can mute but cannot force-unmute.** `enableMic()` fires `onMicRequested` on the target,
  who accepts or rejects. The button says "Ask to unmute".
- **A denied student does not disconnect.** The SDK holds them at `CONNECTING`, so the app calls
  `leave()` itself.
- **`startWhiteboard()` in the same beat as `onMeetingJoined` is dropped silently.** No throw, no
  `onError`. The teacher's auto-start retries until the board opens.
- **`startRecording`'s four arguments are positional.** Passing the config alone sends it as the
  webhook URL and the layout defaults, with no error anywhere.
- **Where the docs and the typings disagree, the shipped bundle wins.** `onEntryResponded` arrives as
  two positional arguments, pubsub message ids can be empty strings, whiteboard error codes 4054-4056
  have no exported symbol, and there is no host-left event at all.

## Project layout

| Path | What is in it |
|---|---|
| `api/` | Vercel functions. `session.ts` mints the meeting token, `rooms.ts` creates a class, `recordings.ts` lists your own |
| `src/sdk/` | The seam. Bridges, store, topics, media. The only SDK importer |
| `src/domain/` | The classroom's own types: Person, ChatMessage, ClassMode |
| `src/session/` | Fetches the room session above precall and room, because `MeetingProvider` reads its config once |
| `src/screens/` | Home, sign-in, precall, classroom, classes, recordings |
| `src/components/` | Board stage, video rail, knock queue, chat, controls |
| `src/design/` | Vendored VideoSDK design tokens and primitives |
| `src/lib/` | Supabase and API clients, board geometry, the read-only board URL |
| `docs/DECISIONS.md` | Every settled decision, with what was probed and what it cost |

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev:api` | App and `api/` functions on port 3000, via `vercel dev`. Use this |
| `pnpm dev` | Vite alone. No `/api`, UI work only |
| `pnpm build` | `tsc -b`, Vite build, then the bundle secret check |
| `pnpm lint` | oxlint, including the SDK seam rule |
| `node scripts/dev-session.mjs <email>` | Sign a test account in without email |
| `node scripts/link.mjs <email>` | A redeemed session as JSON, for seeding a test browser |

No tests, by decision. Verification is two real browsers driven by hand, which is how every finding
in `docs/DECISIONS.md` was made.

## Learn more

- [Whiteboard guide](https://docs.videosdk.live/react/guide/video-and-audio-calling-api-sdk/collaboration-in-meeting/whiteboard)
- [useWhiteboard reference](https://docs.videosdk.live/react/api/sdk-reference/use-whiteboard)
- [Authentication and tokens](https://docs.videosdk.live/react/guide/video-and-audio-calling-api-sdk/authentication-and-token)
- [Get an API key](https://app.videosdk.live) - 10,000 free minutes a month
