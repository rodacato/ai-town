import { alive, averageMood, foodDays, type Economy } from '../economy/economy'
import type { TownMemory } from '../memory/memory'
import { createRng } from '../world/rng'
import type { WorldContent } from '../world/content'
import { SEASON_TEXT, type Season } from '../sim/season'
import { WEATHER_TEXT, type Weather } from '../sim/weather'
import type { ChronicleEntry } from './chronicle'
import { firstName } from '../lang'
import { GOALS, guildWord, type GuildWord, type Standing } from './standing'

export interface Petition {
  from: string
  text: string
}

/** What reaches the castle each dawn: exact coffers, rough spirits, late and sometimes exaggerated news, and petitions. */
export interface RoyalReport {
  day: number
  season: Season
  weather: Weather
  treasury: number
  granary: number
  foodDays: number
  taxRate: number
  foodPrice: number
  laws: Economy['laws']
  population: number
  lost: number
  /** Rough, as the court perceives it. */
  mood: 'muy bajo' | 'bajo' | 'regular' | 'bueno' | 'excelente'
  hungry: number
  trust: 'por los suelos' | 'baja' | 'dudosa' | 'buena' | 'muy alta'
  news: string[]
  petitions: Petition[]
  /** What the court hears of the thieves' guild. */
  guild: GuildWord
  unrest: boolean
  /** Dawns left to complete the year. */
  daysLeft: number
}

const moodWord = (m: number): RoyalReport['mood'] => (m < 0.25 ? 'muy bajo' : m < 0.45 ? 'bajo' : m < 0.6 ? 'regular' : m < 0.8 ? 'bueno' : 'excelente')
const trustWord = (t: number): RoyalReport['trust'] => (t < 0.2 ? 'por los suelos' : t < 0.4 ? 'baja' : t < 0.55 ? 'dudosa' : t < 0.75 ? 'buena' : 'muy alta')

/** Some news arrives as hearsay: flagged, and with its numbers blown up. */
function rumour(text: string, next: () => number) {
  if (next() > 0.3) return text
  const inflated = text.replace(/\d+/g, (n) => String(Math.round(Number(n) * (1.5 + next()))))
  return `Dicen por ahí que ${inflated.charAt(0).toLowerCase()}${inflated.slice(1)}`
}

export function buildReport(input: {
  content: WorldContent
  economy: Economy
  memory: TownMemory
  chronicle: ChronicleEntry[]
  minutes: number
  season: Season
  weather: Weather
  day: number
  seed: number
  standing?: Standing
}): RoyalReport {
  const { economy: e, content } = input
  const rng = createRng(input.seed * 1000 + input.day)
  const ids = Object.keys(e.needs)
  const living = ids.filter((id) => alive(e, id))
  // News of the last day reaches the castle; what happened this morning has not arrived yet.
  const news = input.chronicle
    .filter((c) => c.minutes >= input.minutes - 1440 - 60 && c.minutes < input.minutes - 30 && c.kind !== 'ruler' && c.kind !== 'decree')
    .slice(-8)
    .map((c) => (c.kind === 'event' || c.kind === 'death' || c.kind === 'leave' ? rumour(c.text, rng.next) : c.text))
  const hungry = living.filter((id) => e.needs[id].daysHungry > 0).length
  const name = (id: string) => firstName(content.residents.find((r) => r.id === id)?.name ?? id)
  const petitions: Petition[] = []
  const ask = (id: string, text: string) => {
    if (living.includes(id) && petitions.length < 3) petitions.push({ from: name(id), text })
  }
  if (hungry >= 3) ask('clemencia', `Hay ${hungry} vecinos pasando hambre. Os ruego que abráis el granero a los pobres.`)
  if (foodDays(e) < 3) ask('godric', 'El granero apenas da para unos días. Hay que comprar grano antes de que sea tarde.')
  if (e.taxRate >= 0.3) ask('bartolo', `Con un impuesto del ${Math.round(e.taxRate * 100)}% nadie hace negocio. Bajadlo, mi señora.`)
  if (averageMood(e) < 0.45 && !e.laws.rationing) ask('rowan', 'El pueblo anda triste. Una fiesta levantaría los ánimos.')
  if (e.laws.rationing) ask('agnes', 'Las medias raciones enferman a los viejos y a los niños.')
  if (e.laws.curfew) ask('finn', 'Con el toque de queda la taberna está vacía de noche.')
  if (input.chronicle.some((c) => c.minutes >= input.minutes - 1440 && /esqueleto|lobo|bestia|fantasma|ladr/i.test(c.text)))
    ask('aldric', 'Necesito más hombres en la guardia para proteger al pueblo.')
  return {
    day: input.day,
    season: input.season,
    weather: input.weather,
    treasury: e.treasury,
    granary: Math.floor(e.granary),
    foodDays: foodDays(e),
    taxRate: e.taxRate,
    foodPrice: e.foodPrice,
    laws: { ...e.laws },
    population: living.length,
    lost: ids.length - living.length,
    mood: moodWord(averageMood(e)),
    hungry,
    trust: trustWord(input.memory.reputation({ kind: 'authority' }).trust),
    news,
    petitions,
    guild: input.standing ? guildWord(input.standing) : 'nada',
    unrest: (input.standing?.unrest ?? 0) > 0,
    daysLeft: Math.max(0, GOALS.yearDays - input.day),
  }
}

export function reportText(r: RoyalReport) {
  const laws = Object.entries({ curfew: 'toque de queda', rationing: 'racionamiento', levy: 'leva de guardias' })
    .filter(([k]) => r.laws[k as keyof RoyalReport['laws']])
    .map(([, v]) => v)
  return [
    `# Informe del castillo · amanecer del día ${r.day + 1}`,
    `${SEASON_TEXT[r.season].sentence} ${WEATHER_TEXT[r.weather].sentence}`,
    '',
    '## Arcas',
    `- Tesoro: ${r.treasury} monedas.`,
    `- Granero: ${r.granary} raciones (unos ${Number.isFinite(r.foodDays) ? r.foodDays.toFixed(1) : 'muchos'} días al consumo actual).`,
    `- Impuesto: ${Math.round(r.taxRate * 100)}%. Ración: ${r.foodPrice} monedas.`,
    `- Leyes en vigor: ${laws.length ? laws.join(', ') : 'ninguna'}.`,
    '',
    '## El pueblo, según la corte',
    `- Viven en el pueblo ${r.population} vecinos${r.lost ? ` (${r.lost} se fueron o murieron)` : ''}.`,
    `- Ayer pasaron hambre ${r.hungry}.`,
    `- El ánimo parece ${r.mood}. La confianza en ti es ${r.trust}.`,
    '',
    '## Amenazas',
    `- Del gremio de ladrones de la capital: ${r.guild === 'inminente' ? 'se dice que preparan un golpe contra el tesoro' : r.guild === 'rumores' ? 'corren rumores de forasteros sospechosos' : 'nada se sabe'}.`,
    `- ${r.unrest ? 'Hay murmullos de revuelta en la plaza.' : 'No hay señales de revuelta.'}`,
    `- Faltan ${r.daysLeft} días para cumplir un año de gobierno.`,
    '',
    '## Noticias (pueden venir exageradas)',
    ...(r.news.length ? r.news.map((n) => `- ${n}`) : ['- Nada digno de mención.']),
    '',
    '## Peticiones',
    ...(r.petitions.length ? r.petitions.map((p) => `- ${p.from}: «${p.text}»`) : ['- Nadie ha pedido audiencia.']),
  ].join('\n')
}
