import type { DecisionContext, DecisionEvent, DecisionProvider } from '../types'
import { PRESETS, type Connection } from './config'
import { parseDecision, partialStringField } from './parse'
import { SYSTEM_PROMPT, buildPrompt } from './prompt'

type ProxyEvent = { delta?: string; done?: boolean; error?: string }

/** Streams a completion through the local proxy, yielding each text delta. */
export async function* streamChat(connection: Connection, system: string, prompt: string, signal: AbortSignal, maxTokens?: number) {
  const response = await fetch('/api/llm/chat', {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ connection, system, prompt, maxTokens }),
  })
  if (!response.ok || !response.body) throw new Error(`El servidor local respondió ${response.status}.`)
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return
    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''
    for (const e of events) {
      if (!e.startsWith('data: ')) continue
      const data = JSON.parse(e.slice(6)) as ProxyEvent
      if (data.error) throw new Error(data.error)
      if (data.delta) yield data.delta
      if (data.done) return
    }
  }
}

export function createLlmProvider(connection: Connection): DecisionProvider {
  return {
    id: connection.kind,
    label: `${PRESETS[connection.kind].label}${connection.model ? ` · ${connection.model}` : ''}`,
    async *decide(ctx: DecisionContext, signal: AbortSignal): AsyncIterable<DecisionEvent> {
      let text = ''
      let emitted = 0
      for await (const delta of streamChat(connection, SYSTEM_PROMPT, buildPrompt(ctx), signal)) {
        text += delta
        const reasoning = partialStringField(text, 'reasoning')
        if (reasoning.length > emitted) {
          yield { type: 'reasoning', delta: reasoning.slice(emitted) }
          emitted = reasoning.length
        }
      }
      yield { type: 'final', decision: parseDecision(text, ctx) }
    },
  }
}
