import { parseArgs } from 'node:util'
import { DecisionScheduler } from '../src/core/decisions/scheduler'
import { TownMemory } from '../src/core/memory/memory'
import { detectPlace } from '../src/core/reactions/announcement'
import { ReactionEngine } from '../src/core/reactions/engine'
import { Simulation } from '../src/core/sim/simulation'
import { createRulesProvider } from '../src/providers/mock'
import { activeWorld, WORLDS, worldById } from '../src/worlds'

const HELP = `Cuánto cuesta simular el pueblo, sin navegador: días enteros a la velocidad que digas, con un pregón cada medio día.

Uso: npm run perf -- [opciones]

      --world <id>        Mundo: ${WORLDS.map((w) => w.content.id).join(', ')} (por defecto el primero).
      --days <n>          Días de juego que simular (por defecto 3).
      --speed <n>         Multiplicador del reloj, como los botones ×1 a ×16 (por defecto 16).

Mide solo la lógica (simulación, reacciones y reglas); el dibujo se mide en el navegador con ?perf.`

const { values: args } = parseArgs({
  options: {
    world: { type: 'string' },
    days: { type: 'string', default: '3' },
    speed: { type: 'string', default: '16' },
    help: { type: 'boolean', short: 'h', default: false },
  },
})
if (args.help) {
  console.log(HELP)
  process.exit(0)
}
const fail = (msg: string): never => {
  console.error(`✗ ${msg}`)
  process.exit(1)
}
const world = args.world ? (worldById(args.world) ?? fail(`No hay un mundo «${args.world}».`)) : activeWorld
const days = Number(args.days)
const speed = Number(args.speed)
if (!(days > 0 && days <= 40)) fail('--days va de 1 a 40.')
if (!(speed >= 1 && speed <= 64)) fail('--speed va de 1 a 64.')

const content = world.content
const sim = new Simulation(content)
const engine = new ReactionEngine(sim, new DecisionScheduler(createRulesProvider(content.vocabulary), 16, 5000))
engine.memory = new TownMemory()

const FRAME = 1 / 60
const frames: number[] = []
const endAt = sim.minutes + days * 1440
let nextAnnouncement = sim.minutes + 60
let announced = 0
let decisions = 0
const decided = () => [...engine.reactions.values()].filter((r) => r.decision).length
const t0 = performance.now()
while (sim.minutes < endAt) {
  if (sim.minutes >= nextAnnouncement) {
    decisions += decided()
    const ex = content.examples[announced % content.examples.length]
    engine.start({ id: `perf-${announced}`, text: ex.text, speaker: ex.speaker, place: detectPlace(ex.text, sim.world.places, content.homeKeywords), minutes: Math.floor(sim.minutes), truth: ex.truth ?? true })
    announced++
    nextAnnouncement += 720
  }
  const f0 = performance.now()
  sim.update(FRAME * speed)
  frames.push(performance.now() - f0)
  // Decisions arrive as promises, like a real provider's; let them land between frames.
  if (frames.length % 4 === 0) await new Promise((r) => setImmediate(r))
}
const wall = performance.now() - t0
decisions += decided()

const sorted = [...frames].sort((a, b) => a - b)
const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
const ms = (v: number) => `${v.toFixed(3)} ms`
const alive = sim.residents.filter((r) => r.mode !== 'gone').length
console.log(`${content.name} · ${days} ${days === 1 ? 'día' : 'días'} a ×${speed} · ${announced} pregones, ${decisions} decisiones · ${frames.length} cuadros de 1/60 s`)
console.log(`  Lógica por cuadro: p50 ${ms(q(0.5))} · p95 ${ms(q(0.95))} · p99 ${ms(q(0.99))} · máx ${ms(sorted.at(-1) ?? 0)}`)
console.log(`  Cuadros por encima de 4 ms: ${frames.filter((f) => f > 4).length}`)
console.log(`  Tiempo real: ${(wall / 1000).toFixed(1)} s (a 60 cuadros/s el juego tardaría ${(frames.length / 60).toFixed(0)} s) · vecinos en el pueblo al final: ${alive}`)
