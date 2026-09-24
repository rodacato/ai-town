import type { TokenUsage } from '../core/decisions/types'
import { firstName } from '../core/lang'
import type { MusingInput } from '../core/realm/musing'
import { parsePetition, petitionPrompt, petitionSystem, type Grievance } from '../core/realm/petitions'
import type { WorldContent } from '../core/world/content'
import { streamChat, type ChatStream } from './llm/client'
import type { Connection } from './llm/config'
import { withCost } from './llm/pricing'

export interface PetitionReply {
  text: string
  usage?: TokenUsage
  ms: number
  /** The model answered but not in the expected shape, so the usual words stood in. */
  fellBack: boolean
}

/** A resident words their petition to the Baroness with a model; if the answer cannot be read, they use their usual words. */
export async function modelPetition(connection: Connection, world: WorldContent, input: MusingInput, g: Grievance, signal: AbortSignal, stream: ChatStream = streamChat): Promise<PetitionReply> {
  const t0 = performance.now()
  let text = ''
  let usage: TokenUsage | undefined
  for await (const e of stream(connection, petitionSystem(world), petitionPrompt(input, g), signal, { tag: firstName(input.resident.name), timeoutMs: 45_000, maxTokens: 600 })) {
    if (e.type === 'delta') text += e.text
    else usage = withCost(connection, e.usage)
  }
  const parsed = parsePetition(text)
  return { text: parsed ?? g.fallback, usage, ms: performance.now() - t0, fellBack: !parsed }
}
