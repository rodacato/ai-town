import { Simulation } from '../src/sim/simulation'

const sim = new Simulation()
const t0 = performance.now()
for (let i = 0; i < 60 * 180; i++) sim.update(1 / 60)
const counts: Record<string, number> = {}
for (const r of sim.residents) counts[r.mode] = (counts[r.mode] ?? 0) + 1
console.log('3 min sim in', Math.round(performance.now() - t0), 'ms', counts)
for (const r of sim.residents) console.log(r.profile.id.padEnd(8), r.mode.padEnd(8), r.destination, r.x.toFixed(1), r.y.toFixed(1), r.chatting ?? '')
