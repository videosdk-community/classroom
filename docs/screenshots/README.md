# Screenshot capture brief

The README references seven files in this directory. Capture them in one pass
against a running app, with a real class in progress and real ink on the board.

## Frame

Every shot is **1512 x 982 CSS pixels at deviceScaleFactor 2**, so 3024 x 1964
on disk. That is the MacBook 14 inch logical resolution at retina scale.
Viewport only, never full-page, so the aspect ratio stays constant across the
set and the README grid does not go ragged.

## Cast

The names are a joke that rewards reading the screenshot closely. Keep them.

| Role | Name |
|---|---|
| Teacher | Ms. Frizzle |
| Student, hand raised | Hermione Granger |
| Student, in the lobby | Gandalf the Grey |
| Student | Ferris Bueller |
| Student | Grogu |
| Student | Bart Simpson |

Class titles: `Regex 201: Now You Have Two Problems` for the Class-mode room,
`Recursion 101: See Recursion 101` for the Lecture-mode room.

## Shots

| File | What must be in frame |
|---|---|
| `home.png` | Signed-in teacher's Home: the start-a-class control and a populated class list. Never an empty state |
| `precall.png` | The device-check screen: camera preview area, device pickers, mic meter, join control. Shot on **real hardware**, without the fake-media flags, so the pickers show real device names. Camera off in frame, and no frame of the real camera saved |
| `classroom-desktop.png` | Hero. Teacher in Class mode, board centre stage with ink, tiles and control bar visible |
| `class-mode.png` | Class layout with several students joined, so the everyone-onstage arrangement is obvious |
| `lecture-mode.png` | Lecture layout, teacher onstage. Must visibly differ from `class-mode.png` |
| `whiteboard-student.png` | A student's read-only board. Toolbar absent, ink present |
| `lobby-knock.png` | Teacher's knock queue with a student waiting to be admitted |
| `chat-hands.png` | Side panel: chat messages and a raised hand |
| `recordings.png` | Recordings list with the in-browser player |

## Notes for the capture pass

- One browser context per participant. Tabs in one context share localStorage
  and would be the same account.
- Everyone joins with camera and mic off. The fake camera device renders a
  rolling test pattern that reads as broken; camera-off tiles render as clean
  avatars with names, and the board is the subject anyway.
- Chromium needs `--use-fake-device-for-media-stream`. That is `-device-`, not
  `-capture-`.
- Put real handwriting on the board before any shot that includes it. An empty
  canvas reads as a broken feature. The board is a cross-origin iframe, but
  real mouse input reaches it.
- The board needs at least 900 x 506 to be usable and has a hard floor at 800
  wide. Below that a shot misrepresents the product.
- Keep each file under about 1 MB so the README stays quick to load.
