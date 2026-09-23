import { describe, expect, it } from 'vitest'
import { DecisionScheduler } from '../src/core/decisions/scheduler'
import type { DecisionContext, DecisionProvider } from '../src/core/decisions/types'

/** A provider that holds every request open until released, so tests can count what is in flight. */
function gatedProvider() {
  const gates: (() => void)[] = []
  const provider: DecisionProvider = {
    id: 'gated',
    label: 'Gated',
    async *decide(ctx) {
      yield { type: 'request', system: 's', prompt: ctx.resident.id }
      await new Promise<void>((resolve) => gates.push(resolve))
      yield { type: 'final', decision: { action: 'ignore', believes: true, tell: [], reasoning: 'r', speech: 's', emoji: '🤷', confidence: 0.5 } }
    },
  }
  return { provider, gates }
}

const ctx = (id: string) => ({ resident: { id }, townsfolk: [] }) as unknown as DecisionContext
const tick = () => new Promise((r) => setTimeout(r, 0))

describe('decision scheduler', () => {
  it('never runs more than the concurrency limit', async () => {
    const { provider } = gatedProvider()
    const scheduler = new DecisionScheduler(provider, 2)
    let started = 0
    for (let i = 0; i < 6; i++) scheduler.enqueue({ ctx: ctx(`r${i}`), onStart: () => started++, onReasoning: () => {}, onDecision: () => {}, onError: () => {} })
    await tick()
    expect(started).toBe(2)
  })

  it('starts queued decisions right away when the limit is raised', async () => {
    const { provider } = gatedProvider()
    const scheduler = new DecisionScheduler(provider, 2)
    let started = 0
    for (let i = 0; i < 6; i++) scheduler.enqueue({ ctx: ctx(`r${i}`), onStart: () => started++, onReasoning: () => {}, onDecision: () => {}, onError: () => {} })
    await tick()
    scheduler.setConcurrency(5)
    await tick()
    expect(started).toBe(5)
  })

  it('reports the request and frees the slot when a decision lands', async () => {
    const { provider, gates } = gatedProvider()
    const scheduler = new DecisionScheduler(provider, 1)
    const requests: string[] = []
    let decided = 0
    for (let i = 0; i < 2; i++)
      scheduler.enqueue({ ctx: ctx(`r${i}`), onStart: () => {}, onRequest: (_, p) => requests.push(p), onReasoning: () => {}, onDecision: () => decided++, onError: () => {} })
    await tick()
    expect(requests).toEqual(['r0'])
    gates.shift()!()
    await tick()
    await tick()
    expect(decided).toBe(1)
    expect(requests).toEqual(['r0', 'r1'])
  })
})
