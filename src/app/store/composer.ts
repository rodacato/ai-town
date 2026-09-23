import type { StateCreator } from 'zustand'
import type { TownState } from '.'
import type { Speaker } from '../../core/reactions/announcement'

export const MAX_ANNOUNCEMENT_LENGTH = 200

export interface ComposerSlice {
  draft: { text: string; speaker: Speaker }
  setDraft: (draft: Partial<ComposerSlice['draft']>) => void
}

export const EMPTY_DRAFT: ComposerSlice['draft'] = { text: '', speaker: { kind: 'authority' } }

export const createComposerSlice: StateCreator<TownState, [], [], ComposerSlice> = (set) => ({
  draft: EMPTY_DRAFT,
  setDraft: (patch) =>
    set((s) => ({ draft: { ...s.draft, ...patch, text: (patch.text ?? s.draft.text).slice(0, MAX_ANNOUNCEMENT_LENGTH) } })),
})
