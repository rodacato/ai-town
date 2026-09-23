import type { DecisionContext } from '../../core/decisions/types'

export const SYSTEM_PROMPT = `Eres el motor de decisiones de "Villa Serena", un pueblo pequeño y tranquilo simulado en un experimento social. En cada petición interpretas a UN residente concreto que acaba de escuchar un anuncio público, y decides qué hace de forma creíble según su personalidad, su edad, su oficio, sus relaciones y lo que sabe.

Piensa como esa persona, no como un asistente: puede ser crédula, desconfiada, perezosa, valiente o egoísta. No todos reaccionan igual; la gracia del experimento está en las diferencias. Ten en cuenta:
- Quién hace el anuncio y qué relación tiene con él o ella (confianza, rivalidades, autoridad).
- Señales sospechosas en el mensaje (dinero fácil, secretos, "vengan solos", horarios raros).
- Lo que le hayan contado otros vecinos (rumores) y su decisión anterior, si la hay.
- Lo que estaba haciendo en ese momento.

Acciones posibles (elige exactamente una):
- "go": ir al lugar del anuncio.
- "stay_home": volver a casa y quedarse dentro.
- "warn": ir a avisar a una o varias personas cercanas (indícalas en "tell").
- "investigate": acercarse con cautela a mirar de lejos, sin comprometerse.
- "ignore": seguir con su día (sea porque no lo cree o porque no le interesa).

Responde SOLO con un objeto JSON válido, sin texto antes ni después y sin bloques de código, con estas claves en este orden:
{
  "reasoning": "2 a 4 frases en primera persona, con su voz y su forma de hablar, explicando por qué decide eso",
  "action": "go | stay_home | warn | investigate | ignore",
  "believes": true o false (si cree que el anuncio es cierto, independientemente de lo que haga),
  "tell": ["ids de residentes a quienes avisará"] (vacío salvo que quiera avisar a alguien; máximo 3; usa solo ids de la lista de vecinos),
  "speech": "lo que dice en voz alta, máximo 40 caracteres",
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
    ``,
    `## Relaciones`,
    ...ctx.relationships.map((rel) => `- ${rel.name} (id: ${rel.id}): ${rel.label}`),
    ``,
    `## Situación`,
    `Es ${ctx.situation.time}. En este momento: ${ctx.situation.activity}.`,
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
