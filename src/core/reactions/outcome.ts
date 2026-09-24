import type { Decision } from '../decisions/types'
import type { WorldContent } from '../world/content'
import type { Place, Point } from '../world/types'
import { detectPlace, normalize, placeLabel, type Announcement } from './announcement'

/** How the art draws what actually happened; 'fire' and 'monster' are threats people run from. */
export type OutcomeVisual = 'fire' | 'monster' | 'feast' | 'treasure' | 'sparkle'

export const THREATS: OutcomeVisual[] = ['fire', 'monster']

export interface OutcomeDef {
  keywords: string[]
  visual: OutcomeVisual
  /** Finishes "Era verdad: …", e.g. "un dragón incendió". The place name follows. */
  label: string
}

export interface Outcome {
  truth: boolean
  visual: OutcomeVisual
  /** Sentence for people: what turned out to happen, or that nothing did. */
  summary: string
  place: string | null
  at: Point
}

/** Picks what happens and where, from the announcement's own words; the truth is decided elsewhere. */
export function planOutcome(content: WorldContent, places: Place[], a: Announcement & { truth: boolean }): Outcome {
  const t = ` ${normalize(a.text)} `
  const def = content.outcomes?.find((d) => d.keywords.some((k) => t.includes(normalize(k))))
  const danger = content.vocabulary.danger.some((w) => t.includes(normalize(w)))
  const visual = def?.visual ?? (danger ? 'monster' : 'sparkle')
  // "Refúgiense en casa: un dragón sobre el bosque" happens in the forest, not at home.
  const where = detectPlace(a.text, places, []) ?? (a.place !== 'home' ? a.place : null) ?? content.gatheringPlace
  const place = places.find((p) => p.id === where) ?? places.find((p) => p.id === content.gatheringPlace)!
  const n = place.spots.length
  const at = place.spots.reduce((c, s) => ({ x: c.x + (s.x + 0.5) / n, y: c.y + (s.y + 0.5) / n }), { x: 0, y: 0 })
  const name = placeLabel(content, place.id) ?? 'el pueblo'
  const summary = a.truth
    ? `Era verdad: ${def?.label ?? (danger ? 'el peligro era real en' : 'era cierto lo anunciado en')} ${name}.`
    : `Era mentira: en ${name} no pasó nada.`
  return { truth: a.truth, visual, summary, place: place.id, at }
}

/** Right when they believed what was true or doubted what was false. */
export function judge(d: Decision, truth: boolean) {
  const right = d.believes === truth
  const note = truth
    ? right
      ? 'Le creyó, y era verdad.'
      : 'No le creyó, y era verdad.'
    : right
      ? 'No le creyó, y era mentira.'
      : 'Le creyó, y era mentira.'
  return { right, note }
}
