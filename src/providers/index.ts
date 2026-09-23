import type { DecisionProvider } from '../core/decisions/types'
import type { WorldContent } from '../core/world/content'
import type { LlmSettings } from './llm/config'
import { createLlmProvider } from './llm/provider'
import { createMockProvider } from './mock'

const MOCK_CONCURRENCY = 6

/** Builds the provider the settings ask for, and how many residents may think at once with it. */
export function createProvider(settings: LlmSettings, content: WorldContent): { provider: DecisionProvider; concurrency: number } {
  if (settings.active === 'mock') return { provider: createMockProvider(content.vocabulary), concurrency: MOCK_CONCURRENCY }
  const c = settings.connections[settings.active]
  return { provider: createLlmProvider(c), concurrency: Math.max(1, Math.min(8, c.concurrency)) }
}
