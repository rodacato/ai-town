import { describe, expect, it } from 'vitest'
import { buildScenario } from '../src/core/bench/scenarios'
import type { DecisionEvent } from '../src/core/decisions/types'
import { createProvider, MAX_CONCURRENCY } from '../src/providers'
import type { ChatStream } from '../src/providers/llm/client'
import { DEFAULT_SETTINGS, type Connection } from '../src/providers/llm/config'
import { partialStringField } from '../src/providers/llm/parse'
import { priceFor } from '../src/providers/llm/pricing'
import { createLlmProvider } from '../src/providers/llm/provider'
import { content } from './helpers'

const ctx = buildScenario(content, content.examples[0], 7).contexts[0]
const reply = { reasoning: 'Tengo hambre y es gratis.', action: 'go', believes: true, tell: [], speech: '¡Voy!', emoji: '🍖', confidence: 0.8 }

/** A model that answers `text` in small pieces, then reports `usage`. */
const fakeStream = (text: string, usage = {}): ChatStream =>
  async function* () {
    for (let i = 0; i < text.length; i += 7) yield { type: 'delta', text: text.slice(i, i + 7) }
    yield { type: 'done', usage }
  }

async function collect(connection: Connection, stream: ChatStream) {
  const events: DecisionEvent[] = []
  for await (const e of createLlmProvider(connection, stream).decide(ctx, new AbortController().signal)) events.push(e)
  return events
}

const shellm = { ...DEFAULT_SETTINGS.connections.shellm, model: 'claude' }

describe('LLM provider', () => {
  it('sends the prompt, streams the reasoning as it arrives and ends with the decision', async () => {
    const events = await collect(shellm, fakeStream(JSON.stringify(reply)))
    expect(events[0]).toMatchObject({ type: 'request' })
    const reasoning = events.filter((e) => e.type === 'reasoning').map((e) => (e as { delta: string }).delta)
    expect(reasoning.length).toBeGreaterThan(1)
    expect(reasoning.join('')).toBe(reply.reasoning)
    expect(events.at(-1)).toMatchObject({ type: 'final', decision: { action: 'go', believes: true, speech: '¡Voy!' } })
  })

  it('keeps the cost the host reports', async () => {
    const events = await collect(shellm, fakeStream(JSON.stringify(reply), { inputTokens: 1000, outputTokens: 100, costUsd: 0.01 }))
    expect(events.find((e) => e.type === 'response')).toMatchObject({ usage: { costUsd: 0.01, costSource: 'host' } })
  })

  it('estimates the cost from the price table when the host does not report one', async () => {
    const priced = { ...shellm, priceIn: 3, priceOut: 15 }
    const events = await collect(priced, fakeStream(JSON.stringify(reply), { inputTokens: 1_000_000, outputTokens: 100_000 }))
    expect(events.find((e) => e.type === 'response')).toMatchObject({ usage: { costUsd: 4.5, costSource: 'table' } })
  })

  it('fails loudly when the model answers without JSON', async () => {
    await expect(collect(shellm, fakeStream('No sé qué hacer'))).rejects.toThrow('no devolvió JSON')
  })
})

describe('pricing', () => {
  it('prefers the price typed in settings over the list price', () => {
    const anthropic = { ...DEFAULT_SETTINGS.connections.anthropic, model: 'claude-haiku-4-5' }
    expect(priceFor(anthropic)).toEqual({ input: 1, output: 5 })
    expect(priceFor({ ...anthropic, priceIn: 2, priceOut: 8 })).toEqual({ input: 2, output: 8 })
    expect(priceFor(shellm)).toBeNull()
  })
})

describe('provider factory', () => {
  it('builds the rules mode or the configured model, capping concurrency', () => {
    expect(createProvider(DEFAULT_SETTINGS, content).provider.id).toBe('mock')
    const greedy = { ...DEFAULT_SETTINGS, active: 'shellm' as const, connections: { ...DEFAULT_SETTINGS.connections, shellm: { ...shellm, concurrency: 999 } } }
    const built = createProvider(greedy, content)
    expect(built.provider.label).toBe('SheLLM · claude')
    expect(built.concurrency).toBe(MAX_CONCURRENCY)
  })
})

describe('partial JSON reading', () => {
  it('decodes escapes and stops cleanly at a cut', () => {
    expect(partialStringField('{"reasoning": "a\\u00f1o \\n y', 'reasoning')).toBe('año \n y')
    expect(partialStringField('{"reasoning": "corte \\u00', 'reasoning')).toBe('corte ')
    expect(partialStringField('{"action": "go"}', 'reasoning')).toBe('')
  })
})
