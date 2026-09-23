import { RESIDENTS, type RoutineSpot } from '../../worlds/serena/residents'
import type { Resident } from './simulation'

const DESTINATION: Record<RoutineSpot, string> = {
  plaza: 'la plaza',
  fountain: 'la fuente',
  benches: 'un banco',
  cafe: 'el café',
  bakery: 'la panadería',
  shop: 'la tienda',
  townhall: 'el ayuntamiento',
  park: 'el parque',
  riverbank: 'la orilla del río',
  forest: 'el bosque',
  field: 'el huerto',
  bridge: 'el puente',
  street: 'la calle',
  home: 'casa',
  visit: 'casa de un vecino',
}

export function statusOf(r: Resident) {
  const task = r.tasks[0]
  if (task && !(task.kind === 'enterHome' && r.mode === 'inside')) return task.label
  if (r.mode === 'inside') return 'En casa'
  if (r.chatting) return `Charlando con ${RESIDENTS.find((p) => p.id === r.chatting)?.name.split(' ')[0]}`
  const where = r.destination ? DESTINATION[r.destination] : 'el pueblo'
  if (r.mode === 'walking') return r.destination === 'street' ? 'Dando un paseo' : `Camino a ${where}`
  return r.destination === 'street' ? 'En la calle' : `En ${where}`
}
