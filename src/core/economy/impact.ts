import type { OutcomeVisual } from '../reactions/outcome'
import { alive, type Economy } from './economy'

/** What a real event does to the purse and the pantry; returns a line for the chronicle, or null if nothing changed. */
export function applyImpact(e: Economy, visual: OutcomeVisual): string | null {
  const everyone = Object.keys(e.needs).filter((id) => alive(e, id))
  const mood = (delta: number) => everyone.forEach((id) => (e.needs[id].mood = Math.min(1, Math.max(0, e.needs[id].mood + delta))))
  const lose = (share: number, what: 'granary' | 'treasury') => {
    const lost = Math.round(e[what] * share)
    e[what] -= lost
    return lost
  }
  switch (visual) {
    case 'flood':
      mood(-0.05)
      return `La crecida echó a perder ${lose(0.3, 'granary')} raciones del granero.`
    case 'blaze':
      mood(-0.05)
      return `El incendio se llevó ${lose(0.15, 'granary')} raciones y ${lose(0.1, 'treasury')} monedas.`
    case 'thief':
      return `El ladrón robó ${lose(e.laws.levy ? 0.1 : 0.25, 'treasury')} monedas del tesoro${e.laws.levy ? ' (la guardia lo espantó a tiempo)' : ''}.`
    case 'meteor':
      mood(-0.05)
      return `El meteorito arrasó ${lose(0.1, 'granary')} raciones del huerto.`
    case 'fire':
      mood(-0.1)
      return `El dragón quemó el coto de caza y ${lose(0.1, 'granary')} raciones.`
    case 'caravan':
      e.granary += 25
      mood(0.05)
      return 'La caravana dejó 25 raciones en el granero.'
    case 'treasure':
      e.treasury += 60
      return 'El tesoro sumó 60 monedas a las arcas.'
    case 'feast':
      for (const id of everyone) e.needs[id].daysHungry = 0
      mood(0.12)
      return 'El festín llenó todas las barrigas.'
    case 'undead':
    case 'ghost':
    case 'wolves':
    case 'monster':
      mood(e.laws.levy ? -0.04 : -0.08)
      return null
    default:
      return null
  }
}
