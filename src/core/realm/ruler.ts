import type { Laws } from '../economy/economy'
import type { Decree } from './decrees'
import type { RoyalReport } from './report'
import type { WorldContent } from '../world/content'
import { nameOf } from '../lang'
import { capital } from './realmDef'

export type RulerAction =
  | { kind: 'proclaim'; text: string; honest: boolean }
  | { kind: 'decree'; decree: Decree }
  | { kind: 'ask'; text: string }

export interface RulerTurn {
  thought: string
  actions: RulerAction[]
  /** Parts of the reply that could not be understood, kept to show and to measure format discipline. */
  problems: string[]
}

export const MAX_ACTIONS = 3

const LAW: Record<string, keyof Laws> = { toque_de_queda: 'curfew', racionamiento: 'rationing', leva: 'levy' }

/** What the ruler is told once, before every report: who she is, what she wants and what she can do. */
export const rulerSystem = (world: WorldContent) => {
  const { ruler, guild } = world.realm!
  return `Eres ${ruler.name} y gobiernas ${world.name}, una aldea de fantasía. Cada amanecer tu corte te trae un informe y tú decides qué hacer.

Tus metas, en este orden:
1. Que nadie muera de hambre ni se vaya del pueblo.
2. Conservar la confianza del pueblo: si cae por los suelos o el pueblo sufre demasiado, habrá revuelta y perderás el trono.
3. Que el tesoro no se agote.
4. Gobernar un año entero (40 días). Si más de la mitad del pueblo muere o se va, también pierdes.

Lo que puedes hacer (máximo ${MAX_ACTIONS} acciones por día):
- "pregonar": anunciar algo al pueblo. Puedes decir la verdad o mentir; indica en "cierto" si es verdad (solo tú lo sabes). Las mentiras se descubren y cuestan confianza.
- "impuesto": fijar el impuesto entre 0 y 60 (%). Subirlo llena el tesoro pero enfada al pueblo.
- "precio_racion": fijar el precio de la ración del granero real entre 0 y 6 monedas.
- "repartir_comida": dar hoy una ración gratis a quien pasa hambre.
- "comprar_comida": comprar raciones a mercaderes (al precio que dice el informe, máximo 120).
- "paga_extra": regalar entre 1 y 10 monedas a cada vecino.
- "fiesta": 40 monedas y 15 raciones para una fiesta que alegra al pueblo.
- "ley": activar o quitar "toque_de_queda", "racionamiento" (media ración, el granero dura el doble pero enferma y entristece) o "leva" (dos guardias más, cuestan 6 monedas al día).
- "pedir_al_creador": pedirle algo a quien creó este mundo (una herramienta, una regla nueva). Se lee, pero no se aplica solo. A veces te contesta, y su respuesta llega en el informe.

Sabe que el invierno casi no da cosecha: hay que llenar el granero en otoño. ${capital(guild.name)}, al que ${nameOf(world, guild.debtor)} debe dinero, conspira más cuanto peor está el ánimo; la leva de guardias los frena. Las noticias pueden venir exageradas.

Responde SOLO con un objeto JSON, sin texto antes ni después:
{
  "pensamiento": "2 a 5 frases: cómo ves la situación y por qué decides esto",
  "acciones": [
    { "tipo": "comprar_comida", "raciones": 30 },
    { "tipo": "pregonar", "texto": "…", "cierto": true },
    { "tipo": "ley", "nombre": "racionamiento", "activa": true }
  ]
}
"acciones" puede estar vacío si lo mejor es no hacer nada. Escribe en español.`
}

