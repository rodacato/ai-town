import type { StateCreator } from 'zustand'
import type { TownState } from '.'
import type { TokenUsage } from '../../core/decisions/types'
import { freshStanding, type Standing } from '../../core/realm/standing'

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
  /** The guild, the mob and how the reign ended; never mutated in place. */
  standing: Standing
  /** The end screen was closed; the town keeps living as a sandbox. */
  endSeen: boolean
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
  standing: freshStanding(),
  endSeen: false,
}

export const createReignSlice: StateCreator<TownState, [], [], ReignSlice> = () => ({ ...FRESH_REIGN, rulerBusy: false })
