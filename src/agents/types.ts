import type { AnnouncementPlace, SpeakerKind } from '../sim/announcement'

export type Action = 'go' | 'stay_home' | 'warn' | 'investigate' | 'ignore'

export const ACTIONS: Action[] = ['go', 'stay_home', 'warn', 'investigate', 'ignore']

export interface Decision {
  action: Action
  /** Whether they believe the announcement is true, independent of what they choose to do. */
  believes: boolean
  /** People this resident will walk over and tell before acting, by resident id. */
  tell: string[]
  reasoning: string
  /** A short line said out loud, shown in a bubble on the map. */
  speech: string
  emoji: string
  confidence: number
}

export interface Rumor {
  fromId: string
  fromName: string
  relation: string | null
  message: string
}

export interface DecisionContext {
  resident: {
    id: string
    name: string
    age: number
    occupation: string
    bio: string
    traits: string[]
  }
  relationships: { id: string; name: string; label: string }[]
  announcement: {
    id: string
    text: string
    speakerKind: SpeakerKind
    speakerName: string
    relationToSpeaker: string | null
    place: AnnouncementPlace | null
    placeLabel: string | null
  }
  situation: { activity: string; time: string }
  rumors: Rumor[]
  previous: Decision | null
  townsfolk: { id: string; name: string }[]
}

export type DecisionEvent = { type: 'reasoning'; delta: string } | { type: 'final'; decision: Decision }

export interface DecisionProvider {
  readonly id: string
  readonly label: string
  decide(ctx: DecisionContext, signal: AbortSignal): AsyncIterable<DecisionEvent>
}
