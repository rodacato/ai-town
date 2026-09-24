import type { Decision } from '../decisions/types'
import type { WorldContent } from '../world/content'
import type { Resident, Simulation } from '../sim/simulation'
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
  const name = placeLabel(content, place.id) ?? 'el pueblo'
  const summary = a.truth
    ? `Era verdad: ${def?.label ?? (danger ? 'el peligro era real en' : 'era cierto lo anunciado en')} ${name}.`
    : `Era mentira: en ${name} no pasó nada.`
  return { truth: a.truth, visual, summary, place: place.id, at: centerOf(place) }
}

/** An open tile near the middle of a place, in front of it on screen so trees and towers there do not hide the event. */
const centerOf = (place: Place): Point => {
  const n = place.spots.length
  const mid = place.spots.reduce((c, s) => ({ x: c.x + (s.x + 0.5) / n, y: c.y + (s.y + 0.5) / n }), { x: 0, y: 0 })
  const front = place.spots.filter((s) => s.x + s.y >= mid.x + mid.y + 1.5)
  const d = (s: Point) => Math.hypot(s.x + 0.5 - mid.x, s.y + 0.5 - mid.y)
  const best = (front.length ? front : place.spots).reduce((a, s) => (d(s) < d(a) ? s : a))
  return { x: best.x + 0.5, y: best.y + 0.5 }
}

/** Something that simply happens, with no announcement before it: what the god panel unleashes. */
export function eventAt(content: WorldContent, places: Place[], visual: OutcomeVisual, placeId: string): Outcome {
  const place = places.find((p) => p.id === placeId) ?? places.find((p) => p.id === content.gatheringPlace)!
  const name = placeLabel(content, place.id) ?? 'el pueblo'
  const what = content.outcomes?.find((d) => d.visual === visual)?.label ?? (THREATS.includes(visual) ? 'algo terrible pasó en' : 'algo maravilloso pasó en')
  const summary = `${what.charAt(0).toUpperCase()}${what.slice(1)} ${name}.`
  return { truth: true, visual, summary, place: place.id, at: centerOf(place) }
}

/** Tiles around an event within which people notice it. */
export const NOTICE_RADIUS = 7

/** People near a real threat run home; near something good they come over to look for a while. */
export function react(sim: Simulation, o: Outcome, isBusy: (r: Resident) => boolean = () => false) {
  for (const r of sim.residents) {
    if (r.mode === 'inside' || isBusy(r)) continue
    if (Math.hypot(r.x - o.at.x, r.y - o.at.y) > NOTICE_RADIUS * (THREATS.includes(o.visual) ? 1 : 1.5)) continue
    if (THREATS.includes(o.visual)) sim.assign(r, [{ kind: 'enterHome', label: 'Huye despavorido' }])
    else if (o.place) {
      const spot = sim.spotAt(o.place)
      if (spot) sim.assign(r, [{ kind: 'walk', to: spot, label: 'Va a ver qué pasa' }, { kind: 'wait', seconds: 20, label: 'Mirando asombrado' }])
    }
  }
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
