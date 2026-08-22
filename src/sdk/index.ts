/* The seam's entire public surface.

   Hand-curated on purpose. The lint rule stops feature code importing the SDK,
   but nothing stops this file re-exporting the SDK's hooks or types, and that
   would be a hole no linter can see. Everything below is app-shaped.

   Note what is NOT exported: useSelector. Every selector must be a
   module-level constant, and an exported useSelector would invite inline
   arrows that silently read stale values. */

export { RoomProvider } from './RoomProvider'
export { CHAT_TOPIC, CLASS_CONTROLS_TOPIC, HANDS_TOPIC } from './topics'
export type { RoomProviderProps } from './RoomProvider'

export {
  useRoomStatus,
  useLocalId,
  useTeacherId,
  useParticipantIds,
  useParticipantView,
  useParticipantViews,
  usePresenterId,
  useIsRecording,
  useWhiteboard,
  useEntryQueue,
  useEntryDecision,
  useMediaRequest,
  useLeaveReason,
  useRoomError,
  useTopic,
  useClassControls,
  useRaisedHands,
  useRoomActions,
  useTrack,
} from './hooks'

/* Leave-reason codes, as values. Feature code compares against these rather
   than against bare numbers, so the meaning of 1011 lives in one place. */
export {
  LEAVE_ROOM_CLOSE,
  LEAVE_MEETING_END_API,
  LEAVE_DUPLICATE_PARTICIPANT,
  LEAVE_MANUAL,
  LEAVE_REMOVED,
  LEAVE_REMOVED_ALL,
  LEAVE_REMOVED_API,
} from './types'

export type {
  RoomStatus,
  LeaveReason,
  ParticipantView,
  EntryRequest,
  EntryDecision,
  MediaRequest,
  WhiteboardState,
  RoomMessage,
  TrackKind,
} from './types'

export { encodeControls, encodeHand, DEFAULT_CONTROLS } from './controls'
export type { ClassControls } from './controls'

export { usePrecall } from './media/usePrecall'
export type { PrecallState, PrecallTracks } from './media/usePrecall'
export type { MediaDeviceOption } from './media/devices'
export type { DoorState } from './media/permissions'
