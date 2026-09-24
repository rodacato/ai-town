import type { MemoryEntry } from '../memory/memory'
import type { OutcomeVisual } from '../reactions/outcome'
import { alive, type Economy } from './economy'

/** What a real event did: to the purse and the pantry, to spirits and bodies, and whether the guard protected the town. */
export interface Impact {
  /** For the chronicle and the toast; null when nothing changed. */
  text: string | null
  gold: number
  food: number
  mood: number
  hurt: string[]
  hours: number
  /** true: the guard stood up to it; false: it caught the town unguarded; null: not something a guard can stop. */
  guarded: boolean | null
}

interface Effect {
  said: string
  /** Share of the treasury and granary lost (negative) or a flat amount gained or lost. */
  goldShare?: number
  gold?: number
  foodShare?: number
  food?: number
  mood: number
  /** Residents injured; a levied guard spares them. */
  hurt?: number
  /** The guard can stand up to it: the levy halves the harm, and trust follows how it went. */
  guardable?: boolean
  feedsAll?: boolean
  /** How long it can last, in game hours; everything above is for an average run and scales with how long it really lasted. */
  hours: [number, number]
}

/** Every event costs or pays something; the numbers are what makes a blow of fate matter to the ruler. */
export const EFFECTS: Partial<Record<OutcomeVisual, Effect>> = {
  feast: { said: 'El festín, que llenó todas las barrigas', food: -15, mood: 0.12, feedsAll: true, hours: [2, 5] },
  caravan: { said: 'La caravana, que dejó grano y pagó sus tasas', food: 25, gold: 10, mood: 0.05, hours: [3, 8] },
  treasure: { said: 'El cofre de la cripta, que fue a parar a las arcas', gold: 60, mood: 0.03, hours: [1, 1] },
  meteor: { said: 'El meteorito, que arrasó parte del huerto pero dejó hierro para vender', foodShare: -0.1, gold: 30, mood: -0.03, hours: [1, 1] },
  flood: { said: 'La crecida del río, con grano perdido y la orilla por reparar', foodShare: -0.3, gold: -15, mood: -0.06, hours: [2, 8] },
  blaze: { said: 'El incendio de la taberna', foodShare: -0.15, goldShare: -0.1, gold: -20, mood: -0.06, hurt: 1, hours: [1, 5] },
  fire: { said: 'El dragón en el coto de caza, y los cazadores que hubo que pagar', foodShare: -0.15, goldShare: -0.1, gold: -40, mood: -0.12, hurt: 1, guardable: true, hours: [1, 4] },
  thief: { said: 'El ladrón en el tesoro', goldShare: -0.25, mood: -0.03, guardable: true, hours: [1, 1] },
  monster: { said: 'La bestia, que destrozó el puente', gold: -20, mood: -0.06, hurt: 1, guardable: true, hours: [1, 4] },
  wolves: { said: 'Los lobos, que se comieron parte del ganado', food: -12, mood: -0.05, hurt: 1, guardable: true, hours: [2, 6] },
  undead: { said: 'Los esqueletos, y la bendición del cementerio que hubo que pagar a la Hermana Clemencia', gold: -15, mood: -0.08, guardable: true, hours: [1, 4] },
  ghost: { said: 'El fantasma, y la ofrenda que se dejó en la cripta', gold: -5, mood: -0.05, hours: [1, 3] },
}

/** How long this one lasts, in whole game hours. */
export function rollHours(visual: OutcomeVisual, rand: () => number = Math.random) {
  const [lo, hi] = EFFECTS[visual]?.hours ?? [1, 1]
  return lo + Math.floor(rand() * (hi - lo + 1))
}

