import { firstName, toPlace } from '../lang'
import type { Resident, Simulation } from './simulation'

const SPECIAL: Record<string, string> = { home: 'casa', visit: 'casa de un vecino' }

export function statusOf(sim: Simulation, r: Resident) {
  const task = r.tasks[0]
  if (task && !(task.kind === 'enterHome' && r.mode === 'inside')) return task.label
  if (r.mode === 'inside') return 'En casa'
  if (r.chatting) return `Charlando con ${firstName(sim.get(r.chatting)?.profile.name ?? '')}`
  if (r.destination === 'street') return r.mode === 'walking' ? 'Dando un paseo' : 'En la calle'
  const where = r.destination ? (SPECIAL[r.destination] ?? sim.world.places.find((p) => p.id === r.destination)?.name) : null
  if (!where) return r.mode === 'walking' ? 'Caminando' : 'Por el pueblo'
  if (r.mode === 'walking') return SPECIAL[r.destination!] ? `Camino a ${where}` : `Camino ${toPlace(where)}`
  return `En ${where}`
}
