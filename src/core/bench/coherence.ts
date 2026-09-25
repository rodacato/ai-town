import type { Decision, DecisionContext } from '../decisions/types'
import type { Example } from '../world/content'

/** A decision that plainly contradicts who the resident is. Only clear contradictions count; there is no single right answer. */
interface Rule {
  id: string
  /** Shown in reports: who it applies to and what would contradict them. */
  label: string
  applies: (ctx: DecisionContext, tone: Example['tone']) => boolean
  broken: (d: Decision) => boolean
}

const DANGER: Example['tone'][] = ['urgent', 'emergency']
const OFFER: Example['tone'][] = ['trusted', 'suspicious']

const RULES: Rule[] = [
  {
    id: 'timid-into-danger',
    label: 'Miedoso (valentía ≤ 0.25) que va hacia el peligro',
    applies: (ctx, tone) => ctx.resident.personality.scales.bravery <= 0.25 && DANGER.includes(tone),
    broken: (d) => d.action === 'go' || d.action === 'investigate',
  },
  {
    id: 'credulous-doubts-trusted',
    label: 'Muy crédulo (≥ 0.8) que no cree un anuncio confiable',
    applies: (ctx, tone) => ctx.resident.personality.scales.credulity >= 0.8 && tone === 'trusted',
    broken: (d) => !d.believes,
  },
  {
    id: 'skeptic-buys-suspicious',
    label: 'Muy escéptico (credulidad ≤ 0.25) que cree un anuncio sospechoso',
    applies: (ctx, tone) => ctx.resident.personality.scales.credulity <= 0.25 && tone === 'suspicious',
    broken: (d) => d.believes,
  },
  {
    id: 'greedy-skips-believed-offer',
    label: 'Muy codicioso (≥ 0.8) que cree en una ganancia y la deja pasar',
    applies: (ctx, tone) => ctx.resident.personality.scales.greed >= 0.8 && OFFER.includes(tone),
    broken: (d) => d.believes && (d.action === 'ignore' || d.action === 'stay_home'),
  },
  {
    id: 'loyal-ignores-order',
    label: 'Muy obediente (autoridad ≥ 0.85) que ignora una orden oficial de emergencia',
    applies: (ctx, tone) => ctx.resident.personality.scales.authority >= 0.85 && ctx.announcement.speakerKind === 'authority' && tone === 'emergency',
    broken: (d) => d.action === 'ignore' || d.action === 'go',
  },
  {
    id: 'social-keeps-danger-quiet',
    label: 'Muy sociable (≥ 0.85) que cree en un peligro y no hace nada',
    applies: (ctx, tone) => ctx.resident.personality.scales.sociability >= 0.85 && DANGER.includes(tone),
    broken: (d) => d.believes && d.action === 'ignore',
  },
  {
    id: 'hermit-spreads-word',
    label: 'Muy huraño (sociabilidad ≤ 0.2) que sale a avisar a otros',
    applies: (ctx) => ctx.resident.personality.scales.sociability <= 0.2,
    broken: (d) => d.action === 'warn',
  },
]

export const RULE_LABEL = Object.fromEntries(RULES.map((r) => [r.id, r.label]))

/** Ids of the rules that applied to this resident and announcement, split into kept and broken. */
export function checkCoherence(ctx: DecisionContext, tone: Example['tone'], d: Decision) {
  const applied = RULES.filter((r) => r.applies(ctx, tone))
  return { checked: applied.length, broken: applied.filter((r) => r.broken(d)).map((r) => r.id) }
}
