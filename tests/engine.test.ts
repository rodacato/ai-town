import { describe, expect, it } from 'vitest'
import { ReactionEngine } from '../src/agents/engine'
import { mockDecision } from '../src/agents/mock'
import { DecisionScheduler } from '../src/agents/scheduler'
import type { DecisionProvider } from '../src/agents/types'
import { EXAMPLES } from '../src/data/announcements'
import { detectPlace } from '../src/sim/announcement'
import { Simulation } from '../src/sim/simulation'

const instant: DecisionProvider = {
  id: 'instant',
  label: 'Instantáneo',
  async *decide(ctx) {
    yield { type: 'reasoning', delta: 'Pensando.' }
    yield { type: 'final', decision: mockDecision(ctx) }
  },
}

async function run(exampleId: string, seconds = 40) {
  const sim = new Simulation()
  const engine = new ReactionEngine(sim, new DecisionScheduler(instant, 16))
  const ex = EXAMPLES.find((e) => e.id === exampleId)!
  let completed = 0
  engine.on((e) => e.type === 'complete' && completed++)
  engine.start({ id: ex.id, text: ex.text, speaker: ex.speaker, place: detectPlace(ex.text), minutes: sim.minutes })
  for (let t = 0; t < seconds; t += 0.05) {
    sim.update(0.05)
    await new Promise((r) => setTimeout(r, 0))
  }
  return { sim, engine, completed }
}

describe('reaction engine', () => {
  it('gets every listener to a decision and reports completion', async () => {
    const { engine, completed } = await run('food')
    const listeners = [...engine.reactions.values()].filter((r) => !r.isSpeaker)
    expect(listeners).toHaveLength(16)
    expect(listeners.every((r) => r.phase === 'decided')).toBe(true)
    expect(listeners.every((r) => r.decidedBy === 'Instantáneo')).toBe(true)
    expect(completed).toBeGreaterThan(0)
  })

  it('excludes a neighbor speaker from the listeners', async () => {
    const { engine } = await run('bridge', 40)
    const speaker = engine.reactions.get('pablo')!
    expect(speaker.isSpeaker).toBe(true)
    expect(engine.settled).toBe(true)
  })

  it('sends residents home when they decide to shelter', async () => {
    const { sim, engine } = await run('storm', 60)
    const sheltering = [...engine.reactions.values()].filter((r) => r.decision?.action === 'stay_home')
    expect(sheltering.length).toBeGreaterThan(0)
    for (const r of sheltering) expect(sim.get(r.id)!.mode).toBe('inside')
  })

  it('clears everything on stop', async () => {
    const { sim, engine } = await run('food', 5)
    engine.stop()
    expect(engine.reactions.size).toBe(0)
    expect(sim.residents.some((r) => r.frozen)).toBe(false)
  })
})
