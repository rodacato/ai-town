import { chismeroble } from './chismeroble'
import { chismerobleArt } from './chismeroble/art'
import type { WorldPack } from './types'

/** Every world the app can run, the first one by default. */
export const WORLDS: WorldPack[] = [{ content: chismeroble, art: chismerobleArt }]

const KEY = 'ai-town:world'

/** The world picked in this browser, if it still exists; blocked storage or the terminal get the default. */
function pickedWorld(): WorldPack {
  try {
    const id = globalThis.localStorage?.getItem(KEY)
    return WORLDS.find((w) => w.content.id === id) ?? WORLDS[0]
  } catch {
    return WORLDS[0]
  }
}

/** The world the app runs; changing it takes a reload, since every piece reads it once. */
export const activeWorld: WorldPack = pickedWorld()

export function chooseWorld(id: string) {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // Without storage the choice cannot outlive the reload that applies it.
  }
}

/** A world by id, for the terminal's --mundo flag. */
export const worldById = (id: string) => WORLDS.find((w) => w.content.id === id)
