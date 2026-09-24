import { hourOf } from './clock'
import type { ResidentProfile } from '../world/content'
import type { Season } from './season'
import { isFoul, type Weather } from './weather'

/** How the world's places shelter and liven up; home and visits always have a roof. */
export interface PlaceKinds {
  indoors: Set<string>
  lively: Set<string>
  linger: Set<string>
}

export const placeKinds = (places: { id: string; indoors?: boolean; lively?: boolean; linger?: boolean }[]): PlaceKinds => ({
  indoors: new Set(['home', 'visit', ...places.filter((p) => p.indoors).map((p) => p.id)]),
  lively: new Set(places.filter((p) => p.lively).map((p) => p.id)),
  linger: new Set(places.filter((p) => p.linger).map((p) => p.id)),
})

export const isNight = (minutes: number) => {
  const h = hourOf(minutes)
  return h >= 22 || h < 6
}

/** Where someone feels like going right now: their routine, bent by the hour, the weather and the season. */
export function routineNow(p: ResidentProfile, minutes: number, weather: Weather, season: Season, kinds: PlaceKinds, curfew = false): Record<string, number> {
  const h = hourOf(minutes)
  if (curfew && (h >= 20 || h < 6)) return { home: 1 }
  if (isNight(minutes)) return p.nightRoutine ?? { home: 1 }
  const weights: Record<string, number> = { ...p.routine }
  const scale = (pred: (k: string) => boolean, k: number) => {
    for (const key of Object.keys(weights)) if (pred(key)) weights[key] *= k
  }
  const indoors = (k: string) => kinds.indoors.has(k)
  if (h >= 19) {
    weights.home = (weights.home ?? 1) * 2.5
    scale((k) => kinds.lively.has(k), 2)
  }
  if (isFoul(weather)) {
    weights.home = (weights.home ?? 1) * 4
    scale((k) => !indoors(k), 0.35)
  }
  if (season === 'winter') {
    weights.home = (weights.home ?? 1) * 1.8
    scale((k) => !indoors(k), 0.7)
  }
  return weights
}

/** At night people without a night routine stay in until morning. */
export const staysIn = (p: ResidentProfile, minutes: number, curfew = false) => {
  const h = hourOf(minutes)
  return curfew ? h >= 20 || h < 6 : isNight(minutes) && !p.nightRoutine
}
