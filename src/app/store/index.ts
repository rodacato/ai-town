import { create } from 'zustand'
import { createComposerSlice, type ComposerSlice } from './composer'
import { createExperimentSlice, type ExperimentSlice } from './experiment'
import { createGodSlice, type GodSlice } from './god'
import { createReignSlice, type ReignSlice } from './reign'
import { createSettingsSlice, type SettingsSlice } from './settings'
import { createUiSlice, type UiSlice } from './ui'

export type TownState = UiSlice & ComposerSlice & ExperimentSlice & SettingsSlice & GodSlice & ReignSlice

/** Plain UI state. Anything that touches the simulation or the map goes through `town` in ../town.ts. */
export const useTown = create<TownState>()((...a) => ({
  ...createUiSlice(...a),
  ...createComposerSlice(...a),
  ...createExperimentSlice(...a),
  ...createSettingsSlice(...a),
  ...createGodSlice(...a),
  ...createReignSlice(...a),
}))
