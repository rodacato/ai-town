import { serena } from './serena'
import { serenaArt } from './serena/art'
import type { WorldPack } from './types'

/** The world the app runs. To switch worlds, point this at another pack in src/worlds/. */
export const activeWorld: WorldPack = { content: serena, art: serenaArt }
