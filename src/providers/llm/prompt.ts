import type { DecisionContext } from '../../core/decisions/types'
import { bondLines } from '../../core/memory/recall'
import { SCALES } from '../../core/world/content'
import { levelOf, SCALE_LABEL } from '../../core/world/personality'

export const buildSystemPrompt = (world: DecisionContext['world']) => `Eres el motor de decisiones de "${world.name}", un pueblo simulado en un experimento social. ${world.setting}

En cada petición interpretas a UN residente concreto que acaba de escuchar un anuncio público, y decides qué hace de forma creíble según su personalidad, su edad, su oficio, sus relaciones y lo que sabe.

Piensa como esa persona, no como un asistente: puede ser crédula, desconfiada, perezosa, valiente o egoísta. No todos reaccionan igual; la gracia del experimento está en las diferencias. Ten en cuenta:
- Quién hace el anuncio y qué relación tiene con él o ella (confianza, rivalidades, autoridad).
- Su alineamiento, si lo tiene: alguien legal respeta la autoridad, alguien caótico desconfía de ella, alguien malvado busca su propio beneficio.
- Su personalidad: sus escalas de 0 a 1 (credulidad, valentía, sociabilidad, respeto a la autoridad, codicia) deben notarse en lo que decide; sus valores y miedos, en por qué lo decide.
- Su secreto: nadie más lo sabe y nunca lo dice en voz alta, pero puede pesar en su decisión.
- Señales sospechosas en el mensaje (dinero fácil, secretos, "vengan solos", horarios raros).
- Lo que le hayan contado otros vecinos (rumores) y su decisión anterior, si la hay.
- Lo que recuerda: si quien habla mintió o dijo la verdad antes, y si a él o ella ya le engañaron.
- Lo que estaba haciendo en ese momento, la hora, la estación y el tiempo que hace.

Acciones posibles (elige exactamente una):
- "go": ir al lugar del anuncio.
- "stay_home": volver a casa y quedarse dentro.
- "warn": ir a avisar a una o varias personas cercanas (indícalas en "tell").
- "investigate": acercarse con cautela a mirar de lejos, sin comprometerse.
- "ignore": seguir con su día (sea porque no lo cree o porque no le interesa).

Responde SOLO con un objeto JSON válido, sin texto antes ni después y sin bloques de código, con estas claves en este orden:
{
  "reasoning": "2 a 4 frases en primera persona, con la voz descrita en su personalidad, explicando por qué decide eso",
  "action": "go | stay_home | warn | investigate | ignore",
  "believes": true o false (si cree que el anuncio es cierto, independientemente de lo que haga),
  "tell": ["ids de residentes a quienes avisará"] (vacío salvo que quiera avisar a alguien; máximo 3; usa solo ids de la lista de vecinos),
  "speech": "lo que dice en voz alta con su forma de hablar, máximo 40 caracteres",
  "emoji": "un solo emoji que resuma su reacción",
  "confidence": número entre 0 y 1 (qué tan segura está de su decisión)
}
Escribe siempre en español.`

/**
 * The prompt in two parts: what every resident hearing the same announcement shares (it goes first, so it can be
 * cached), and what is only theirs.
 */
