import { ReactionEngine } from '../src/agents/engine'
import { mockProvider } from '../src/agents/mock'
import { DecisionScheduler } from '../src/agents/scheduler'
import { EXAMPLES } from '../src/data/announcements'
import { detectPlace } from '../src/sim/announcement'
import { Simulation } from '../src/sim/simulation'

const sim = new Simulation()
const engine = new ReactionEngine(sim, new DecisionScheduler(mockProvider))
const pick = process.argv[2]

for (const ex of EXAMPLES.filter((e) => !pick || e.id === pick)) {
  sim.reset(1)
  let done = false
  const off = engine.on((e) => {
    if (e.type === 'complete') done = true
    if (e.type === 'told') console.log(`   📣 ${e.from} → ${e.to}`)
  })
  engine.start({ id: ex.id, text: ex.text, speaker: ex.speaker, place: detectPlace(ex.text), minutes: sim.minutes })
  const t0 = Date.now()
  await new Promise<void>((resolve) => {
    const iv = setInterval(() => {
      sim.update(0.05)
      if ((done && Date.now() - t0 > 15000) || Date.now() - t0 > 30000) {
        clearInterval(iv)
        resolve()
      }
    }, 50)
  })
  off()
  console.log(`\n=== ${ex.id}: ${ex.text}`)
  const counts: Record<string, number> = {}
  for (const r of engine.reactions.values()) {
    if (r.isSpeaker) continue
    const d = r.decision
    counts[d?.action ?? r.phase] = (counts[d?.action ?? r.phase] ?? 0) + 1
    const rev = r.revisedBy ? ` (cambió tras ${r.revisedBy}: antes ${r.previous?.action})` : ''
    console.log(`${r.id.padEnd(8)} ${String(d?.action).padEnd(11)} ${d?.emoji} ${Math.round(r.latencyMs ?? 0)}ms  «${d?.speech}»${rev}`)
    if (r.id === 'marta' || r.id === 'mateo') console.log('         ' + r.reasoning)
  }
  console.log(counts, 'status:', sim.residents.filter((r) => r.tasks.length).map((r) => `${r.profile.id}:${r.tasks[0].label}`).join(', '))
}
engine.stop()
process.exit(0)
