import { alive, averageMood, type Economy } from '../economy/economy'
import { nameOf } from '../lang'
import type { WorldContent } from '../world/content'
import { capital } from './realmDef'

export type EndingKind = 'revolt' | 'deserted' | 'thrived' | 'survived'

/** How a reign ended, if it has; `title` is for people, `kind` for code. */
export interface Ending {
  kind: EndingKind
  won: boolean
  title: string
  text: string
  day: number
}

/** The threats hanging over the reign: the thieves' guild, the mob, and the clock toward a full year. */
export interface Standing {
  /** 0–1: how close the guild is to striking; it strikes at 1. */
  plot: number
  /** What the realm's debtor still owes the guild; while they owe, the guild has a reason to come. */
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
}

export const GOALS: Goals = { yearDays: 40, revoltAt: 0.3, unrestDays: 3 }

export const freshStanding = (): Standing => ({ plot: 0.1, debt: 90, unrest: 0, heists: 0, stolen: 0, end: null })

export type GuildWord = 'none' | 'rumors' | 'imminent'
export const guildWord = (s: Standing): GuildWord => (s.plot >= 0.75 ? 'imminent' : s.plot >= 0.45 ? 'rumors' : 'none')

const clamp = (v: number) => Math.min(1, Math.max(0, v))

/** One dawn after the ledger: the debtor pays, the guild plots (faster in misery) and strikes, the mob counts grievances, and the reign may end. */
export function dawnStanding(s: Standing, e: Economy, trust: number, day: number, world: WorldContent, goals: Goals = GOALS): string[] {
  if (s.end || !world.realm) return []
  const { ruler, guild } = world.realm
  const debtorName = nameOf(world, guild.debtor)
  const lines: string[] = []
  const ids = Object.keys(e.needs)
  const living = ids.filter((id) => alive(e, id))
  const mood = averageMood(e)

  const debtor = alive(e, guild.debtor) ? guild.debtor : null
  if (debtor && s.debt > 0) {
    const pay = Math.min(s.debt, Math.max(0, (e.purses[debtor] ?? 0) - 8), 3)
    e.purses[debtor] -= pay
    s.debt -= pay
    if (s.debt <= 0) lines.push(`${debtorName} saldó por fin su deuda con ${guild.name}.`)
  }

  const before = s.plot
  const guard = (e.laws.levy ? 0.1 : 0) + (e.laws.curfew ? 0.04 : 0)
  // A fat treasury tempts thieves as much as a miserable town hides them.
  const lure = Math.min(0.08, Math.max(0, e.treasury) / 3000)
  s.plot = clamp(s.plot + 0.03 + (0.45 - mood) * 0.4 + lure + (s.debt > 0 ? 0.04 : -0.02) - guard)
  if (before < 0.75 && s.plot >= 0.75 && s.plot < 1) lines.push(`Unos forasteros encapuchados preguntan en la taberna por ${debtorName} y por el tesoro.`)
  if (s.plot >= 1) {
    const share = e.laws.levy ? 0.2 : 0.4
    const gold = Math.round(Math.max(0, e.treasury) * share)
    const grain = Math.floor(e.granary * share * 0.5)
    e.treasury -= gold
    e.granary -= grain
    s.heists++
    s.stolen += gold
    s.plot = 0.25
    lines.push(`${capital(guild.name)} asaltó ${ruler.seat} de noche: se llevó ${gold} monedas y ${grain} raciones${e.laws.levy ? ' (la leva de guardias los frenó a medias)' : ''}.`)
  }

  const angry = day >= 7 && (trust < goals.revoltAt || mood < 0.25)
  s.unrest = angry ? s.unrest + 1 : Math.max(0, s.unrest - 1)
  if (angry && s.unrest === 1) lines.push(`Se oyen murmullos de revuelta en la plaza contra ${ruler.title}.`)

  const end = (kind: EndingKind, won: boolean, title: string, text: string) => {
    s.end = { kind, won, title, text, day }
    lines.push(text)
  }
  if (s.unrest >= goals.unrestDays) end('revolt', false, 'Revuelta', `El pueblo se alzó contra ${ruler.title} y tomó ${ruler.seat}.`)
  else if (living.length * 2 < ids.length) end('deserted', false, 'Pueblo desierto', `Más de la mitad de los vecinos murieron o se marcharon: ${world.name} quedó desierto.`)
  else if (day >= goals.yearDays) {
    const thriving = living.length >= ids.length * 0.9 && trust >= 0.5 && mood >= 0.5
    if (thriving) end('thrived', true, 'Año de prosperidad', `Pasó un año entero y el pueblo prospera: ${living.length} vecinos y confianza en ${ruler.title}.`)
    else end('survived', true, 'Sobrevivió un año', `Pasó un año entero. ${world.name} sigue en pie con ${living.length} vecinos, aunque no sin heridas.`)
  }
  return lines
}

const OLD_ENDINGS: Record<string, EndingKind> = { Revuelta: 'revolt', 'Pueblo desierto': 'deserted', 'Año de prosperidad': 'thrived', 'Sobrevivió un año': 'survived' }

/** A standing saved before endings had a kind gets it back from its title. */
export function upgradeStanding(s: Standing): Standing {
  if (!s.end || s.end.kind) return s
  return { ...s, end: { ...s.end, kind: OLD_ENDINGS[s.end.title] ?? (s.end.won ? 'survived' : 'deserted') } }
}
