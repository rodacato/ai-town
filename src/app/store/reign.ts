import type { StateCreator } from 'zustand'
import type { TownState } from '.'
import type { TokenUsage } from '../../core/decisions/types'
import type { DayRecord } from '../../core/realm/reign'
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
  /** Terrarium: the town runs on its own, seasons turn, and fate strikes on a seeded calendar. */
  autoplay: boolean
  /** Picks this game's calendar of fate; the same seed brings the same blows. */
  seed: number
  /** Last day whose blow of fate already struck. */
  fateDone: number
  /** Residents decide with the model too, instead of rules; it spends many more tokens. */
  residentsOnModel: boolean
  /** One row per dawn, for the chronicle's charts. */
  history: DayRecord[]
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
  autoplay: false,
  seed: 1,
  fateDone: -1,
  residentsOnModel: false,
  history: [],
}

export const newSeed = () => 1 + Math.floor(Math.random() * 99_999)

export const createReignSlice: StateCreator<TownState, [], [], ReignSlice> = () => ({ ...FRESH_REIGN, rulerBusy: false })
