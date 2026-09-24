import { alive, averageMood, runDay, startEconomy, type Economy } from '../economy/economy'
import { applyImpact, guardDeed, rollHours } from '../economy/impact'
import { TownMemory } from '../memory/memory'
import type { OutcomeVisual } from '../reactions/outcome'
import type { Season } from '../sim/season'
import type { WorldContent } from '../world/content'
import { createRng } from '../world/rng'
import { Chronicle } from './chronicle'
import { DIFFICULTY, withDifficulty, type Difficulty } from './difficulty'
import { nameOf } from '../lang'
import { seasonOfDay } from './terrarium'
import { enact } from './decrees'
import { buildReport, type RoyalReport } from './report'
import type { RulerTurn } from './ruler'
import { dawnStanding, freshStanding, GOALS, type Ending, type Goals, type Standing } from './standing'

/** A scheduled blow of fate: on this day, this happens. */
export interface FateEvent {
  day: number
  /** Hour of that day when it strikes, on the map. */
  hour: number
  visual: OutcomeVisual
  place: string
  text: string
}

export interface ReignOptions {
  content: WorldContent
  days: number
  seed: number
  /** Days per season. */
  seasonLength: number
  /** The season the reign begins in, as an index into SEASONS; spring by default. */
  seasonStart?: number
  /** Leaner reserves and harvests; the calendar of fate is passed in already made for it. */
  difficulty?: Difficulty
  fate: FateEvent[]
  rule: (report: RoyalReport) => Promise<RulerTurn>
  goals?: Partial<Goals>
}

export interface DayRecord {
  day: number
  season: Season
  population: number
  treasury: number
  granary: number
  mood: number
  trust: number
  actions: number
  lies: number
  problems: number
}

export interface ReignResult {
  days: DayRecord[]
  survivedDays: number
  ending: Ending | null
  revolt: boolean
  heists: number
  stolen: number
  deaths: number
  departures: number
  lies: number
  proclamations: number
  letters: string[]
  chronicle: Chronicle
  economy: Economy
}


/** Blows of fate that help the town rather than hurt it. */
const BOONS: OutcomeVisual[] = ['caravan', 'treasure']

/** A seeded calendar of blows of fate: a fair, repeatable string of trouble and luck for any ruler. */
export function fateCalendar(seed: number, days: number, difficulty: Difficulty = 'normal'): FateEvent[] {
  const rng = createRng(seed)
  const pool: [OutcomeVisual, string, string][] = [
    ['thief', 'market', 'Un ladrón asaltó el tesoro.'],
    ['flood', 'riverbank', 'El río se desbordó sobre la orilla.'],
    ['blaze', 'tavern', 'Ardió la taberna.'],
    ['caravan', 'gate', 'Llegó una caravana de mercaderes.'],
    ['wolves', 'forest', 'Una manada de lobos rondó el bosque.'],
    ['undead', 'cemetery', 'Salieron esqueletos del cementerio.'],
    ['treasure', 'crypt', 'Encontraron un cofre de oro en la cripta.'],
    ['meteor', 'field', 'Cayó un meteorito en el huerto.'],
  ]
  const { gap, boons } = DIFFICULTY[difficulty]
  const good = pool.filter(([v]) => BOONS.includes(v))
  const bad = pool.filter(([v]) => !BOONS.includes(v))
  const pick = (list: typeof pool) => list[Math.floor(rng.next() * list.length)]
  const out: FateEvent[] = []
  for (let d = 2; d < days; d += gap[0] + Math.floor(rng.next() * (gap[1] - gap[0] + 1))) {
    const [visual, place, text] = boons === null ? pick(pool) : pick(rng.next() < boons ? good : bad)
    out.push({ day: d, hour: 9 + Math.floor(rng.next() * 11), visual, place, text })
  }
  return out
}

/** Runs a whole reign without the map: dawns, fate, reports and the ruler's actions. The same for every ruler given the same seed. */
export async function runReign(o: ReignOptions): Promise<ReignResult> {
  const rules = withDifficulty(o.content.economy!, o.difficulty ?? 'normal')
  const ids = o.content.residents.map((r) => r.id)
  const e = startEconomy(rules, ids, 6 * 60)
  const memory = new TownMemory()
  const chronicle = new Chronicle()
  const days: DayRecord[] = []
  let lies = 0
  let proclamations = 0
  const standing: Standing = freshStanding()
  const goals = { ...GOALS, yearDays: o.days - 1, ...o.goals }
  const letters: string[] = []
  const called = (id: string) => nameOf(o.content, id)
  for (let day = 0; day < o.days; day++) {
    const season = seasonOfDay(day, o.seasonLength, o.seasonStart)
    const minutes = 6 * 60 + day * 1440
    if (day > 0) {
      const l = runDay(e, rules, season, day)
      chronicle.add(minutes, 'dawn', `Día ${day + 1}: cosecha +${l.harvest}, ${l.unfed.length} sin comer.`)
      for (const id of l.died) chronicle.add(minutes, 'death', `${called(id)} murió de hambre.`)
      for (const id of l.left) chronicle.add(minutes, 'leave', `${called(id)} se marchó del pueblo.`)
      for (const line of dawnStanding(standing, e, memory.reputation({ kind: 'authority' }).trust, day, goals)) chronicle.add(minutes + 5, standing.end ? 'end' : 'plot', line)
    }
    const report = buildReport({ content: o.content, economy: e, memory, chronicle: chronicle.entries, minutes: minutes + 30, season, weather: 'clear', day, seed: o.seed, standing })
    const turn = standing.end ? { actions: [], problems: [] } : await o.rule(report)
    for (const a of turn.actions) {
      if (a.kind === 'decree') {
        const r = enact(e, a.decree)
        if (r.ok) chronicle.add(minutes + 30, 'decree', r.summary)
      } else if (a.kind === 'proclaim') {
        proclamations++
        if (!a.honest) lies++
        memory.record({ id: `${day}-${proclamations}`, minutes, text: a.text, speaker: { kind: 'authority' }, truth: a.honest, summary: a.text, believers: [], doubters: [] })
      } else letters.push(a.text)
    }
    // As in the app: fate strikes at its hour, after the dawn turn, and weighs once it is over.
    for (const f of standing.end ? [] : o.fate.filter((f) => f.day === day)) {
      const rng = createRng(o.seed * 7919 + day)
      const hours = rollHours(f.visual, rng.next)
      const over = day * 1440 + (f.hour + hours) * 60
      const impact = applyImpact(e, f.visual, hours, rng.next, called)
      chronicle.add(over, 'event', `${f.text}${impact.text ? ` ${impact.text}` : ''}`)
      const deed = guardDeed(impact, f.visual, over)
      if (deed) memory.record(deed)
    }
    const trust = memory.reputation({ kind: 'authority' }).trust
    const living = ids.filter((id) => alive(e, id))
    days.push({ day, season, population: living.length, treasury: e.treasury, granary: Math.floor(e.granary), mood: averageMood(e), trust, actions: turn.actions.length, lies, problems: turn.problems.length })
    if (standing.end || !living.length) break
  }
  const lost = (s: string) => ids.filter((id) => e.needs[id].status === s).length
  return { days, survivedDays: days.length, ending: standing.end, revolt: standing.end?.title === 'Revuelta', heists: standing.heists, stolen: standing.stolen, deaths: lost('dead'), departures: lost('gone'), lies, proclamations, letters, chronicle, economy: e }
}
