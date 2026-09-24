import type { StateCreator } from 'zustand'
import type { TownState } from '.'
import { loadSettings, type LlmSettings } from '../../providers/llm/config'
import { hasVault } from '../../providers/llm/vault'

export interface SettingsSlice {
  llm: LlmSettings
  /** An encrypted key vault exists in this browser and has not been opened this session. */
  vaultLocked: boolean
  /** The vault was created or opened in this tab, so key changes are sealed again on save. */
  vaultOpen: boolean
  /** Providers whose key the dev server has in its .env. */
  envKeys: string[]
  /** The dev server has been asked about its keys, so a missing key can be told apart from one still loading. */
  keysChecked: boolean
  /** The arrival prompt about keys was closed for this visit. */
  keyGateDismissed: boolean
}

const loaded = loadSettings()
export const HAD_PLAINTEXT_KEYS = loaded.hadPlaintextKeys

export const createSettingsSlice: StateCreator<TownState, [], [], SettingsSlice> = () => ({
  llm: loaded.settings,
  vaultLocked: hasVault(),
  vaultOpen: false,
  envKeys: [],
  keysChecked: false,
  keyGateDismissed: false,
})
