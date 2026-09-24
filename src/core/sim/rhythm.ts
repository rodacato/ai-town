import { hourOf } from './clock'
import type { ResidentProfile } from '../world/content'
import type { Season } from './season'
import { isFoul, type Weather } from './weather'

/** Places with a roof, where people go when the weather turns. */
const INDOORS = new Set(['home', 'tavern', 'temple', 'forge', 'potions', 'tower', 'mill', 'keep', 'visit'])

export const isNight = (minutes: number) => {
  const h = hourOf(minutes)
  return h >= 22 || h < 6
}

/** Where someone feels like going right now: their routine, bent by the hour, the weather and the season. */
export function routineNow(p: ResidentProfile, minutes: number, weather: Weather, season: Season, curfew = false): Record<string, number> {
  const h = hourOf(minutes)
  if (curfew && (h >= 20 || h < 6)) return { home: 1 }
  if (isNight(minutes)) return p.nightRoutine ?? { home: 1 }
  const weights: Record<string, number> = { ...p.routine }
  const scale = (pred: (k: string) => boolean, k: number) => {
    for (const key of Object.keys(weights)) if (pred(key)) weights[key] *= k
  }
  const indoors = (k: string) => INDOORS.has(k)
  if (h >= 19) {
    weights.home = (weights.home ?? 1) * 2.5
    if ('tavern' in weights) weights.tavern *= 2
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
