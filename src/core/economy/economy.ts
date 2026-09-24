import type { Season } from '../sim/season'

/** A resident's body and spirits: all 0–1 except the day counter. */
export interface Needs {
  /** Days in a row without a meal. */
  daysHungry: number
  health: number
  mood: number
  status: 'ok' | 'hungry' | 'sick' | 'gone' | 'dead'
}

/** What a trade brings in each day: coins, and food for the granary. */
export interface Job {
  income: number
  food?: number
}

export interface EconomyRules {
  jobs: Record<string, Job>
  startTreasury: number
  startGranary: number
  startPurse: number
  /** Coins per ration at the royal granary. */
  foodPrice: number
  /** Share of every income that goes to the treasury. */
  taxRate: number
  /** Paid daily from the treasury, per guard. */
  guardWage: number
  guards: number
}

export interface Economy {
  /** Last day the ledger ran, so it runs once per dawn. */
  day: number
  treasury: number
  granary: number
  taxRate: number
  foodPrice: number
  purses: Record<string, number>
  needs: Record<string, Needs>
  /** Tax rate and food price the town is used to, so a hike can sour the mood. */
  wontedTax: number
  laws: Laws
}

/** Standing decrees: each has a daily cost in spirits and a benefit elsewhere. */
export interface Laws {
  /** Everyone indoors from dusk, night owls included; safer, but chafing. */
  curfew: boolean
  /** Half rations: the granary lasts twice as long, at a cost to health and mood. */
  rationing: boolean
  /** Two more guards on the payroll; thieves and beasts do less harm. */
  levy: boolean
}

export interface Ledger {
  day: number
  harvest: number
  taxes: number
  sold: number
  unfed: string[]
  wages: number
  unpaid: number
  died: string[]
  left: string[]
}

const HARVEST: Record<Season, number> = { spring: 0.8, summer: 1, autumn: 1.2, winter: 0.2 }
const DAWN = 6 * 60
export const dayOf = (minutes: number) => Math.floor((minutes - DAWN) / 1440)

const clamp = (v: number) => Math.min(1, Math.max(0, v))

/** How low someone's spirits must sink before they pack up; varies by person so a famine does not empty the town at once. */
const leaveThreshold = (id: string) => 0.4 + ([...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 997, 7) % 100) / 500

export function startEconomy(rules: EconomyRules, residents: string[], minutes: number): Economy {
  return {
    day: dayOf(minutes),
    treasury: rules.startTreasury,
    granary: rules.startGranary,
    taxRate: rules.taxRate,
    foodPrice: rules.foodPrice,
    purses: Object.fromEntries(residents.map((id) => [id, rules.startPurse])),
    needs: Object.fromEntries(residents.map((id) => [id, { daysHungry: 0, health: 1, mood: 0.65, status: 'ok' } satisfies Needs])),
    wontedTax: rules.taxRate,
    laws: { curfew: false, rationing: false, levy: false },
  }
}

export const alive = (e: Economy, id: string) => {
  const s = e.needs[id]?.status
  return s !== 'dead' && s !== 'gone'
}

/**
 * One dawn: the harvest comes in, trades are paid and taxed, everyone who can buys a ration
 * (richest first, so the poor go hungry first), guards are paid, and hunger, health and mood move.
 */
export function runDay(e: Economy, rules: EconomyRules, season: Season, day: number): Ledger {
  const ledger: Ledger = { day, harvest: 0, taxes: 0, sold: 0, unfed: [], wages: 0, unpaid: 0, died: [], left: [] }
  const living = Object.keys(e.needs).filter((id) => alive(e, id))

  for (const id of living) {
    const job = rules.jobs[id]
    if (!job) continue
    const harvest = Math.round((job.food ?? 0) * HARVEST[season])
    e.granary += harvest
    ledger.harvest += harvest
    const tax = Math.round(job.income * e.taxRate)
    e.purses[id] = (e.purses[id] ?? 0) + job.income - tax
    e.treasury += tax
    ledger.taxes += tax
  }

  const ration = e.laws.rationing ? 0.5 : 1
  const price = Math.ceil(e.foodPrice * ration)
  for (const id of [...living].sort((a, b) => (e.purses[b] ?? 0) - (e.purses[a] ?? 0))) {
    const n = e.needs[id]
    if (e.granary >= ration && (e.purses[id] ?? 0) >= price) {
      e.granary = Math.round((e.granary - ration) * 10) / 10
      e.purses[id] -= price
      e.treasury += price
      ledger.sold++
      n.daysHungry = 0
      n.health = clamp(n.health + 0.15)
    } else {
      n.daysHungry++
      ledger.unfed.push(id)
    }
  }

  const due = rules.guardWage * (rules.guards + (e.laws.levy ? 2 : 0))
  const paid = Math.min(due, Math.max(0, e.treasury))
  e.treasury -= paid
  ledger.wages = paid
  ledger.unpaid = due - paid

  // A tax hike stings for a while; the town slowly gets used to the new rate.
  const hike = Math.max(0, e.taxRate - e.wontedTax)
  e.wontedTax += (e.taxRate - e.wontedTax) * 0.25
  for (const id of living) {
    const n = e.needs[id]
    if (n.daysHungry >= 3) n.health = clamp(n.health - 0.35)
    if (e.laws.rationing) n.health = clamp(n.health - 0.03)
    const lawToll = (e.laws.curfew ? 0.04 : 0) + (e.laws.rationing ? 0.08 : 0) + (e.laws.levy ? 0.03 : 0)
    const target = 0.65 - n.daysHungry * 0.15 - hike * 1.2 - (ledger.unpaid > 0 ? 0.05 : 0) - (1 - n.health) * 0.3 - lawToll
    n.mood = clamp(n.mood + (target - n.mood) * 0.5)
    n.status = n.daysHungry >= 3 ? 'sick' : n.daysHungry >= 1 ? 'hungry' : 'ok'
    if (n.health <= 0) {
      n.status = 'dead'
      ledger.died.push(id)
    } else if (n.daysHungry === 2 && n.mood < leaveThreshold(id)) {
      // The second hungry day is the last chance to leave; once sick, they are too weak to travel.
      n.status = 'gone'
      ledger.left.push(id)
    }
  }
  e.day = day
  return ledger
}

/** Runs every dawn that has passed since the last one, in order; `season` may change from one dawn to the next. */
export function catchUp(e: Economy, rules: EconomyRules, season: Season | ((day: number) => Season), minutes: number): Ledger[] {
  const out: Ledger[] = []
  const today = dayOf(minutes)
  for (let d = e.day + 1; d <= today; d++) out.push(runDay(e, rules, typeof season === 'function' ? season(d) : season, d))
  return out
}

/** Days the granary lasts at today's appetite. */
export const foodDays = (e: Economy) => {
  const mouths = Object.keys(e.needs).filter((id) => alive(e, id)).length
  return mouths ? e.granary / (mouths * (e.laws.rationing ? 0.5 : 1)) : Infinity
}

export const averageMood = (e: Economy) => {
  const ids = Object.keys(e.needs).filter((id) => alive(e, id))
  return ids.length ? ids.reduce((n, id) => n + e.needs[id].mood, 0) / ids.length : 0
}
