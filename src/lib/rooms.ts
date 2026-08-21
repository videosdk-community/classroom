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

/** The link a student pastes. Same shape everywhere, so it is built once. */
export function classLink(roomId: string): string {
  return `${window.location.origin}/c/${roomId}`
}
