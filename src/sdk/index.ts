/* The seam's entire public surface.

   Hand-curated on purpose. The lint rule stops feature code importing the SDK,
   but nothing stops this file re-exporting the SDK's hooks or types, and that
   would be a hole no linter can see. Everything below is app-shaped.

   Note what is NOT exported: useSelector. Every selector must be a
   module-level constant, and an exported useSelector would invite inline
   arrows that silently read stale values. */

export { RoomProvider, CHAT_TOPIC, CLASS_CONTROLS_TOPIC } from './RoomProvider'
export type { RoomProviderProps } from './RoomProvider'

export {
  useRoomStatus,
  useLocalId,
  useParticipantIds,
  useParticipantView,
  useIsRecording,
  useWhiteboard,
  useEntryQueue,
  useEntryDecision,
  useRoomError,
  useTopic,
  useRoomActions,
  useTrack,
} from './hooks'

export type {
  RoomStatus,
  ParticipantView,
  EntryRequest,
  EntryDecision,
  WhiteboardState,
  RoomMessage,
} from './types'

export { devSession } from './dev/devToken'
export type { DevSession } from './dev/devToken'
