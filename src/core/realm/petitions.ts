import { alive, averageMood, foodDays, type Economy } from '../economy/economy'
import type { WorldContent } from '../world/content'
import type { ChronicleEntry } from './chronicle'
import type { MusingInput } from './musing'

/** Someone with a reason to ask the Baroness for something, with the facts behind it and what they say without a model. */
export type PetitionTopic = 'hunger' | 'granary' | 'taxes' | 'mood' | 'rationing' | 'curfew' | 'guard' | 'starving'

export interface Grievance {
  id: string
  topic: PetitionTopic
  /** What they want, for the model to put in their own words. */
  wish: string
  fallback: string
}

const MAX_PETITIONS = 3

/** Who asks for an audience this dawn, and why: first those who speak for the town, then the hungriest for themselves. */
export function grievances(o: { content: WorldContent; economy: Economy; chronicle: ChronicleEntry[]; minutes: number }): Grievance[] {
  const e = o.economy
  const living = Object.keys(e.needs).filter((id) => alive(e, id))
  const hungry = living.filter((id) => e.needs[id].daysHungry > 0)
  const out: Grievance[] = []
  const ask = (id: string, topic: PetitionTopic, wish: string, fallback: string) => {
    if (living.includes(id) && out.length < MAX_PETITIONS && !out.some((g) => g.id === id)) out.push({ id, topic, wish, fallback })
  }
  if (hungry.length >= 3) ask('clemencia', 'hunger', `Hay ${hungry.length} vecinos pasando hambre y quieres que se abra el granero a los pobres.`, `Hay ${hungry.length} vecinos pasando hambre. Os ruego que abráis el granero a los pobres.`)
  if (foodDays(e) < 3) ask('godric', 'granary', 'El granero apenas da para unos días y quieres que se compre grano ya.', 'El granero apenas da para unos días. Hay que comprar grano antes de que sea tarde.')
  if (e.taxRate >= 0.3) ask('bartolo', 'taxes', `El impuesto está en el ${Math.round(e.taxRate * 100)}% y quieres que lo bajen.`, `Con un impuesto del ${Math.round(e.taxRate * 100)}% nadie hace negocio. Bajadlo, mi señora.`)
  if (averageMood(e) < 0.45 && !e.laws.rationing) ask('rowan', 'mood', 'El pueblo anda triste y quieres una fiesta.', 'El pueblo anda triste. Una fiesta levantaría los ánimos.')
  if (e.laws.rationing) ask('agnes', 'rationing', 'Hay racionamiento y quieres que se acabe: las medias raciones enferman a viejos y niños.', 'Las medias raciones enferman a los viejos y a los niños.')
  if (e.laws.curfew) ask('finn', 'curfew', 'Hay toque de queda y quieres que lo levanten: la taberna está vacía de noche.', 'Con el toque de queda la taberna está vacía de noche.')
  if (o.chronicle.some((c) => c.minutes >= o.minutes - 1440 && /esqueleto|lobo|bestia|fantasma|ladr/i.test(c.text)))
    ask('aldric', 'guard', 'Han rondado peligros cerca del pueblo y quieres más hombres en la guardia.', 'Necesito más hombres en la guardia para proteger al pueblo.')
  const starving = [...hungry].filter((id) => e.needs[id].daysHungry >= 2 && id !== 'clemencia').sort((a, b) => e.needs[b].daysHungry - e.needs[a].daysHungry || a.localeCompare(b))[0]
  if (starving) {
    const days = e.needs[starving].daysHungry
    ask(starving, 'starving', `Llevas ${days} días sin comer y quieres que la Baronesa te dé de comer.`, `Llevo ${days} días sin comer, mi señora. Os pido un plato de comida.`)
  }
  return out
}

export const PETITION_SYSTEM = `Eres un vecino de Chismeroble, una aldea de fantasía, y hoy te presentas ante la Baronesa Isolda para pedirle algo.
Responde SOLO con un objeto JSON, sin texto antes ni después:
{ "peticion": "lo que le dices a la Baronesa, en una o dos frases, con tu forma de hablar" }
Pide lo que te trae, a tu manera: con respeto, con miedo, con picardía o con enfado, según quién eres y cuánto te fías de ella. Escribe en español.`

const pct = (x: number) => `${Math.round(x * 100)}%`

export function petitionPrompt(i: MusingInput, g: Grievance) {
  const p = i.resident.personality
  return [
    `Eres ${i.resident.name}, ${i.resident.occupation}, ${i.resident.age} años. ${i.resident.bio}`,
    `Hablas así: ${p.voice} Te importa: ${p.values.join(', ')}. Temes: ${p.fears.join(', ')}.`,
    '',
    `Lo que te trae: ${g.wish}`,
    `Tienes ${i.coins} monedas. Salud: ${pct(i.needs.health)}. Ánimo: ${pct(i.needs.mood)}.`,
    `Leyes en vigor: ${i.laws.length ? i.laws.join(', ') : 'ninguna'}.`,
    `Confías en la Baronesa un ${pct(i.trust)}.`,
  ].join('\n')
}

export function parsePetition(text: string): string | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const raw = JSON.parse(text.slice(start, end + 1)) as { peticion?: unknown }
    return typeof raw.peticion === 'string' && raw.peticion.trim() ? raw.peticion.trim().slice(0, 280) : null
  } catch {
    return null
  }
}
