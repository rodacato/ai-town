import { describe, expect, it } from 'vitest'
import { DecisionScheduler } from '../src/core/decisions/scheduler'
import type { DecisionProvider } from '../src/core/decisions/types'
import { ReactionEngine, type EngineEvent } from '../src/core/reactions/engine'
import type { Outcome } from '../src/core/reactions/outcome'
import { buildPrompt } from '../src/providers/llm/prompt'
import { buildContext } from '../src/core/reactions/context'
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

async function run(ex: Example, seconds = 40, truth?: boolean) {
  const sim = new Simulation(content)
  const engine = new ReactionEngine(sim, new DecisionScheduler(instant, 16))
  let completed = 0
  const outcomes: Outcome[] = []
  engine.on((e: EngineEvent) => {
    if (e.type === 'complete') completed++
    if (e.type === 'outcome') outcomes.push(e.outcome)
  })
  engine.start({ ...announce(sim, ex), truth })
  for (let t = 0; t < seconds; t += 0.05) {
    sim.update(0.05)
    await new Promise((r) => setTimeout(r, 0))
  }
  return { sim, engine, completed, outcomes }
}

describe('reaction engine', () => {
  it('gets every listener to a decision and reports completion', async () => {
    const ex = exampleByTone('trusted')
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
    const { sim, engine } = await run(exampleByTone('emergency'), 60)
    const sheltering = [...engine.reactions.values()].filter((r) => r.decision?.action === 'stay_home')
    expect(sheltering.length).toBeGreaterThan(0)
    for (const r of sheltering) expect(sim.get(r.id)!.mode).toBe('inside')
  })

  it('clears everything on stop', async () => {
    const { sim, engine } = await run(exampleByTone('trusted'), 5)
    engine.stop()
    expect(engine.reactions.size).toBe(0)
    expect(sim.residents.some((r) => r.frozen)).toBe(false)
  })

  it('reveals the truth once everyone has decided, and judges each belief', async () => {
    const { engine, outcomes } = await run(exampleByTone('trusted'), 40, true)
    expect(outcomes).toHaveLength(1)
    expect(outcomes[0]).toMatchObject({ truth: true, visual: 'feast' })
    expect(outcomes[0].summary).toMatch(/^Era verdad/)
    for (const r of engine.reactions.values()) {
      if (r.isSpeaker) continue
      expect(r.verdict, r.id).not.toBeNull()
      expect(r.verdict!.right).toBe(r.decision!.believes)
    }
  })

  it('sends people near a real threat running home', async () => {
    const { sim, engine, outcomes } = await run(exampleByTone('urgent'), 60, true)
    const o = outcomes[0]
    expect(o.visual).toBe('monster')
    const near = sim.residents.filter((r) => Math.hypot(r.x - o.at.x, r.y - o.at.y) < 3 && r.mode !== 'inside')
    expect(near.every((r) => r.tasks.some((t) => t.label === 'Huye despavorido') || r.frozen)).toBe(true)
    expect([...engine.reactions.values()].some((r) => r.verdict)).toBe(true)
  })

  it('marks believers wrong when it was a lie and sends the curious home disappointed', async () => {
    const { sim, engine, outcomes } = await run(exampleByTone('suspicious'), 40, false)
    expect(outcomes[0].summary).toMatch(/^Era mentira/)
    const went = [...engine.reactions.values()].filter((r) => r.decision?.action === 'go' || r.decision?.action === 'investigate')
    for (const r of went) expect(sim.get(r.id)!.tasks.some((t) => t.label.includes('decepcionado')) || sim.get(r.id)!.mode === 'inside').toBe(true)
    const believers = [...engine.reactions.values()].filter((r) => r.decision?.believes)
    for (const r of believers) expect(r.verdict!.right).toBe(false)
  })

  it('reveals nothing when the announcement carries no truth', async () => {
    const { outcomes } = await run(exampleByTone('trusted'), 40)
    expect(outcomes).toEqual([])
  })

  it('never lets the truth reach the model', () => {
    const sim = new Simulation(content)
    const a = { ...announce(sim, exampleByTone('emergency')), truth: false }
    const ctx = buildContext(sim, a, sim.residents[0], [], null)
    expect(JSON.stringify(ctx)).not.toMatch(/truth/)
    expect(buildPrompt(ctx)).not.toMatch(/mentira|truth/i)
  })
})
