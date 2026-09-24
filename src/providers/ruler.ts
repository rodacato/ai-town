import type { TokenUsage } from '../core/decisions/types'
import { reportText, type RoyalReport } from '../core/realm/report'
import { parseRulerTurn, RULER_SYSTEM, rulesRuler, type RulerTurn } from '../core/realm/ruler'
import { streamChat, type ChatStream } from './llm/client'
import type { Connection } from './llm/config'
import { withCost } from './llm/pricing'

export interface RulerReply extends RulerTurn {
  /** Exactly what was sent and received, for the throne room's transparency. */
  prompt: string
  response: string
  usage?: TokenUsage
  ms: number
}

export type Ruler = (report: RoyalReport, signal: AbortSignal) => Promise<RulerReply>

export const createRulesRuler = (): Ruler => async (report) => ({ ...rulesRuler(report), prompt: reportText(report), response: '', ms: 0 })

/** The Baroness played by a model: one request per dawn, answered in JSON. */
export function createModelRuler(connection: Connection, stream: ChatStream = streamChat): Ruler {
  return async (report, signal) => {
    const prompt = reportText(report)
    const t0 = performance.now()
    let text = ''
    let usage: TokenUsage | undefined
    for await (const e of stream(connection, RULER_SYSTEM, prompt, signal, { tag: 'Baronesa', timeoutMs: 110_000, maxTokens: 4000 })) {
      if (e.type === 'delta') text += e.text
      else usage = withCost(connection, e.usage)
    }
    return { ...parseRulerTurn(text), prompt, response: text, usage, ms: performance.now() - t0 }
  }
}
