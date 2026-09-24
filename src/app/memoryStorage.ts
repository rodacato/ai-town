import { TownMemory, type MemoryEntry } from '../core/memory/memory'

const key = (world: string) => `ai-town:memory:${world}`

/** The town's memory survives reloads; unreadable or blocked storage just means a fresh start. */
export function loadMemory(world: string) {
  try {
    const saved = JSON.parse(localStorage.getItem(key(world)) ?? 'null') as { entries?: MemoryEntry[] } | null
    return new TownMemory(Array.isArray(saved?.entries) ? saved.entries : [])
  } catch {
    return new TownMemory()
  }
}

export function saveMemory(world: string, memory: TownMemory) {
  try {
    localStorage.setItem(key(world), JSON.stringify({ v: 1, entries: memory.entries }))
  } catch {
    // Nothing to do: the memory still lives for this tab.
  }
}
