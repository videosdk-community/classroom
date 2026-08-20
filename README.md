# Classroom

An interactive online classroom built entirely on [VideoSDK](https://videosdk.live).
A teacher opens a room, students join, and a **shared whiteboard sits at the centre
of the screen** with live video, chat, and hand-raising around it.

> Live demo: _added at deploy._

The whole app turns on one small API:

```jsx
import { useWhiteboard } from "@videosdk.live/react-sdk";

const { startWhiteboard, stopWhiteboard, whiteboardUrl } = useWhiteboard();

{whiteboardUrl && <iframe src={whiteboardUrl} />}
```

Three members, and a video call becomes a teaching surface.

## Status

Scaffolded. The shell, the SDK seam, auth, the lobby and the class controls are
being built in order - see `docs/DECISIONS.md` for what is already settled.

## Stack

- Vite + React + TypeScript + Tailwind v4
- `@videosdk.live/react-sdk` 1.1.x, behind an app-owned seam in `src/sdk/`
- Supabase for auth and rooms only
- Vercel serverless functions for VideoSDK token minting

## Quickstart

```bash
pnpm install
cp .env.example .env
# fill in the values, then
pnpm dev
```

You need a [VideoSDK](https://app.videosdk.live) API key and secret, and a
Supabase project. **`VIDEOSDK_API_KEY`, `VIDEOSDK_SECRET` and the Supabase service
role key are server-only and must never carry a `VITE_` prefix** - anything
`VITE_`-prefixed is inlined into the browser bundle at build time.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Vite dev server |
| `pnpm build` | Typecheck, then production build |
| `pnpm lint` | oxlint, including the SDK seam rule |

## The SDK seam

`src/sdk/` is the only directory allowed to import `@videosdk.live/react-sdk`.
That is enforced by a lint rule, not by convention, so an SDK bump touches one
directory. See `src/sdk/README.md`.

## Worth knowing before you read the code

- **Anyone who loads the whiteboard can draw on it.** The SDK has no pen
  permission, so "only the teacher starts the board" is a UI convention here.
- **A teacher can mute a student but cannot force-unmute them** - unmute only
  sends a request the student accepts.
- **Students knock.** They hold `ask_join`, so joining goes through a lobby.

None of that is a workaround; it is what the platform actually offers, and
`docs/DECISIONS.md` explains each one.
