import type { ClassMode } from '../domain/classroom'
import { apiPost } from './api'
import { supabase } from './supabase'

/* Rooms, from both directions.

   Creating one goes through api/rooms.ts, because it needs the VideoSDK
   secret and because public.rooms has no insert policy at all.

   Listing the ones you own goes straight to Supabase under RLS. That is what
   the owner-scoped select policy is for, and using it on the real path means
   a broken policy fails visibly here instead of hiding behind the service
   role forever. */

export interface Room {
  id: string
  roomId: string
  title: string
  mode: ClassMode
  createdAt: string
  endedAt: string | null
}

export async function createRoom(title: string, mode: ClassMode): Promise<Room> {
  const { room } = await apiPost<{ room: Omit<Room, 'endedAt'> }>('/api/rooms', { title, mode })
  return { ...room, endedAt: null }
}

export async function listMyRooms(): Promise<Room[]> {
  const { data, error } = await supabase
    .from('rooms')
    .select('id, room_id, title, mode, created_at, ended_at')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((r) => ({
    id: r.id as string,
    roomId: r.room_id as string,
    title: r.title as string,
    mode: r.mode as ClassMode,
    createdAt: r.created_at as string,
    endedAt: r.ended_at as string | null,
  }))
}

/* Marks a class ended, at the moment its teacher ends it.

   Straight to Supabase under RLS, like listMyRooms and for the same reason:
   `rooms_update_own` already says only the owner may write the row, and its
   `with check` is the same predicate, so a student running this against
   somebody else's class matches zero rows rather than being refused. There is
   nothing here the service role would decide differently, so there is no
   endpoint.

   `is('ended_at', null)` keeps the first ending. A teacher who ends a class,
   reopens the link and ends it again should not have the timestamp move to the
   second visit - the class ended when it ended.

   This is what `api/session.ts`'s 409 and the "ended" badge on Home have always
   read. Until this existed they read a column nothing wrote. */
export async function endRoom(roomId: string): Promise<void> {
  const { error } = await supabase
    .from('rooms')
    .update({ ended_at: new Date().toISOString() })
    .eq('room_id', roomId)
    .is('ended_at', null)

  if (error) throw new Error(error.message)
}

/** The link a student pastes. Same shape everywhere, so it is built once. */
export function classLink(roomId: string): string {
  return `${window.location.origin}/c/${roomId}`
}
