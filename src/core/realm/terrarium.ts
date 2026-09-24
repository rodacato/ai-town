import { dayOf } from '../economy/economy'
import { SEASONS, type Season } from '../sim/season'
import type { ChronicleEntry, ChronicleKind } from './chronicle'

/** Days per season in the terrarium; four make the year a reign has to last. */
export const SEASON_DAYS = 10

export const seasonOfDay = (day: number, length = SEASON_DAYS): Season => SEASONS[Math.floor(day / length) % 4]

/** One day of the chronicle, with the line that best sums it up. */
export interface Chapter {
  day: number
  headline: ChronicleEntry | null
  entries: ChronicleEntry[]
}

const WEIGHT: Record<ChronicleKind, number> = { end: 9, death: 8, leave: 7, plot: 6, event: 5, reveal: 4, ruler: 3, decree: 2, petition: 1, dawn: 0 }

/** The chronicle split into days, newest first, each headed by its most striking line. */
export function chapters(entries: ChronicleEntry[]): Chapter[] {
  const byDay = new Map<number, ChronicleEntry[]>()
  for (const e of entries) {
    const d = dayOf(e.minutes)
    byDay.set(d, [...(byDay.get(d) ?? []), e])
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => b - a)
    .map(([day, list]) => {
      const headline = list.filter((e) => e.kind !== 'dawn').reduce<ChronicleEntry | null>((best, e) => (!best || WEIGHT[e.kind] > WEIGHT[best.kind] ? e : best), null)
      return { day, headline, entries: list }
    })
}
