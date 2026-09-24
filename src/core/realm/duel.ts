import type { TokenUsage } from '../decisions/types'
import type { WorldContent } from '../world/content'
import type { ChronicleEntry } from './chronicle'
import type { Difficulty } from './difficulty'
import { fateCalendar, runReign, type DayRecord, type FateEvent, type ReignResult } from './reign'
import type { RoyalReport } from './report'
import { rulesRuler, type RulerTurn } from './ruler'

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

/** One of the rulers in a duel: it reads the report and decides; usage is counted when it comes from a model. */
export interface Duelist {
  id: string
  label: string
  decide: (report: RoyalReport, signal: AbortSignal) => Promise<RulerTurn & { usage?: TokenUsage }>
}

export interface DuelResult {
  seed: number
  days: number
  difficulty: Difficulty
  fate: FateEvent[]
  rulers: { id: string; label: string; summary: ReignSummary; days: DayRecord[]; chronicle: ChronicleEntry[] }[]
}

export const absentDuelist: Duelist = { id: 'absent', label: 'Trono vacío', decide: async () => ({ thought: '', actions: [], problems: [] }) }
export const rulesDuelist: Duelist = { id: 'rules', label: 'Reglas', decide: async (r) => rulesRuler(r) }

/** Every ruler governs the same year: same seed, same difficulty, same blows of fate. A ruler that fails a day does nothing that day. */
export async function runDuel(o: {
  content: WorldContent
  seed: number
  days: number
  difficulty: Difficulty
  seasonLength: number
  rulers: Duelist[]
  signal?: AbortSignal
  onDay?: (id: string, day: number) => void
}): Promise<DuelResult> {
  const fate = fateCalendar(o.seed, o.days, o.difficulty)
  const signal = o.signal ?? new AbortController().signal
  const rulers = await Promise.all(
    o.rulers.map(async (d) => {
      const usage = { costUsd: 0, errors: 0 }
      const result = await runReign({
        content: o.content,
        days: o.days,
        seed: o.seed,
        seasonLength: o.seasonLength,
        fate,
        difficulty: o.difficulty,
        goals: { yearDays: o.days - 1 },
        rule: async (report) => {
          signal.throwIfAborted()
          o.onDay?.(d.id, report.day)
          try {
            const turn = await d.decide(report, signal)
            usage.costUsd += turn.usage?.costUsd ?? 0
            return turn
          } catch (err) {
            if (signal.aborted) throw err
            usage.errors++
            return { thought: '', actions: [], problems: [`No respondió: ${err instanceof Error ? err.message : String(err)}`] }
          }
        },
      })
      return { id: d.id, label: d.label, summary: summarize(d.label, result, usage), days: result.days, chronicle: result.chronicle.entries }
    }),
  )
  return { seed: o.seed, days: o.days, difficulty: o.difficulty, fate, rulers }
}
