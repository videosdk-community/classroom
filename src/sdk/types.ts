/* App-owned types.

   Deliberately declared here rather than re-exported from the SDK. The lint
   rule can stop feature code importing the vendor's package, but it cannot
   stop this directory re-exporting the vendor's types, and a re-export is a
   hole in the seam that no linter can see. If the SDK renames `Participant`,
   that is a change inside src/sdk/ and nowhere else.

   tsconfig.app.json sets erasableSyntaxOnly, so these are string-literal
   unions and never TS enums. */

export type RoomStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'closed'

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
  participantIds: readonly string[]
  participants: Readonly<Record<string, ParticipantView>>
  activeSpeakerId: string | null
  isRecording: boolean
  whiteboard: WhiteboardState
  entryQueue: readonly EntryRequest[]
  lastEntryDecision: EntryDecision | null
  topics: Readonly<Record<string, readonly RoomMessage[]>>
  lastError: { code: number; message: string } | null
}