export function buildPromptParts(ctx: DecisionContext): { shared: string; own: string } {
  const r = ctx.resident
  const a = ctx.announcement
  const everyone = [...ctx.townsfolk, { id: r.id, name: r.name }].sort((x, y) => x.id.localeCompare(y.id))
  const shared = [
    `## Anuncio`,
    a.speakerKind === 'sight' ? 'Nadie te lo ha contado: lo estás viendo con tus propios ojos.' : `Lo dice: ${a.speakerName}.`,
    `Mensaje: «${a.text}»`,
    a.placeLabel ? `Lugar mencionado: ${a.placeLabel}.` : 'No menciona un lugar concreto.',
    ``,
    `## Vecinos del pueblo (ids válidos para "tell"; no te incluyas a ti)`,
    everyone.map((p) => `${p.id} (${p.name})`).join(', '),
  ]
  const own = [
    `## Residente`,
    `id: ${r.id}`,
    `${r.name}, ${r.age} años, ${r.occupation}.`,
    r.bio,
    `Rasgos: ${r.traits.join(', ')}.`,
    ...(r.alignment ? [`Alineamiento: ${r.alignment}.`] : []),
    ``,
    `## Personalidad`,
    `Cómo habla: ${r.personality.voice}`,
    `Le importa: ${r.personality.values.join(', ')}.`,
    `Le da miedo: ${r.personality.fears.join(', ')}.`,
    `Su secreto: ${r.personality.secret}`,
    ...SCALES.map((k) => `- ${SCALE_LABEL[k].name} (${SCALE_LABEL[k].hint}): ${r.personality.scales[k].toFixed(2)}, ${levelOf(r.personality.scales[k])}`),
    ``,
    `## Relaciones`,
    ...(ctx.relationships.length ? ctx.relationships.map((rel) => `- ${rel.name} (id: ${rel.id}): ${rel.label}`) : ['- Nadie: acabas de llegar y aún no conoces a nadie en el pueblo.']),
    ...(a.relationToSpeaker ? [`- Quien anuncia es, para ti: ${a.relationToSpeaker}.`] : []),
    ``,
    `## Situación`,
    `Es ${ctx.situation.time}. ${ctx.situation.season} ${ctx.situation.weather} En este momento: ${ctx.situation.activity}.`,
    ...needsLines(ctx),
  ]
  const m = ctx.memory
  const bonds = m ? bondLines(m) : []
  if (m && (m.record || m.personal || m.recent.length || bonds.length)) {
    own.push('', '## Lo que recuerdas')
    if (m.record) own.push(`- ${m.record}`)
    if (m.personal) own.push(`- ${m.personal}`)
    for (const line of bonds) own.push(`- ${line}`)
    if (m.recent.length) own.push(`- Lo último que pasó en el pueblo: ${m.recent.join('; ')}.`)
  }
  if (ctx.rumors.length) {
    own.push('', '## Lo que te han contado después')
    for (const rumor of ctx.rumors) own.push(`- ${rumor.fromName}${rumor.relation ? ` (${rumor.relation})` : ''} vino a decirte: «${rumor.message}»${tellerHistory(rumor)}`)
  }
  if (ctx.previous) {
    own.push('', '## Tu decisión anterior', `Habías decidido "${ctx.previous.action}" y dijiste: «${ctx.previous.speech}». Puedes mantenerla o cambiarla.`)
  }
  return { shared: shared.join('\n'), own: own.join('\n') }
}

function tellerHistory(r: DecisionContext['rumors'][number]) {
  const parts = [...(r.misled ? [`ya te pasó ${r.misled === 1 ? 'una mentira' : `${r.misled} mentiras`}`] : []), ...(r.warned ? [`te avisó bien ${r.warned === 1 ? 'una vez' : `${r.warned} veces`}`] : [])]
  return parts.length ? ` (${parts.join(' y ')})` : ''
}

export function buildPrompt(ctx: DecisionContext) {
  const { shared, own } = buildPromptParts(ctx)
  return `${shared}\n\n${own}`
}

function needsLines(ctx: DecisionContext) {
  const n = ctx.situation.needs
  if (!n) return []
  const out: string[] = []
  if (n.sick) out.push(`Estás enfermo de hambre: llevas ${n.daysHungry} días sin comer.`)
  else if (n.daysHungry) out.push(`Llevas ${n.daysHungry} ${n.daysHungry === 1 ? 'día' : 'días'} sin comer.`)
  out.push(n.broke ? `Solo te quedan ${n.coins} monedas: no te alcanza ni para una ración.` : `Tienes ${n.coins} monedas.`)
  return out
}
