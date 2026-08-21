/* App-owned types.

   Deliberately declared here rather than re-exported from the SDK. The lint
   rule can stop feature code importing the vendor's package, but it cannot
   stop this directory re-exporting the vendor's types, and a re-export is a
   hole in the seam that no linter can see. If the SDK renames `Participant`,
   that is a change inside src/sdk/ and nowhere else.

   tsconfig.app.json sets erasableSyntaxOnly, so these are string-literal
   unions and never TS enums. */

/* The meeting's connection state, as the bundle actually emits it.

   js-sdk's constants/meetingConnectionState.js emits exactly five:
   CONNECTING, CONNECTED, RECONNECTING, FAILED, DISCONNECTED. The react-sdk
   typings declare CLOSING and CLOSED instead of RECONNECTING, and neither of
   those is ever emitted - so a reconnect used to fall through our map as an
   unrecognised state and leave the UI showing whatever it said before. During
   a lobby wait that is the difference between "still trying" and a frozen
   screen. */
export type RoomStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'failed'

export interface ParticipantView {
  id: string
  name: string
  isLocal: boolean
  isTeacher: boolean
  micOn: boolean
  camOn: boolean
  isActiveSpeaker: boolean
}

/** What the lobby shows. The allow/deny closures are NOT here - see store.ts. */
export interface EntryRequest {
  participantId: string
  name: string
}

/* Why a meeting ended, from onMeetingLeft's payload.

   There is no host-left event and no room-ended event anywhere in the SDK -
   all 69 react-sdk event keys were listed to confirm it. The leave reason is
   the only signal that distinguishes "the teacher ended the class" from "you
   opened this class in another tab" from our own leave() after a denial. */
export interface LeaveReason {
  code: number
  message: string
}

/** The leave-reason codes this app acts on (js-sdk's leaveReason table). */
export const LEAVE_ROOM_CLOSE = 1006
export const LEAVE_MEETING_END_API = 1009
export const LEAVE_DUPLICATE_PARTICIPANT = 1011
export const LEAVE_MANUAL = 1101

export interface EntryDecision {
  participantId: string
  decision: 'allowed' | 'denied'
}

export interface WhiteboardState {
  url: string | null
  /** True while a start or stop is in flight. Ours, not the SDK's - see
      errors.ts for why 4056 cannot be the source of truth. */
  inFlight: boolean
  error: string | null
}

export interface RoomMessage {
  /** Synthesised. Never trust the wire id alone - it can be an empty string. */
  key: string
  topic: string
  text: string
  senderId: string
  senderName: string
  payload: Record<string, unknown>
  /** Server's monotonic sequence, when present. The SDK uses gaps in it to
      detect drops, so it is a real ordering key in a way `timestamp` is not. */
  seq: number | null
  /** Our clock, monotonic, for tie-breaking within a batch only. */
  receivedAt: number
}

export interface RoomSnapshot {
  status: RoomStatus
  meetingId: string | null
  localId: string | null
  /** The teacher's participantId, server-derived from room ownership. Fixed
      for the life of the store. Every row's role is decided against it, and
      it is what makes a class-control message believable. */
  teacherId: string | null
  participantIds: readonly string[]
  participants: Readonly<Record<string, ParticipantView>>
  activeSpeakerId: string | null
  isRecording: boolean
  whiteboard: WhiteboardState
  entryQueue: readonly EntryRequest[]
  lastEntryDecision: EntryDecision | null
  leaveReason: LeaveReason | null
  topics: Readonly<Record<string, readonly RoomMessage[]>>
  lastError: { code: number; message: string } | null
}
