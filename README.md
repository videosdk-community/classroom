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

In progress. The shell, the SDK seam, precall, auth and server-derived roles
are done; the lobby and the class controls are next. See `docs/DECISIONS.md`
for what is already settled and why.

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
pnpm vercel login && pnpm vercel link
pnpm dev
```

`pnpm dev` runs `vercel dev`, which serves the app **and** the serverless
functions in `api/` from **one origin on port 3000**. Plain `vite` has no
`/api` at all, so a sign-in there fails on a request that returns `index.html`
instead of JSON. `pnpm dev:vite` exists for pure UI work where that does not
matter.

You need a [VideoSDK](https://app.videosdk.live) API key and secret, and a
Supabase project. **`VIDEOSDK_API_KEY`, `VIDEOSDK_SECRET` and the Supabase service
role key are server-only and must never carry a `VITE_` prefix** - anything
`VITE_`-prefixed is inlined into the browser bundle at build time.

In your Supabase project, enable **Authentication - Providers - Anonymous
sign-ins**. That is the default way in: a name and a button, no email. Raise the
anonymous sign-in limit under **Authentication - Rate Limits** too - the default
is 30 an hour per IP, and a class sharing one network shares one IP.

Magic link stays as the way to get an account that outlives the browser, so also
add `http://localhost:3000/**` and your deployed domain to **Authentication -
URL Configuration - Redirect URLs**, and set the Site URL to match. The built-in
email sender is rate-limited to a few messages an hour, which is enough to sign
in but not enough to iterate on.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | App **and** `api/` functions on `localhost:3000`, via `vercel dev` |
| `pnpm dev:vite` | Vite alone on `localhost:5173`. No `/api` - UI work only |
| `pnpm build` | Typecheck, then production build |
| `pnpm lint` | oxlint, including the SDK seam rule |
| `node scripts/dev-session.mjs <email>` | Sign a test account in without an email |

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
- **Your role is decided by the server**, from who owns the room in Supabase. It is
  never read from the URL, a query string, or anything else the browser says.

None of that is a workaround; it is what the platform actually offers, and
`docs/DECISIONS.md` explains each one.
