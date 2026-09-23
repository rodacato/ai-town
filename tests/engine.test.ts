import { describe, expect, it } from 'vitest'
import { DecisionScheduler } from '../src/core/decisions/scheduler'
import type { DecisionProvider } from '../src/core/decisions/types'
import { ReactionEngine, type EngineEvent } from '../src/core/reactions/engine'
import { Simulation } from '../src/core/sim/simulation'
import type { Example } from '../src/core/world/content'
import { mockDecision } from '../src/providers/mock'
import { announce, content, exampleByTone } from './helpers'

const instant: DecisionProvider = {
  id: 'instant',
  label: 'Instantáneo',
  async *decide(ctx) {
    yield { type: 'reasoning', delta: 'Pensando.' }
    yield { type: 'final', decision: mockDecision(ctx, content.vocabulary) }
  },
}

async function run(ex: Example, seconds = 40) {
  const sim = new Simulation(content)
  const engine = new ReactionEngine(sim, new DecisionScheduler(instant, 16))
  let completed = 0
  engine.on((e: EngineEvent) => void (e.type === 'complete' && completed++))
  engine.start(announce(sim, ex))
  for (let t = 0; t < seconds; t += 0.05) {
    sim.update(0.05)
    await new Promise((r) => setTimeout(r, 0))
  }
  return { sim, engine, completed }
}

describe('reaction engine', () => {
  it('gets every listener to a decision and reports completion', async () => {
    const ex = exampleByTone('confiable')
    const { engine, completed } = await run(ex)
    const listeners = [...engine.reactions.values()].filter((r) => !r.isSpeaker)
    expect(listeners.length).toBe(content.residents.length - (ex.speaker.kind === 'neighbor' ? 1 : 0))
    expect(listeners.every((r) => r.phase === 'decided')).toBe(true)
    expect(listeners.every((r) => r.decidedBy === 'Instantáneo')).toBe(true)
    expect(completed).toBeGreaterThan(0)
  })

  it('excludes a neighbor speaker from the listeners', async () => {
    const ex = content.examples.find((e) => e.speaker.kind === 'neighbor')!
    const { engine } = await run(ex)
    expect(engine.reactions.get(ex.speaker.residentId!)!.isSpeaker).toBe(true)
    expect(engine.settled).toBe(true)
  })

  it('sends residents home when they decide to shelter', async () => {
    const { sim, engine } = await run(exampleByTone('emergencia'), 60)
    const sheltering = [...engine.reactions.values()].filter((r) => r.decision?.action === 'stay_home')
    expect(sheltering.length).toBeGreaterThan(0)
    for (const r of sheltering) expect(sim.get(r.id)!.mode).toBe('inside')
  })

  it('clears everything on stop', async () => {
    const { sim, engine } = await run(exampleByTone('confiable'), 5)
    engine.stop()
    expect(engine.reactions.size).toBe(0)
    expect(sim.residents.some((r) => r.frozen)).toBe(false)
  })
})
