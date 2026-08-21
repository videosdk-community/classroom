/* Fake data only. No SDK, no network, nothing that outlives a refresh.

   Feeds the /room fixture route, which is still the fastest way to judge the
   shell at a window size without burning meeting minutes. The types it is
   built from moved to src/domain/classroom.ts, because those outlive the fake
   data and the live path uses them too.

   Sized past the rail cap on purpose. A rail is not a plan for forty
   students, and the "+N" chip only proves it works if N is real. */

import type { ChatMessage, Person } from '../domain/classroom'

export const PEOPLE: Person[] = [
  { id: 'p1',  name: 'Zishan Ahmad',    role: 'teacher', micOn: true,  camOn: true,  handRaised: false, speaking: true,  onstage: true,  hue: 265 },
  { id: 'p2',  name: 'Aditi Rao',       role: 'student', micOn: true,  camOn: true,  handRaised: false, speaking: false, onstage: true,  hue: 200 },
  { id: 'p3',  name: 'Marcus Webb',     role: 'student', micOn: false, camOn: true,  handRaised: true,  speaking: false, onstage: true,  hue: 150 },
  { id: 'p4',  name: 'Lena Fischer',    role: 'student', micOn: false, camOn: false, handRaised: false, speaking: false, onstage: true,  hue: 25  },
  { id: 'p5',  name: 'Tomas Silva',     role: 'student', micOn: true,  camOn: true,  handRaised: false, speaking: false, onstage: true,  hue: 320 },
  { id: 'p6',  name: 'Priya Nair',      role: 'student', micOn: false, camOn: true,  handRaised: true,  speaking: false, onstage: true,  hue: 95  },
  { id: 'p7',  name: 'Sam Okafor',      role: 'student', micOn: false, camOn: false, handRaised: false, speaking: false, onstage: true,  hue: 240 },
  { id: 'p8',  name: 'Yuki Tanaka',     role: 'student', micOn: false, camOn: true,  handRaised: false, speaking: false, onstage: true,  hue: 180 },
  { id: 'p9',  name: 'Emma Lindqvist',  role: 'student', micOn: false, camOn: false, handRaised: false, speaking: false, onstage: true,  hue: 350 },
  { id: 'p10', name: 'Diego Herrera',   role: 'student', micOn: false, camOn: true,  handRaised: false, speaking: false, onstage: true,  hue: 60  },
  { id: 'p11', name: 'Nadia Haddad',    role: 'student', micOn: false, camOn: true,  handRaised: false, speaking: false, onstage: true,  hue: 15  },
  { id: 'p12', name: 'Oliver Bennett',  role: 'student', micOn: false, camOn: false, handRaised: false, speaking: false, onstage: true,  hue: 210 },
  { id: 'p13', name: 'Chen Wei',        role: 'student', micOn: false, camOn: true,  handRaised: true,  speaking: false, onstage: true,  hue: 130 },
  { id: 'p14', name: 'Fatima Zahra',    role: 'student', micOn: false, camOn: false, handRaised: false, speaking: false, onstage: true,  hue: 285 },
  { id: 'p15', name: 'Jonas Weber',     role: 'student', micOn: false, camOn: true,  handRaised: false, speaking: false, onstage: true,  hue: 45  },
  { id: 'p16', name: 'Ana Beatriz',     role: 'student', micOn: false, camOn: false, handRaised: false, speaking: false, onstage: true,  hue: 335 },
  { id: 'p17', name: 'Kwame Mensah',    role: 'student', micOn: false, camOn: true,  handRaised: false, speaking: false, onstage: true,  hue: 170 },
  { id: 'p18', name: 'Sofia Ricci',     role: 'student', micOn: false, camOn: false, handRaised: false, speaking: false, onstage: true,  hue: 300 },
]

export const TEACHER = PEOPLE[0]

export const MESSAGES: ChatMessage[] = [
  { id: 'm1', who: 'Aditi Rao',   text: 'can you scroll up a bit? the top line is cut off', mine: false, at: '10:02' },
  { id: 'm2', who: 'You',         text: 'better?', mine: true, at: '10:02' },
  { id: 'm3', who: 'Aditi Rao',   text: 'perfect thanks', mine: false, at: '10:03' },
  { id: 'm4', who: 'Marcus Webb', text: 'is the second derivative always zero here or only at the inflection point', mine: false, at: '10:05' },
  { id: 'm5', who: 'You',         text: 'only at the inflection point, drawing it now', mine: true, at: '10:05' },
  { id: 'm6', who: 'Priya Nair',  text: 'could you write the general form once more', mine: false, at: '10:07' },
  { id: 'm7', who: 'Chen Wei',    text: 'am I allowed to draw on this or is it just yours?', mine: false, at: '10:08' },
]
