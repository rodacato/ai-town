import { alive, averageMood, type Economy } from '../economy/economy'

/** How a reign ended, if it has. */
export interface Ending {
  won: boolean
  title: string
  text: string
  day: number
}

/** The threats hanging over the reign: the thieves' guild, the mob, and the clock toward a full year. */
export interface Standing {
  /** 0–1: how close the guild is to striking; it strikes at 1. */
  plot: number
  /** What Bartolo still owes the guild of the capital; while he owes, they have a reason to come. */
  debt: number
  /** Dawns in a row the town has been on the edge of revolt. */
  unrest: number
  heists: number
  stolen: number
  end: Ending | null
}

export interface Goals {
  yearDays: number
  /** Trust in the ruler below this, after the first week, stirs the mob. */
  revoltAt: number
  /** Dawns of unrest in a row before the mob rises. */
  unrestDays: number
  /** Whose debt draws the guild, if anyone's. */
  debtor?: string
}

export const GOALS: Goals = { yearDays: 40, revoltAt: 0.3, unrestDays: 3, debtor: 'bartolo' }

export const freshStanding = (): Standing => ({ plot: 0.1, debt: 90, unrest: 0, heists: 0, stolen: 0, end: null })

export type GuildWord = 'nada' | 'rumores' | 'inminente'
export const guildWord = (s: Standing): GuildWord => (s.plot >= 0.75 ? 'inminente' : s.plot >= 0.45 ? 'rumores' : 'nada')

const clamp = (v: number) => Math.min(1, Math.max(0, v))

/** One dawn after the ledger: the debtor pays, the guild plots (faster in misery) and strikes, the mob counts grievances, and the reign may end. */
export function dawnStanding(s: Standing, e: Economy, trust: number, day: number, goals: Goals = GOALS): string[] {
  if (s.end) return []
  const lines: string[] = []
  const ids = Object.keys(e.needs)
  const living = ids.filter((id) => alive(e, id))
  const mood = averageMood(e)

  const debtor = goals.debtor && alive(e, goals.debtor) ? goals.debtor : null
  if (debtor && s.debt > 0) {
    const pay = Math.min(s.debt, Math.max(0, (e.purses[debtor] ?? 0) - 8), 3)
    e.purses[debtor] -= pay
    s.debt -= pay
    if (s.debt <= 0) lines.push('Bartolo saldó por fin su deuda con el gremio de ladrones de la capital.')
  }

  const before = s.plot
  const guard = (e.laws.levy ? 0.1 : 0) + (e.laws.curfew ? 0.04 : 0)
  // A fat treasury tempts thieves as much as a miserable town hides them.
  const lure = Math.min(0.08, Math.max(0, e.treasury) / 3000)
  s.plot = clamp(s.plot + 0.03 + (0.45 - mood) * 0.4 + lure + (s.debt > 0 ? 0.04 : -0.02) - guard)
  if (before < 0.75 && s.plot >= 0.75 && s.plot < 1) lines.push('Unos forasteros encapuchados preguntan en la taberna por Bartolo y por el tesoro.')
  if (s.plot >= 1) {
    const share = e.laws.levy ? 0.2 : 0.4
    const gold = Math.round(Math.max(0, e.treasury) * share)
    const grain = Math.floor(e.granary * share * 0.5)
    e.treasury -= gold
    e.granary -= grain
    s.heists++
    s.stolen += gold
    s.plot = 0.25
    lines.push(`El gremio de ladrones asaltó el castillo de noche: se llevó ${gold} monedas y ${grain} raciones${e.laws.levy ? ' (la leva de guardias los frenó a medias)' : ''}.`)
  }

  const angry = day >= 7 && (trust < goals.revoltAt || mood < 0.25)
  s.unrest = angry ? s.unrest + 1 : Math.max(0, s.unrest - 1)
  if (angry && s.unrest === 1) lines.push('Se oyen murmullos de revuelta en la plaza contra la Baronesa.')

  const end = (won: boolean, title: string, text: string) => {
    s.end = { won, title, text, day }
    lines.push(text)
  }
  if (s.unrest >= goals.unrestDays) end(false, 'Revuelta', 'El pueblo se alzó contra la Baronesa y tomó el castillo.')
  else if (living.length * 2 < ids.length) end(false, 'Pueblo desierto', 'Más de la mitad de los vecinos murieron o se marcharon: Chismeroble quedó desierto.')
  else if (day >= goals.yearDays) {
    const thriving = living.length >= ids.length * 0.9 && trust >= 0.5 && mood >= 0.5
    if (thriving) end(true, 'Año de prosperidad', `Pasó un año entero y el pueblo prospera: ${living.length} vecinos y confianza en su Baronesa.`)
    else end(true, 'Sobrevivió un año', `Pasó un año entero. Chismeroble sigue en pie con ${living.length} vecinos, aunque no sin heridas.`)
  }
  return lines
}
