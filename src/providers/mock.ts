import { normalize } from '../core/reactions/announcement'
import type { Action, Decision, DecisionContext, DecisionEvent, DecisionProvider } from '../core/decisions/types'
import { firstName as first, listNames, toPlace } from '../core/lang'
import type { WorldContent } from '../core/world/content'
import { createRng, type Rng } from '../core/world/rng'
import { buildPrompt } from './llm/prompt'
import { WEATHER_TEXT } from '../core/sim/weather'

export type Vocabulary = WorldContent['vocabulary']

/** Rough life expectancy per ancestry, so a 142-year-old dwarf is not treated as frail. */
const LIFESPAN: Record<string, number> = { human: 90, halfling: 140, halforc: 75, tiefling: 100, gnome: 350, dwarf: 350, elf: 700 }
const NEGATIVE_RELATION = ['rival', 'no le cae', 'critica', 'usurpadora', 'desconfianza', 'vigila']

const hashString = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7)
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))

export function isPositiveRelation(label: string) {
  return !NEGATIVE_RELATION.some((w) => label.includes(w))
}

interface Reading {
  opportunity: boolean
  danger: boolean
  cues: string[]
  home: boolean
}

function read(ctx: DecisionContext, vocab: Vocabulary): Reading {
  const t = normalize(ctx.announcement.text)
  return {
    opportunity: vocab.opportunity.some((w) => t.includes(normalize(w))),
    danger: vocab.danger.some((w) => t.includes(normalize(w))),
    cues: [...new Set(vocab.cues.filter(([w]) => t.includes(normalize(w))).map(([, label]) => label))],
    home: ctx.announcement.place === 'home',
  }
}

export function mockDecision(ctx: DecisionContext, vocab: Vocabulary): Decision {
  const rng = createRng(hashString(ctx.resident.id + ctx.announcement.id + ctx.rumors.length))
  const traits = normalize(ctx.resident.traits.join(' '))
  const has = (...words: string[]) => words.some((w) => traits.includes(w))
  const r = read(ctx, vocab)
  const a = ctx.announcement

  const sc = ctx.resident.personality.scales
  let trust = { authority: 0.72, neighbor: 0.55, stranger: 0.22 }[a.speakerKind]
  if (a.relationToSpeaker) trust += isPositiveRelation(a.relationToSpeaker) ? 0.3 : -0.3
  trust += (sc.credulity - 0.5) * 0.6
  if (a.speakerKind === 'stranger' && has('forastero')) trust -= 0.25
  if (a.speakerKind === 'authority') trust += (sc.authority - 0.5) * 0.5
  trust -= 0.22 * r.cues.length * (1.2 - sc.credulity)
  trust += rng.range(-0.1, 0.1)

  const rumor = ctx.rumors[ctx.rumors.length - 1]
  if (rumor) {
    const weight = (rumor.relation && isPositiveRelation(rumor.relation) ? 0.6 : 0.3) * (0.6 + sc.credulity * 0.6)
    const endorses = !/estafa|no te fies|cuidado con|mentira|trampa/.test(normalize(rumor.message))
    trust = trust * (1 - weight) + (endorses ? 0.9 : 0.1) * weight
  }
  trust = clamp(trust)

  const curious = has('curios', 'impulsiv', 'inquiet', 'sonador', 'aventurer') || (sc.bravery >= 0.8 && sc.credulity < 0.4)
  const social = sc.sociability >= 0.65
  const greedy = sc.greed >= 0.65
  const solitary = sc.sociability <= 0.25
  const skeptic = sc.credulity <= 0.3
  const timid = sc.bravery <= 0.3
  const guard = sc.authority >= 0.85 && sc.bravery >= 0.8
  const busy = has('trabajador')
  const foul = (['rain', 'storm', 'snow'] as const).some((w) => ctx.situation.weather === WEATHER_TEXT[w].sentence)
  const frail = ctx.resident.age / (LIFESPAN[ctx.resident.ancestry ?? 'human'] ?? LIFESPAN.human) >= 0.8
  const believes = trust >= 0.5
  let excuse: string | null = null

  let action: Action
  if (r.danger && r.home) {
    action = believes ? (social && rng.chance(0.6) ? 'warn' : 'stay_home') : curious ? 'investigate' : timid ? 'stay_home' : 'ignore'
  } else if (r.danger) {
    action = guard ? 'investigate' : believes ? (social ? 'warn' : timid ? 'stay_home' : 'ignore') : curious ? 'investigate' : 'ignore'
  } else if (r.opportunity) {
    if (believes) {
      action = 'go'
      if (busy && rng.chance(0.7)) excuse = 'Ahora mismo no puedo dejar el trabajo.'
      else if (foul && !greedy && sc.bravery < 0.7) excuse = 'Con este tiempo, mejor me quedo bajo techo.'
      else if (frail && !greedy && trust < 0.85) excuse = 'A mi edad ya no estoy para multitudes.'
      else if (solitary && !greedy && trust < 0.85) excuse = 'Prefiero no mezclarme con la multitud.'
      else if (skeptic && trust < 0.62) action = 'investigate'
      if (excuse) action = 'ignore'
    } else if (guard || (greedy && !timid)) action = 'investigate'
    else if (social && r.cues.length) action = 'warn'
    else action = curious ? 'investigate' : 'ignore'
  } else {
    action = believes && (curious || social) ? 'go' : curious ? 'investigate' : 'ignore'
  }

  const friends = ctx.relationships.filter((rel) => isPositiveRelation(rel.label) && rel.id !== ctx.resident.id)
  let tell: string[] = []
  if (action === 'warn') tell = pickSome(rng, friends, rng.chance(0.5) ? 2 : 1).map((f) => f.id)
  else if (action === 'go' && social && rng.chance(0.45)) tell = pickSome(rng, friends, 1).map((f) => f.id)
  if (action === 'warn' && !tell.length) action = believes && r.home ? 'stay_home' : 'ignore'
  const tellNames = tell.map((id) => first(ctx.relationships.find((f) => f.id === id)!.name))

  const place = a.placeLabel ?? 'allí'
  const reasoning = [
    rumor ? rumorLine(rumor, ctx.previous, action) : null,
    sourceLine(ctx, trust, rng),
    contentLine(r, trust, greedy, rng),
    excuse ?? traitLine(traits, r, action),
    actionLine(action, place, tellNames, believes, r),
  ]
    .filter(Boolean)
    .join(' ')

  return {
    action,
    believes,
    tell,
    reasoning,
    speech: excuse && busy ? 'Tengo mucho trabajo.' : speechFor(action, place, tellNames, believes, r.danger, rng),
    emoji: emojiFor(action, believes, normalize(a.text)),
    confidence: Math.round(clamp(Math.abs(trust - 0.5) * 1.6 + 0.25, 0.3, 0.95) * 100) / 100,
  }
}

