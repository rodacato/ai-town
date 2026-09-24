import { lawsInForce, type Economy, type Needs } from '../economy/economy'
import { hourOf } from '../sim/clock'
import type { ResidentProfile, WorldContent } from '../world/content'
import { capital } from './realmDef'

/** What a resident has on their mind when they stop to think about how the town is doing. */
export interface MusingInput {
  resident: ResidentProfile
  needs: Needs
  coins: number
  foodPrice: number
  taxRate: number
  laws: string[]
  /** How much they trust the Baroness, 0–1. */
  trust: number
  /** The latest talk of the town, newest last. */
  news: string[]
  hour: number
  /** The town's name and how it names its ruler and addresses her. */
  world: { name: string; ruler: string; address: string }
}

export interface Musing {
  thought: string
  /** -1 sours their mood a little, 1 lifts it, 0 leaves it. */
  mood: -1 | 0 | 1
  emoji: string
}

/** What `resident` has on their mind right now, read from the town's state. */
export function musingInputFor(e: Economy, resident: ResidentProfile, o: { trust: number; news: string[]; minutes: number; world: WorldContent }): MusingInput {
  const id = resident.id
  return {
    resident,
    needs: e.needs[id],
    coins: e.purses[id] ?? 0,
    foodPrice: e.foodPrice,
    taxRate: e.taxRate,
    laws: lawsInForce(e.laws),
    trust: o.trust,
    news: o.news,
    hour: Math.floor(hourOf(o.minutes)),
    world: { name: o.world.name, ruler: o.world.realm?.ruler.title ?? 'quien gobierna', address: o.world.realm?.ruler.address ?? 'mi señor' },
  }
}

export const musingSystem = (town: string) => `Eres un vecino de ${town}, una aldea de fantasía. De vez en cuando te paras a pensar en cómo te va y en cómo va el pueblo.
Responde SOLO con un objeto JSON, sin texto antes ni después:
{ "pensamiento": "una o dos frases en primera persona, con tu forma de hablar", "animo": -1, 0 o 1, "emoji": "un emoji" }
"animo" dice si este pensamiento te deja más triste (-1), igual (0) o más contento (1). Escribe en español.`

const pct = (x: number) => `${Math.round(x * 100)}%`

export function musingPrompt(i: MusingInput) {
  const p = i.resident.personality
  const n = i.needs
  return [
    `Eres ${i.resident.name}, ${i.resident.occupation}, ${i.resident.age} años. ${i.resident.bio}`,
    `Hablas así: ${p.voice} Te importa: ${p.values.join(', ')}. Temes: ${p.fears.join(', ')}.`,
    '',
    `Son las ${String(i.hour).padStart(2, '0')}:00.`,
    `Tienes ${i.coins} monedas; la ración cuesta ${i.foodPrice} y el impuesto es del ${pct(i.taxRate)}.`,
    n.daysHungry ? `Llevas ${n.daysHungry} día(s) sin comer.` : 'Hoy has comido.',
    `Salud: ${pct(n.health)}. Ánimo: ${pct(n.mood)}.`,
    `Leyes en vigor: ${i.laws.length ? i.laws.join(', ') : 'ninguna'}.`,
    `Confías en ${i.world.ruler} un ${pct(i.trust)}.`,
    '',
    'Lo que se comenta en el pueblo:',
    ...(i.news.length ? i.news.map((x) => `- ${x}`) : ['- Nada nuevo.']),
  ].join('\n')
}

export function parseMusing(text: string): Musing | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const raw = JSON.parse(text.slice(start, end + 1)) as { pensamiento?: unknown; animo?: unknown; emoji?: unknown }
    if (typeof raw.pensamiento !== 'string' || !raw.pensamiento.trim()) return null
    const mood = Number(raw.animo)
    return {
      thought: raw.pensamiento.trim().slice(0, 240),
      mood: mood > 0 ? 1 : mood < 0 ? -1 : 0,
      emoji: typeof raw.emoji === 'string' && raw.emoji.trim() ? [...raw.emoji.trim()].slice(0, 2).join('') : '💭',
    }
  } catch {
    return null
  }
}

