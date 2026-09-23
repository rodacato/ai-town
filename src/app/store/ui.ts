import type { StateCreator } from 'zustand'
import type { TownState } from '.'

export interface Toast {
  id: number
  text: string
}

export interface UiSlice {
  ready: boolean
  hoveredId: string | null
  selectedId: string | null
  interacted: boolean
  resetting: boolean
  settingsOpen: boolean
  toasts: Toast[]
  minutes: number
  outside: number
  toast: (text: string) => void
  setSettingsOpen: (open: boolean) => void
}

let toastId = 0

export const createUiSlice: StateCreator<TownState, [], [], UiSlice> = (set) => ({
  ready: false,
  hoveredId: null,
  selectedId: null,
  interacted: false,
  resetting: false,
  settingsOpen: false,
  toasts: [],
  minutes: 0,
  outside: 0,
  toast: (text) => {
    const id = ++toastId
    set((s) => ({ toasts: [...s.toasts, { id, text }] }))
    window.setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200)
  },
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
})
