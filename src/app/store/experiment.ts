import type { StateCreator } from 'zustand'
import type { TownState } from '.'
import type { Announcement } from '../../core/reactions/announcement'
import type { LogEntry, Reaction } from '../../core/reactions/engine'

export interface ExperimentSlice {
  announcement: Announcement | null
  /** Snapshot of every reaction; refreshed on phase changes, not on each streamed word. */
  reactions: Record<string, Reaction>
  /** Streamed reasoning, refreshed a few times per second while residents think. */
  reasoning: Record<string, string>
  complete: boolean
  /** Chronological trace of requests and decisions, for transparency. */
  log: LogEntry[]
  startedAt: number
}

export const createExperimentSlice: StateCreator<TownState, [], [], ExperimentSlice> = () => ({
  announcement: null,
  reactions: {},
  reasoning: {},
  complete: false,
  log: [],
  startedAt: 0,
})
