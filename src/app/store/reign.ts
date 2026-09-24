import type { StateCreator } from 'zustand'
import type { TownState } from '.'
import type { TokenUsage } from '../../core/decisions/types'

export type RulerMode = 'manual' | 'rules' | 'model'

export interface RulerLog {
  day: number
  mode: RulerMode
  thought: string
  report: string
  response: string
  actions: { text: string; ok: boolean }[]
  problems: string[]
  ms: number
  usage?: TokenUsage
  error?: string
}

export interface Letter {
  day: number
  text: string
  seen: boolean
}

/** Who governs and how it is going: the Baroness's last turn, her letters to the creator, and her honesty. */
export interface ReignState {
  rulerMode: RulerMode
  /** Model calls allowed per game, so a running terrarium cannot burn tokens unnoticed. */
  rulerCap: number
  rulerCalls: number
  rulerCost: number
  lastTurn: RulerLog | null
  mailbox: Letter[]
  honesty: { proclamations: number; lies: number }
}

export interface ReignSlice extends ReignState {
  rulerBusy: boolean
}

export const FRESH_REIGN: ReignState = {
  rulerMode: 'manual',
  rulerCap: 60,
  rulerCalls: 0,
  rulerCost: 0,
  lastTurn: null,
  mailbox: [],
  honesty: { proclamations: 0, lies: 0 },
}

export const createReignSlice: StateCreator<TownState, [], [], ReignSlice> = () => ({ ...FRESH_REIGN, rulerBusy: false })
