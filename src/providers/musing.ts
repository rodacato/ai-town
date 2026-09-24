import type { TokenUsage } from '../core/decisions/types'
import { musingPrompt, musingSystem, parseMusing, rulesMusing, type Musing, type MusingInput } from '../core/realm/musing'
import { streamChat, type ChatStream } from './llm/client'
import type { Connection } from './llm/config'
import { firstName } from '../core/lang'
import { withCost } from './llm/pricing'

export interface MusingReply extends Musing {
  usage?: TokenUsage
  ms: number
  /** The model answered but not in the expected shape, so rules stepped in. */
  fellBack: boolean
}

/** A resident thinking out loud with a model; if the answer cannot be read, rules speak for them. */
export async function modelMusing(connection: Connection, input: MusingInput, signal: AbortSignal, stream: ChatStream = streamChat): Promise<MusingReply> {
  const t0 = performance.now()
  let text = ''
  let usage: TokenUsage | undefined
  for await (const e of stream(connection, musingSystem(input.world.name), musingPrompt(input), signal, { tag: firstName(input.resident.name), timeoutMs: 60_000, maxTokens: 600 })) {
    if (e.type === 'delta') text += e.text
    else usage = withCost(connection, e.usage)
  }
  const parsed = parseMusing(text)
  return { ...(parsed ?? rulesMusing(input)), usage, ms: performance.now() - t0, fellBack: !parsed }
}
