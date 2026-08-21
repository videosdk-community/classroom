import { LiveTile } from './LiveTile'

/* Lecture's stage: the teacher, and nobody else.

   It sits in the right column rather than in a rail above the board. One face
   across a 112px full-width band is waste, and the height it costs comes
   straight off the board - which is the product. In the column the tile is
   4:3 rather than 16:9, because panel width drives tile width here and a
   letterbox strip in a narrow column has no presence.

   Who the teacher is comes from the session, derived server-side from room
   ownership. Nothing here trusts a client's claim about its own role.

   The self tile underneath is deliberate and not decoration. In Class a
   student finds their own face in the rail; in Lecture there is no rail, and
   a student who cannot see themselves cannot answer "am I muted", which is
   the question that actually stops people speaking up. */

export interface LectureStageProps {
  teacherId: string | null
  selfId: string | null
  /** Whether the local participant is the teacher. When they are, the stage
      tile is already them and a second copy of the same face is noise. */
  isTeacher: boolean
}

export function LectureStage({ teacherId, selfId, isTeacher }: LectureStageProps) {
  return (
    <div className="shrink-0 border-b border-line p-3">
      {teacherId ? (
        <LiveTile id={teacherId} selfId={selfId} className="aspect-[4/3] w-full" />
      ) : (
        /* A class can be open before the teacher's participant event lands,
           and a student can be admitted into a room the teacher has since
           left. Both look the same from here, and both are better said than
           left as an empty rectangle. */
        <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl bg-inset px-4 text-center text-base text-ink-tertiary">
          Waiting for the teacher
        </div>
      )}

      {!isTeacher && selfId && (
        <LiveTile id={selfId} selfId={selfId} className="mt-2 ml-auto aspect-[4/3] w-1/2" />
      )}

      {/* Said on the surface, not only in DECISIONS.md. Lecture is layout and
          convention - it makes no claim to lock the audience out of the board,
          and a student who assumes otherwise simply never draws. */}
      <p className="mt-2 text-sm text-ink-tertiary">
        Only the teacher is onstage. Everyone can still draw on the board.
      </p>
    </div>
  )
}
