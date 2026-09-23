import { chismeroble } from './chismeroble'
import { chismerobleArt } from './chismeroble/art'
import type { WorldPack } from './types'

/** The world the app runs. To switch worlds, point this at another pack in src/worlds/. */
export const activeWorld: WorldPack = { content: chismeroble, art: chismerobleArt }