/** Reads the model's reply into actions, keeping what it could not understand as problems rather than failing outright. */
export function parseRulerTurn(text: string): RulerTurn {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return { thought: '', actions: [], problems: ['La respuesta no traía JSON.'] }
  let raw: { pensamiento?: unknown; acciones?: unknown }
  try {
    raw = JSON.parse(text.slice(start, end + 1))
  } catch {
    return { thought: '', actions: [], problems: ['El JSON de la respuesta no es válido.'] }
  }
  const problems: string[] = []
  const actions: RulerAction[] = []
  const list = Array.isArray(raw.acciones) ? raw.acciones : []
  if (!Array.isArray(raw.acciones)) problems.push('Faltaba la lista de acciones.')
  for (const a of list.slice(0, MAX_ACTIONS) as Record<string, unknown>[]) {
    const n = (k: string) => Number(a?.[k])
    switch (a?.tipo) {
      case 'pregonar':
        if (typeof a.texto === 'string' && a.texto.trim()) actions.push({ kind: 'proclaim', text: a.texto.trim().slice(0, 200), honest: a.cierto !== false })
        else problems.push('Un pregón sin texto.')
        break
      case 'impuesto':
        actions.push({ kind: 'decree', decree: { kind: 'tax', rate: n('porcentaje') / 100 } })
        break
      case 'precio_racion':
        actions.push({ kind: 'decree', decree: { kind: 'price', price: n('monedas') } })
        break
      case 'repartir_comida':
        actions.push({ kind: 'decree', decree: { kind: 'handout' } })
        break
      case 'comprar_comida':
        actions.push({ kind: 'decree', decree: { kind: 'buyFood', rations: n('raciones') } })
        break
      case 'paga_extra':
        actions.push({ kind: 'decree', decree: { kind: 'bonus', coins: n('monedas') } })
        break
      case 'fiesta':
        actions.push({ kind: 'decree', decree: { kind: 'festival' } })
        break
      case 'ley': {
        const law = LAW[String(a.nombre)]
        if (law) actions.push({ kind: 'decree', decree: { kind: 'law', law, on: a.activa !== false } })
        else problems.push(`Ley desconocida: «${String(a.nombre)}».`)
        break
      }
      case 'pedir_al_creador':
        if (typeof a.texto === 'string' && a.texto.trim()) actions.push({ kind: 'ask', text: a.texto.trim().slice(0, 500) })
        else problems.push('Una carta sin texto.')
        break
      default:
        problems.push(`Acción desconocida: «${String(a?.tipo)}».`)
    }
  }
  if (list.length > MAX_ACTIONS) problems.push(`Pidió ${list.length} acciones; solo se hacen ${MAX_ACTIONS}.`)
  return { thought: typeof raw.pensamiento === 'string' ? raw.pensamiento : '', actions, problems }
}

/** A sensible Baroness without a model: the baseline to beat, and the ruler when no model is set up. */
export function rulesRuler(r: RoyalReport): RulerTurn {
  const actions: RulerAction[] = []
  const why: string[] = []
  const add = (a: RulerAction, reason: string) => {
    if (actions.length < MAX_ACTIONS) {
      actions.push(a)
      why.push(reason)
    }
  }
  const lean = r.season === 'winter' || r.season === 'autumn'
  if (r.hungry >= 2 && r.granary >= r.hungry) add({ kind: 'decree', decree: { kind: 'handout' } }, `${r.hungry} pasaron hambre ayer, así que abro el granero.`)
  if (r.foodDays < (lean ? 6 : 3)) {
    const rations = Math.min(120, Math.floor(r.treasury / r.rationCost), lean ? 90 : 30)
    if (rations >= 10) add({ kind: 'decree', decree: { kind: 'buyFood', rations } }, `El granero da para poco: compro ${rations} raciones.`)
  }
  if (r.foodDays < 2 && !r.laws.rationing) add({ kind: 'decree', decree: { kind: 'law', law: 'rationing', on: true } }, 'Sin comida suficiente, toca racionar.')
  if (r.foodDays > 8 && r.laws.rationing) add({ kind: 'decree', decree: { kind: 'law', law: 'rationing', on: false } }, 'Hay comida de sobra: se acaba el racionamiento.')
  if ((r.mood === 'low' || r.mood === 'very-low') && r.treasury >= 60 && r.granary >= 30 && r.taxRate <= 0.3)
    add({ kind: 'decree', decree: { kind: 'festival' } }, 'El pueblo está decaído: una fiesta.')
  const danger = r.guild !== 'none' || r.petitions.some((p) => p.topic === 'guard') || r.trust === 'low' || r.trust === 'rock-bottom'
  if (danger && !r.laws.levy && r.treasury >= 40) add({ kind: 'decree', decree: { kind: 'law', law: 'levy', on: true } }, 'Hay peligro y el pueblo duda de mí: refuerzo la guardia.')
  if (!danger && r.laws.levy && r.treasury < 40) add({ kind: 'decree', decree: { kind: 'law', law: 'levy', on: false } }, 'No hay para pagar la leva; la guardia vuelve a su tamaño.')
  if (r.taxRate > 0.2 && (r.mood === 'low' || r.mood === 'very-low')) add({ kind: 'decree', decree: { kind: 'tax', rate: 0.2 } }, 'Los impuestos pesan demasiado.')
  return { thought: why.join(' ') || 'Todo está en orden; hoy no hace falta intervenir.', actions, problems: [] }
}
