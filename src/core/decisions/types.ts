import type { Recall } from '../memory/recall'
import type { Personality, SpeakerKind } from '../world/content'

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
  world: { name: string; setting: string }
  resident: {
    id: string
    name: string
    age: number
    occupation: string
    bio: string
    traits: string[]
    alignment?: string
    ancestry?: string
    personality: Personality
  }
  relationships: { id: string; name: string; label: string }[]
  announcement: {
    id: string
    text: string
    speakerKind: SpeakerKind
    speakerName: string
    relationToSpeaker: string | null
    place: string | null
    placeLabel: string | null
  }
  situation: { activity: string; time: string; season: string; weather: string }
  rumors: Rumor[]
  previous: Decision | null
  townsfolk: { id: string; name: string }[]
  /** What this resident remembers that bears on it; absent in the benchmark, which must be reproducible. */
  memory?: Recall
}

export interface TokenUsage {
  inputTokens?: number
  outputTokens?: number
  costUsd?: number
  /** 'host' when the provider reported the cost, 'table' when it was estimated from a price list. */
  costSource?: 'host' | 'table'
}

export type DecisionEvent =
  | { type: 'reasoning'; delta: string }
  | { type: 'final'; decision: Decision }
  /** What the provider sent and got back, surfaced for transparency; optional for providers. */
  | { type: 'request'; system: string; prompt: string }
  | { type: 'response'; text: string; usage?: TokenUsage }

export interface DecisionProvider {
  readonly id: string
  readonly label: string
  decide(ctx: DecisionContext, signal: AbortSignal): AsyncIterable<DecisionEvent>
}