/** Applies a real event once it is over; the longer it lasted, the more it cost or paid. `rand` picks who gets hurt; `nameOf` names them. */
export function applyImpact(e: Economy, visual: OutcomeVisual, hours?: number, rand: () => number = Math.random, nameOf: (id: string) => string = (id) => id): Impact {
  const fx = EFFECTS[visual]
  if (!fx) return { text: null, gold: 0, food: 0, mood: 0, hurt: [], hours: 0, guarded: null }
  const lasted = hours ?? Math.round((fx.hours[0] + fx.hours[1]) / 2)
  const span = Math.min(1.8, Math.max(0.5, lasted / ((fx.hours[0] + fx.hours[1]) / 2)))
  const guarded = fx.guardable ? e.laws.levy : null
  const harm = guarded ? 0.5 : 1
  const scale = (v: number) => (v < 0 ? v * harm : v) * span

  const gold = Math.round(scale((fx.goldShare ?? 0) * Math.max(0, e.treasury) + (fx.gold ?? 0)))
  const food = Math.round(scale((fx.foodShare ?? 0) * e.granary + (fx.food ?? 0)))
  const paid = Math.max(gold, -Math.max(0, e.treasury))
  const eaten = Math.max(food, -Math.floor(e.granary))
  e.treasury += paid
  e.granary += eaten

  const everyone = Object.keys(e.needs).filter((id) => alive(e, id))
  const mood = scale(fx.mood)
  for (const id of everyone) e.needs[id].mood = Math.min(1, Math.max(0, e.needs[id].mood + mood))
  if (fx.feedsAll) for (const id of everyone) e.needs[id].daysHungry = 0

  const hurt: string[] = []
  const pool = [...everyone]
  const injuries = guarded ? 0 : Math.round((fx.hurt ?? 0) * span)
  for (let i = 0; i < injuries && pool.length; i++) {
    const [id] = pool.splice(Math.floor(rand() * pool.length), 1)
    e.needs[id].health = Math.max(0.1, e.needs[id].health - 0.3)
    hurt.push(id)
  }

  const long = fx.hours[1] > 1 ? ` (${lasted} h)` : ''
  const names = hurt.map(nameOf)
  const parts = [paid ? `${paid > 0 ? '+' : '−'}${Math.abs(paid)} 💰` : '', eaten ? `${eaten > 0 ? '+' : '−'}${Math.abs(eaten)} 🍞` : '', names.length ? `${names.length > 1 ? 'heridos' : 'herido'}: ${names.join(' y ')}` : ''].filter(Boolean)
  const guard = guarded === true ? ' La guardia plantó cara y el daño fue la mitad.' : guarded === false ? ' No había leva de guardias: nadie lo frenó.' : ''
  return { text: `${fx.said}${long}: ${parts.length ? parts.join(', ') : 'sin daños'}.${guard}`, gold: paid, food: eaten, mood, hurt, hours: lasted, guarded }
}

/** The guard's part in an event, as a deed the town remembers of its ruler: it moves trust without counting as a lie. */
export function guardDeed(i: Impact, visual: OutcomeVisual, minutes: number): MemoryEntry | null {
  if (i.guarded === null || !i.text) return null
  const what = EFFECTS[visual]!.said
  return {
    id: `deed-${visual}-${Math.floor(minutes)}`,
    minutes,
    text: i.text,
    speaker: { kind: 'authority' },
    truth: i.guarded,
    deed: true,
    summary: `${what}: ${i.guarded ? 'la guardia plantó cara' : 'nadie lo frenó'}`,
    believers: [],
    doubters: [],
  }
}

/** What an event costs or pays on an average run, in a few words for a tooltip. */
export function describeEffect(visual: OutcomeVisual) {
  const fx = EFFECTS[visual]
  if (!fx) return ''
  const sign = (v: number) => (v > 0 ? '+' : '−')
  const gold = [fx.goldShare ? `${sign(fx.goldShare)}${Math.abs(fx.goldShare * 100)}%` : '', fx.gold ? `${sign(fx.gold)}${Math.abs(fx.gold)}` : ''].filter(Boolean).join(' y ')
  const food = [fx.foodShare ? `${sign(fx.foodShare)}${Math.abs(fx.foodShare * 100)}%` : '', fx.food ? `${sign(fx.food)}${Math.abs(fx.food)}` : ''].filter(Boolean).join(' y ')
  const [lo, hi] = fx.hours
  return [
    gold ? `${gold} 💰` : '',
    food ? `${food} 🍞` : '',
    `ánimo ${fx.mood > 0 ? '+' : '−'}`,
    fx.hurt ? `${fx.hurt} herido` : '',
    fx.feedsAll ? 'todos comen' : '',
    lo === hi ? 'instantáneo' : `dura ${lo}–${hi} h (más largo, más caro)`,
    fx.guardable ? 'la leva de guardias lo frena' : '',
  ]
    .filter(Boolean)
    .join(' · ')
}
