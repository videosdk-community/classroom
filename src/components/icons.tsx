import type { CSSProperties } from 'react'

/* Room icon set, ported from the videosdk-design skill's
   ui_kits/meeting-room/kit-icons.jsx. Source shipped as a global
   (window.RoomIcon) painting through dangerouslySetInnerHTML; this is the
   same 2px Lucide-style geometry as a typed component with a real union so a
   misspelt name is a build error rather than an empty box.

   Two glyphs the source does not carry, drawn in the same style:
   `board` (the whiteboard toggle) and `muteAll` (mute everyone). Both are
   control-bar actions this app has and a generic call UI does not. */

const PATHS = {
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/>',
  micOff:
    '<line x1="2" y1="2" x2="22" y2="22"/><path d="M18.89 13.23A7 7 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" y1="19" x2="12" y2="22"/>',
  cam: '<path d="m23 7-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
  camOff:
    '<line x1="2" y1="2" x2="22" y2="22"/><path d="M10.66 5H14a2 2 0 0 1 2 2v2.34l1 1L23 7v10M16 16a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
  phoneOff:
    '<path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><line x1="22" y1="2" x2="2" y2="22"/>',
  more: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  record: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
  signal: '<path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4v16"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  pin: '<path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  /* Added here, not in source: a board with a pen stroke across it. */
  board: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M12 17v3M9 20h6"/><path d="M6 13c2-3 4-4 6-2s3 1 4-1"/>',
  /* Added here, not in source: a mic-off crossed through, for muting everyone
     at once. Distinct from `micOff`, which is self-mute. */
  muteAll:
    '<path d="M9 4a3 3 0 0 1 6 0v6a3 3 0 0 1-.4 1.5"/><path d="M5 10v2a7 7 0 0 0 11.5 5.4"/><path d="M19 12v-2"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/><line x1="2" y1="2" x2="22" y2="22"/>',
} as const

export type IconName = keyof typeof PATHS

export interface RoomIconProps {
  name: IconName
  size?: number
  strokeWidth?: number
  className?: string
  style?: CSSProperties
}

export function RoomIcon({ name, size = 20, strokeWidth = 2, className, style }: RoomIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ flexShrink: 0, display: 'block', ...style }}
      dangerouslySetInnerHTML={{ __html: PATHS[name] }}
    />
  )
}
