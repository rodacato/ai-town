import type { Reaction } from '../../../core/reactions/engine'

export type ThinkingStage = 'queued' | 'sending' | 'streaming'

/** Where a thinking resident is in the round trip: waiting for a slot, waiting for the model, or reading its answer. */
export function thinkingStage(r: Reaction): ThinkingStage {
  if (r.startedAt === null) return 'queued'
  return r.firstTokenAt === null ? 'sending' : 'streaming'
}

/** How many residents were queued before this one and are still waiting. */
export function queuePosition(r: Reaction, all: Reaction[]) {
  return all.filter((o) => o.phase === 'thinking' && o.startedAt === null && (o.queuedAt ?? 0) < (r.queuedAt ?? 0)).length
}

export const STAGE_LABEL: Record<ThinkingStage, string> = {
  queued: 'En cola',
  sending: 'Esperando al modelo',
  streaming: 'Escribiendo',
}
