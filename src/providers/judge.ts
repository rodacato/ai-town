import { JUDGE_SYSTEM, type AskJudge } from '../core/bench/judge'
import type { TokenUsage } from '../core/decisions/types'
import { streamChat, type ChatStream } from './llm/client'
import type { Connection } from './llm/config'
import { withCost } from './llm/pricing'

/** A model acting as judge of character: one short request per decision it reads. */
export function createModelJudge(connection: Connection, stream: ChatStream = streamChat): AskJudge {
  return async (prompt, signal) => {
    let text = ''
    let usage: TokenUsage = {}
    for await (const e of stream(connection, JUDGE_SYSTEM, prompt, signal, { tag: 'Juez', timeoutMs: 60_000, maxTokens: 600 })) {
      if (e.type === 'delta') text += e.text
      else usage = withCost(connection, e.usage)
    }
    return { text, costUsd: usage.costUsd, estimated: usage.costSource === 'table' }
  }
}
