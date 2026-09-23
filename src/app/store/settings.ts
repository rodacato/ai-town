import type { StateCreator } from 'zustand'
import type { TownState } from '.'
import { loadSettings, type LlmSettings } from '../../providers/llm/config'
import { hasVault } from '../../providers/llm/vault'

export interface SettingsSlice {
  llm: LlmSettings
  /** An encrypted key vault exists in this browser and has not been opened this session. */
  vaultLocked: boolean
}

const loaded = loadSettings()
export const HAD_PLAINTEXT_KEYS = loaded.hadPlaintextKeys

export const createSettingsSlice: StateCreator<TownState, [], [], SettingsSlice> = () => ({
  llm: loaded.settings,
  vaultLocked: hasVault(),
})
