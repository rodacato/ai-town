import type { DecisionContext } from '../../core/decisions/types'
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

export function buildPrompt(ctx: DecisionContext) {
  const r = ctx.resident
  const a = ctx.announcement
  const lines = [
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
    ``,
    `## Situación`,
    `Es ${ctx.situation.time}. ${ctx.situation.season} ${ctx.situation.weather} En este momento: ${ctx.situation.activity}.`,
    ``,
    `## Anuncio`,
    `Lo dice: ${a.speakerName}${a.relationToSpeaker ? ` (para ti: ${a.relationToSpeaker})` : ''}.`,
    `Mensaje: «${a.text}»`,
    a.placeLabel ? `Lugar mencionado: ${a.placeLabel}.` : 'No menciona un lugar concreto.',
  ]
  if (ctx.rumors.length) {
    lines.push('', '## Lo que te han contado después')
    for (const rumor of ctx.rumors) lines.push(`- ${rumor.fromName}${rumor.relation ? ` (${rumor.relation})` : ''} vino a decirte: «${rumor.message}»`)
  }
  if (ctx.previous) {
    lines.push('', '## Tu decisión anterior', `Habías decidido "${ctx.previous.action}" y dijiste: «${ctx.previous.speech}». Puedes mantenerla o cambiarla.`)
  }
  lines.push('', '## Vecinos del pueblo (ids válidos para "tell")', ctx.townsfolk.map((p) => `${p.id} (${p.name})`).join(', '))
  return lines.join('\n')
}
