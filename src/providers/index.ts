import type { DecisionProvider } from '../core/decisions/types'
import type { WorldContent } from '../core/world/content'
import type { LlmSettings } from './llm/config'
import { createLlmProvider } from './llm/provider'
import { createMockProvider } from './mock'

const MOCK_CONCURRENCY = 6
export const MAX_CONCURRENCY = 32
/** Generous so a busy host that queues requests (like SheLLM under load) is not mistaken for a failure. */
const LLM_TIMEOUT_MS = 120_000

/** Builds the provider the settings ask for, how many residents may think at once and how long each may take. */
export function createProvider(settings: LlmSettings, content: WorldContent): { provider: DecisionProvider; concurrency: number; timeoutMs: number } {
  if (settings.active === 'mock') return { provider: createMockProvider(content.vocabulary), concurrency: MOCK_CONCURRENCY, timeoutMs: 25_000 }
  const c = settings.connections[settings.active]
  return { provider: createLlmProvider(c), concurrency: Math.max(1, Math.min(MAX_CONCURRENCY, c.concurrency)), timeoutMs: LLM_TIMEOUT_MS }
}