function pickSome<T>(rng: Rng, items: T[], n: number) {
  const pool = [...items]
  const out: T[] = []
  while (pool.length && out.length < n) out.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0])
  return out
}

function rumorLine(rumor: DecisionContext['rumors'][number], previous: Decision | null, action: Action) {
  const who = first(rumor.fromName)
  const changed = previous && previous.action !== action
  return `${who} vino a decirme: «${rumor.message}». ${changed ? 'Eso me hace cambiar de idea.' : 'Aun así, no cambio de opinión.'}`
}

function sourceLine(ctx: DecisionContext, trust: number, rng: Rng) {
  const a = ctx.announcement
  if (a.speakerKind === 'authority')
    return trust >= 0.5
      ? rng.pick(['Es un anuncio oficial; no hay por qué dudar.', `Si lo dice ${a.speakerName}, será verdad.`])
      : rng.pick(['Los de arriba dicen muchas cosas y no siempre me fío.', 'Que sea un anuncio oficial no lo hace cierto.'])
  if (a.speakerKind === 'stranger')
    return trust >= 0.5
      ? 'No sé quién es, pero no parece mala persona.'
      : rng.pick(['Un desconocido que nadie ha visto antes… no me da buena espina.', 'No conozco de nada a quien lo dice.'])
  const who = first(a.speakerName)
  if (a.relationToSpeaker)
    return isPositiveRelation(a.relationToSpeaker)
      ? `Lo dice ${who} (${a.relationToSpeaker}); confío en su palabra.`
      : `Lo dice ${who}, y con ${who} no me llevo bien.`
  return trust >= 0.5 ? `Lo dice ${who}; no tenemos mucha relación, pero es gente del pueblo.` : `Lo dice ${who}, y no sé si fiarme.`
}

function contentLine(r: Reading, trust: number, greedy: boolean, rng: Rng) {
  if (r.cues.length) return `Eso de ${r.cues.map((c) => `«${c}»`).join(' y ')} suena a trampa.`
  if (r.danger) return trust >= 0.5 ? rng.pick(['Con estas cosas no se juega.', 'Más vale prevenir que lamentar.']) : 'Seguro que exageran.'
  if (r.opportunity && greedy) return 'Algo gratis nunca se desprecia.'
  if (r.opportunity) return trust >= 0.5 ? 'Suena bien, la verdad.' : 'Demasiado bonito para ser verdad.'
  return null
}

