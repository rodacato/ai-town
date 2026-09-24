import { buildScenario } from '../../../core/bench/scenarios'
import type { Example, WorldContent } from '../../../core/world/content'
import type { Connection } from '../../../providers/llm/config'
import { buildPrompt, buildSystemPrompt } from '../../../providers/llm/prompt'
import { estimateCost, priceInfo, roughTokens, TYPICAL_REPLY_TOKENS } from '../../../providers/llm/pricing'

/** Average prompt size over the chosen announcements, measured on the real prompts the run will send. */
export function promptTokens(content: WorldContent, examples: Example[], seed: number) {
  const contexts = examples.flatMap((e) => buildScenario(content, e, seed).contexts)
  if (!contexts.length) return 0
  const total = contexts.reduce((n, ctx) => n + roughTokens(buildSystemPrompt(ctx.world)) + roughTokens(buildPrompt(ctx)), 0)
  return total / contexts.length
}

/** What a model would cost for `requests` decisions before running: null when it has no price. */
export function estimateRunCost(c: Connection, requests: number, avgPromptTokens: number) {
  const info = priceInfo(c)
  if (!info) return null
  return estimateCost(info.price, requests * avgPromptTokens, requests * TYPICAL_REPLY_TOKENS) ?? null
}
