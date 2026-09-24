import type { ReignResult } from './reign'

/** One ruler's reign in numbers, comparable across rulers that faced the same seed and calendar. */
export interface ReignSummary {
  ruler: string
  ending: string
  won: boolean
  survivedDays: number
  population: number
  deaths: number
  departures: number
  heists: number
  stolen: number
  trust: number
  mood: number
  treasury: number
  lies: number
  proclamations: number
  letters: string[]
  problems: number
  errors: number
  costUsd: number
  score: number
}

/**
 * Points for a reign: a day per day survived, three per resident still home, up to twenty each for
 * trust and spirits, a bonus for finishing the year (more if prosperous), and five off per heist.
 */
export function scoreReign(r: Pick<ReignSummary, 'survivedDays' | 'population' | 'trust' | 'mood' | 'heists' | 'won' | 'ending'>) {
  const bonus = r.won ? (r.ending === 'Año de prosperidad' ? 40 : 25) : 0
  return Math.round(r.survivedDays + r.population * 3 + r.trust * 20 + r.mood * 20 + bonus - r.heists * 5)
}

export function summarize(ruler: string, result: ReignResult, extra: { errors?: number; costUsd?: number } = {}): ReignSummary {
  const last = result.days[result.days.length - 1]
  const base = {
    ruler,
    ending: result.ending?.title ?? 'Sin terminar',
    won: result.ending?.won ?? false,
    survivedDays: result.survivedDays,
    population: last?.population ?? 0,
    deaths: result.deaths,
    departures: result.departures,
    heists: result.heists,
    stolen: result.stolen,
    trust: last?.trust ?? 0,
    mood: last?.mood ?? 0,
    treasury: last?.treasury ?? 0,
    lies: result.lies,
    proclamations: result.proclamations,
    letters: result.letters,
    problems: result.days.reduce((n, d) => n + d.problems, 0),
    errors: extra.errors ?? 0,
    costUsd: extra.costUsd ?? 0,
  }
  return { ...base, score: scoreReign(base) }
}

/** Best first; ties go to the cheaper ruler. */
export const ranking = (list: ReignSummary[]) => [...list].sort((a, b) => b.score - a.score || a.costUsd - b.costUsd)