function traitLine(traits: string, r: Reading, action: Action) {
  if (traits.includes('supersticios') && r.cues.includes('a medianoche')) return 'Lo que pasa a medianoche nunca trae nada bueno.'
  if (traits.includes('responsable') && (action === 'warn' || action === 'investigate')) return 'Es mi responsabilidad que nadie salga perjudicado.'
  if (traits.includes('protector')) return 'Lo primero es que mi familia esté bien.'
  if (traits.includes('chismos') && action === 'warn') return '¡Esto hay que contarlo!'
  if (traits.includes('oportunista')) return 'Quizá haya negocio en todo esto.'
  if (traits.includes('curios') && action !== 'ignore') return 'La curiosidad me puede.'
  if (traits.includes('solitari')) return 'Prefiero no mezclarme con la multitud.'
  if (traits.includes('desconfiad') || traits.includes('esceptic'))
    return action === 'go' || action === 'investigate' ? 'Iré a verlo con mis propios ojos.' : 'Prefiero ver antes de creer.'
  if (traits.includes('credul')) return '¿Por qué iba alguien a mentir con algo así?'
  return null
}

function actionLine(action: Action, place: string, tell: string[], believes: boolean, r: Reading) {
  const also = tell.length ? ` De camino se lo cuento a ${listNames(tell)}.` : ''
  switch (action) {
    case 'go':
      return `Voy ${toPlace(place)} ahora mismo.${also}`
    case 'stay_home':
      return 'Me voy a casa y no salgo hasta que pase.'
    case 'warn':
      return believes
        ? `Antes que nada, voy a avisar a ${listNames(tell)}.${r.home ? ' Luego, a casa.' : ''}`
        : `Voy a advertir a ${listNames(tell)} para que no caigan en esto.`
    case 'investigate':
      return `Me acercaré ${toPlace(place)} con cuidado, a ver qué hay de cierto.`
    case 'ignore':
      if (believes && r.danger) return `Evitaré ${place} y seguiré con mi día.`
      return believes ? 'Me lo pierdo esta vez.' : 'Seguiré con mi día como si nada.'
  }
}

function speechFor(action: Action, place: string, tell: string[], believes: boolean, danger: boolean, rng: Rng) {
  switch (action) {
    case 'go':
      return rng.pick([`¡Voy ${toPlace(place)}!`, '¡No me lo pierdo!', '¡Allá voy!'])
    case 'stay_home':
      return rng.pick(['Yo me quedo en casa.', 'Mejor me resguardo.', 'A casa, por si acaso.'])
    case 'warn':
      return believes ? `¡Tengo que avisar a ${tell[0]}!` : `¡${tell[0]}, es una estafa!`
    case 'investigate':
      return rng.pick(['Voy a ver qué pasa…', 'Esto hay que comprobarlo.', 'Echaré un vistazo…'])
    case 'ignore':
      if (believes && danger) return `Mejor evito ${place}.`
      return believes ? rng.pick(['Sigo con lo mío.', 'Otro día será.', 'Hoy no me apetece.']) : rng.pick(['Bah, no me lo creo.', 'Paso de eso.', 'Qué cosas dice la gente…'])
  }
}

function emojiFor(action: Action, believes: boolean, text: string) {
  switch (action) {
    case 'go':
      return /comida|pan|comer/.test(text) ? '😋' : /dinero|efectivo/.test(text) ? '🤑' : /musica|fiesta/.test(text) ? '🎶' : '🏃'
    case 'stay_home':
      return '🏠'
    case 'warn':
      return '📣'
    case 'investigate':
      return '🔍'
    case 'ignore':
      return believes ? '🤷' : '🙄'
  }
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason)
    const t = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => (clearTimeout(t), reject(signal.reason)), { once: true })
  })

export const createMockProvider = (vocab: Vocabulary): DecisionProvider => ({
  id: 'mock',
  label: 'Simulado',
  async *decide(ctx, signal): AsyncIterable<DecisionEvent> {
    yield { type: 'request', system: 'Modo simulado: reglas locales, no se envía nada a ningún modelo. Este es el contexto que recibiría un LLM:', prompt: buildPrompt(ctx) }
    const decision = mockDecision(ctx, vocab)
    const rng = createRng(hashString(ctx.resident.id + ctx.announcement.id) ^ 0x5f3759df)
    const slow = /paciente|cautelos|metodic/.test(normalize(ctx.resident.traits.join(' '))) ? 700 : 0
    const total = rng.range(900, 3200) + slow + (ctx.resident.age > 65 ? 450 : 0)
    await sleep(total * 0.35, signal)
    const words = decision.reasoning.split(' ')
    const step = (total * 0.65) / words.length
    for (let i = 0; i < words.length; i++) {
      await sleep(step, signal)
      yield { type: 'reasoning', delta: (i ? ' ' : '') + words[i] }
    }
    yield { type: 'response', text: JSON.stringify(decision, null, 2) }
    yield { type: 'final', decision }
  },
})

/** The same rules without the theatrical delay: the benchmark's instant baseline and reference. */
export const createRulesProvider = (vocab: Vocabulary): DecisionProvider => ({
  id: 'rules',
  label: 'Reglas',
  async *decide(ctx): AsyncIterable<DecisionEvent> {
    yield { type: 'final', decision: mockDecision(ctx, vocab) }
  },
})
