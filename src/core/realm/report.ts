import { alive, averageMood, foodDays, lawsInForce, type Economy } from '../economy/economy'
import type { TownMemory } from '../memory/memory'
import { createRng } from '../world/rng'
import type { WorldContent } from '../world/content'
import { SEASON_TEXT, type Season } from '../sim/season'
import { WEATHER_TEXT, type Weather } from '../sim/weather'
import type { ChronicleEntry } from './chronicle'
import { nameOf } from '../lang'
import { rationCost } from './decrees'
import { GOALS, guildWord, type GuildWord, type Standing } from './standing'
import { capital, ofThe } from './realmDef'
import { grievances, type PetitionTopic } from './petitions'

export interface CreatorReply {
  /** What she asked. */
  letter: string
  reply: string
}

export interface Petition {
  from: string
  text: string
  topic: PetitionTopic
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
  /** What merchants charge per ration of grain. */
  rationCost: number
  laws: Economy['laws']
  population: number
  lost: number
  /** Rough, as the court perceives it. */
  mood: MoodLevel
  hungry: number
  trust: TrustLevel
  news: string[]
  petitions: Petition[]
  /** The creator's answers to her letters, arriving for the first time. */
  replies: CreatorReply[]
  /** What the court hears of the thieves' guild, and what the world calls it. */
  guild: GuildWord
  guildName: string
  unrest: boolean
  /** Dawns left to complete the year. */
  daysLeft: number
}

export type MoodLevel = 'very-low' | 'low' | 'fair' | 'good' | 'excellent'
export type TrustLevel = 'rock-bottom' | 'low' | 'doubtful' | 'good' | 'very-high'

/** How the court words each level in the report the ruler reads. */
const MOOD_WORD: Record<MoodLevel, string> = { 'very-low': 'muy bajo', low: 'bajo', fair: 'regular', good: 'bueno', excellent: 'excelente' }
const TRUST_WORD: Record<TrustLevel, string> = { 'rock-bottom': 'por los suelos', low: 'baja', doubtful: 'dudosa', good: 'buena', 'very-high': 'muy alta' }

const moodLevel = (m: number): MoodLevel => (m < 0.25 ? 'very-low' : m < 0.45 ? 'low' : m < 0.6 ? 'fair' : m < 0.8 ? 'good' : 'excellent')
const trustLevel = (t: number): TrustLevel => (t < 0.2 ? 'rock-bottom' : t < 0.4 ? 'low' : t < 0.55 ? 'doubtful' : t < 0.75 ? 'good' : 'very-high')

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
  /** Petitions already worded, by a model; without them the residents with a grievance use their usual words. */
  petitions?: Petition[]
  replies?: CreatorReply[]
}): RoyalReport {
  const { economy: e, content } = input
  const rng = createRng(input.seed * 1000 + input.day)
  const ids = Object.keys(e.needs)
  const living = ids.filter((id) => alive(e, id))
  // News of the last day reaches the castle; what happened this morning has not arrived yet.
  const news = input.chronicle
    .filter((c) => c.minutes >= input.minutes - 1440 - 60 && c.minutes < input.minutes - 30 && c.kind !== 'ruler' && c.kind !== 'decree' && c.kind !== 'petition')
    .slice(-8)
    .map((c) => (c.kind === 'event' || c.kind === 'death' || c.kind === 'leave' ? rumour(c.text, rng.next) : c.text))
  const hungry = living.filter((id) => e.needs[id].daysHungry > 0).length
  const name = (id: string) => nameOf(content, id)
  const petitions = input.petitions ?? grievances({ content, economy: e, chronicle: input.chronicle, minutes: input.minutes }).map((g) => ({ from: name(g.id), text: g.fallback, topic: g.topic }))
  return {
    day: input.day,
    season: input.season,
    weather: input.weather,
    treasury: e.treasury,
    granary: Math.floor(e.granary),
    foodDays: foodDays(e),
    taxRate: e.taxRate,
    foodPrice: e.foodPrice,
    rationCost: rationCost(e),
    laws: { ...e.laws },
    population: living.length,
    lost: ids.length - living.length,
    mood: moodLevel(averageMood(e)),
    hungry,
    trust: trustLevel(input.memory.reputation({ kind: 'authority' }).trust),
    news,
    petitions,
    replies: input.replies ?? [],
    guild: input.standing ? guildWord(input.standing) : 'none',
    guildName: content.realm?.guild.name ?? 'los ladrones',
    unrest: (input.standing?.unrest ?? 0) > 0,
    daysLeft: Math.max(0, GOALS.yearDays - input.day),
  }
}

export function reportText(r: RoyalReport) {
  const laws = lawsInForce(r.laws)
  return [
    `# Informe de la corte · amanecer del día ${r.day + 1}`,
    `${SEASON_TEXT[r.season].sentence} ${WEATHER_TEXT[r.weather].sentence}`,
    '',
    '## Arcas',
    `- Tesoro: ${r.treasury} monedas.`,
    `- Granero: ${r.granary} raciones (unos ${Number.isFinite(r.foodDays) ? r.foodDays.toFixed(1) : 'muchos'} días al consumo actual).`,
    `- Impuesto: ${Math.round(r.taxRate * 100)}%. Ración: ${r.foodPrice} monedas.`,
    `- Los mercaderes venden grano a ${r.rationCost} monedas la ración.`,
    `- Leyes en vigor: ${laws.length ? laws.join(', ') : 'ninguna'}.`,
    '',
    '## El pueblo, según la corte',
    `- Viven en el pueblo ${r.population} vecinos${r.lost ? ` (${r.lost} se fueron o murieron)` : ''}.`,
    `- Ayer pasaron hambre ${r.hungry}.`,
    `- El ánimo parece ${MOOD_WORD[r.mood]}. La confianza en ti es ${TRUST_WORD[r.trust]}.`,
    '',
    '## Amenazas',
    `- ${capital(ofThe(r.guildName))}: ${r.guild === 'imminent' ? 'se dice que preparan un golpe contra el tesoro' : r.guild === 'rumors' ? 'corren rumores de forasteros sospechosos' : 'nada se sabe'}.`,
    `- ${r.unrest ? 'Hay murmullos de revuelta en la plaza.' : 'No hay señales de revuelta.'}`,
    `- Faltan ${r.daysLeft} días para cumplir un año de gobierno.`,
    '',
    '## Noticias (pueden venir exageradas)',
    ...(r.news.length ? r.news.map((n) => `- ${n}`) : ['- Nada digno de mención.']),
    '',
    '## Peticiones',
    ...(r.petitions.length ? r.petitions.map((p) => `- ${p.from}: «${p.text}»`) : ['- Nadie ha pedido audiencia.']),
    ...(r.replies.length ? ['', '## Respuestas del creador a tus cartas', ...r.replies.map((x) => `- Le pediste: «${x.letter}» Te responde: «${x.reply}»`)] : []),
  ].join('\n')
}
