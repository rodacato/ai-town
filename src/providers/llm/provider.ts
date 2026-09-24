import type { DecisionContext, DecisionEvent, DecisionProvider, TokenUsage } from '../../core/decisions/types'
import { streamChat, type ChatStream } from './client'
import { PRESETS, type Connection } from './config'
import { parseDecision, partialStringField } from './parse'
import { withCost } from './pricing'
import { buildPromptParts, buildSystemPrompt } from './prompt'

/** `stream` defaults to the browser's route (local proxy or direct); the CLI passes a plain Node one. */
export function createLlmProvider(connection: Connection, stream: ChatStream = streamChat): DecisionProvider {
  return {
    id: connection.kind,
    label: `${PRESETS[connection.kind].label}${connection.model ? ` · ${connection.model}` : ''}`,
    async *decide(ctx: DecisionContext, signal: AbortSignal): AsyncIterable<DecisionEvent> {
      let text = ''
      let emitted = 0
      let usage: TokenUsage = {}
      const system = buildSystemPrompt(ctx.world)
      const { shared, own } = buildPromptParts(ctx)
      yield { type: 'request', system, prompt: `${shared}\n\n${own}` }
      for await (const event of stream(connection, system, own, signal, { tag: ctx.resident.name, timeoutMs: 110_000, prefix: shared })) {
        if (event.type === 'done') {
          usage = withCost(connection, event.usage)
          continue
        }
        text += event.text
        const reasoning = partialStringField(text, 'reasoning')
        if (reasoning.length > emitted) {
          yield { type: 'reasoning', delta: reasoning.slice(emitted) }
          emitted = reasoning.length
        }
      }
      yield { type: 'response', text, usage }
      yield { type: 'final', decision: parseDecision(text, ctx) }
    },
  }
}
