import { DecisionScheduler } from '../src/core/decisions/scheduler'
import { detectPlace } from '../src/core/reactions/announcement'
import { ReactionEngine } from '../src/core/reactions/engine'
import { Simulation } from '../src/core/sim/simulation'
import { createMockProvider } from '../src/providers/mock'
import { activeWorld } from '../src/worlds'

// Runs the active world's examples through the engine with the mock provider: `npx tsx scripts/reaction-smoke.ts [exampleId]`.
const content = activeWorld.content
const sim = new Simulation(content)
const engine = new ReactionEngine(sim, new DecisionScheduler(createMockProvider(content.vocabulary)))
const pick = process.argv[2]

for (const ex of content.examples.filter((e) => !pick || e.id === pick)) {
  sim.reset(1)
  let done = false
  const off = engine.on((e) => {
    if (e.type === 'complete') done = true
    if (e.type === 'told') console.log(`   📣 ${e.from} → ${e.to}`)
  })
  engine.start({ id: ex.id, text: ex.text, speaker: ex.speaker, place: detectPlace(ex.text, sim.world.places, content.homeKeywords), minutes: sim.minutes })
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
  }
  console.log(counts)
}
engine.stop()
process.exit(0)
