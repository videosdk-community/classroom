/* TEMPORARY. Deleted at step 6, together with its two env vars and its single
   call site in RoomProvider.

   Step 4's checkpoint needs a real meeting token, but token minting is step 6
   (api/session.ts, against a verified Supabase session). This is the smallest
   thing that unblocks the checkpoint without becoming architecture.

   Gated on import.meta.env.DEV, and that specific check matters: Vite replaces
   it with the literal `false` in a production build, so this whole body -
   including the env reads - becomes dead code and is dropped. A check on the
   variable's presence would still inline a token into dist/ if someone set it
   in a build environment, which is exactly what .env.example promises cannot
   happen. This way the promise holds by construction rather than by care.

   Grep DEV_TOKEN to find every trace. */

export interface DevSession {
  token: string
  meetingId: string
}

export function devSession(): DevSession | null {
  if (!import.meta.env.DEV) return null

  const token = import.meta.env.VITE_DEV_MEETING_TOKEN
  const meetingId = import.meta.env.VITE_DEV_MEETING_ID
  if (!token || !meetingId) return null

  console.warn(
    '[DEV_TOKEN] Using a hand-minted meeting token from .env.local. Step 6 replaces this with api/session.ts.',
  )
  return { token, meetingId }
}
