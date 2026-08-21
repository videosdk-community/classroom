import type { ClassMode } from '../domain/classroom'

/* What api/session.ts hands back. Everything here is server-derived: the
   client sends a roomId and its Supabase access token, and nothing else in
   the request is read. */
export interface RoomSession {
  meetingId: string
  token: string
  mode: ClassMode
  title: string
  /* Decoration, for deciding which controls to draw. The real enforcement is
     the permissions array inside `token`, and nowhere else. */
  role: 'teacher' | 'student'
  participantId: string
  /* The teacher's participantId, derived server-side from room ownership.
     Everyone gets it, because every client needs to agree on who is onstage
     in Lecture and who carries the teacher label in the roster. */
  teacherParticipantId: string
  expiresIn: number
}