const NEWS: [RegExp, Musing[]][] = [
  [/ladr|gremio|asalt/i, [{ thought: 'Dicen que rondan ladrones. Esta noche cierro bien la puerta.', mood: -1, emoji: '🔒' }, { thought: 'Si roban el tesoro, ¿quién paga a la guardia?', mood: -1, emoji: '🗡️' }]],
  [/lobo|bestia|esqueleto|fantasma|dragón|troll/i, [{ thought: 'Con lo que se ha visto por ahí, mejor no alejarse del pueblo.', mood: -1, emoji: '😨' }, { thought: 'Que la guardia haga su trabajo; yo no salgo de noche.', mood: -1, emoji: '🕯️' }]],
  [/caravana|tesoro|fiesta|banquete/i, [{ thought: '¡Por fin una buena noticia en {town}!', mood: 1, emoji: '😄' }, { thought: 'Con algo de suerte, esto nos alegra la semana.', mood: 1, emoji: '🎉' }]],
  [/murió|se marcha|tumba/i, [{ thought: 'Otro vecino menos… esto no puede seguir así.', mood: -1, emoji: '😔' }]],
]

const pickOne = <T>(list: T[], rand: () => number) => list[Math.floor(rand() * list.length)]

/** Without a model: the most pressing worry, then the talk of the town, then a small contentment. */
export function rulesMusing(i: MusingInput, rand: () => number = Math.random): Musing {
  const n = i.needs
  const pick = (list: Musing[]) => pickOne(list, rand)
  if (n.daysHungry >= 2) return pick([{ thought: `Llevo ${n.daysHungry} días sin probar bocado. Así no se puede vivir.`, mood: -1, emoji: '😣' }, { thought: `Me tiemblan las piernas de hambre. ¿Dónde está ${i.world.ruler}?`, mood: -1, emoji: '🥣' }])
  if (n.daysHungry === 1) return pick([{ thought: 'Hoy no me alcanzó para la ración. A ver mañana.', mood: -1, emoji: '😟' }, { thought: 'Con el estómago vacío todo se ve peor.', mood: -1, emoji: '😞' }])
  if (i.coins < i.foodPrice * 2) return pick([{ thought: 'Me quedan pocas monedas; si sube el pan, estoy perdido.', mood: -1, emoji: '🪙' }, { thought: 'Cuento las monedas y no me salen las cuentas.', mood: -1, emoji: '😬' }])
  if (i.taxRate >= 0.35) return pick([{ thought: 'Con estos impuestos no hay quien levante cabeza.', mood: -1, emoji: '😤' }, { thought: 'Trabajo más para los de arriba que para mi casa.', mood: -1, emoji: '💸' }])
  if (i.laws.length >= 2) return pick([{ thought: 'Tanta ley y tanto bando… uno ya no sabe qué se puede hacer.', mood: -1, emoji: '😒' }])
  if (i.trust < 0.35) return pick([{ thought: `${capital(i.world.ruler)} dice muchas cosas, pero ya no me creo ninguna.`, mood: -1, emoji: '🤨' }])
  const talk = NEWS.find(([re]) => i.news.some((x) => re.test(x)))
  if (talk && rand() < 0.6) {
    const m = pick(talk[1])
    return { ...m, thought: m.thought.replace('{town}', i.world.name) }
  }
  if (n.mood > 0.6)
    return pick([
      { thought: 'No me puedo quejar: hay pan en la mesa y el pueblo está tranquilo.', mood: 1, emoji: '🙂' },
      { thought: `Buen día para ser ${i.resident.occupation.toLowerCase()} en ${i.world.name}.`, mood: 1, emoji: '😊' },
      { thought: 'Si todo sigue así, este año será bueno.', mood: 1, emoji: '🌾' },
    ])
  return pick([
    { thought: `Otro día más en ${i.world.name}. Ni bien ni mal.`, mood: 0, emoji: '😐' },
    { thought: 'Me pregunto qué dirá hoy el pregonero.', mood: 0, emoji: '🤔' },
  ])
}
