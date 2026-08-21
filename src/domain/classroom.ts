/* The classroom's own vocabulary.

   View-model types for components that know nothing about meetings - Tile,
   ChatPanel, TopBar, PeoplePanel. They live here rather than in src/sdk/types
   deliberately: that directory exists so an SDK rename touches one place, and
   putting these behind the seam would make every presentational component
   import from src/sdk, inverting the rule the lint override protects.

   They started life in src/fixtures/, which is fake data with a short life.
   These outlive it. */

export type Role = 'teacher' | 'student'

export interface Person {
  id: string
  name: string
  role: Role
  micOn: boolean
  camOn: boolean
  handRaised: boolean
  speaking: boolean
  onstage: boolean
}

export interface ChatMessage {
  id: string
  who: string
  text: string
  mine: boolean
  at: string
}

/** Layout plus convention, both of them. Fixed at room creation and read once
    at join; there is no mid-class switch, so nothing here announces a change. */
export type ClassMode = 'class' | 'lecture'
