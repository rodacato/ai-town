import type { StateCreator } from 'zustand'
import type { TownState } from '.'
import { loadSettings, type LlmSettings } from '../../providers/llm/config'

export interface SettingsSlice {
  llm: LlmSettings
}

export const createSettingsSlice: StateCreator<TownState, [], [], SettingsSlice> = () => ({
  llm: loadSettings(),
})
