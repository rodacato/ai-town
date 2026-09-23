import type { WorldContent } from '../core/world/content'
import type { WorldArt } from '../render/art'

/** A complete, swappable world: what it contains and how it looks. */
export interface WorldPack {
  content: WorldContent
  art: WorldArt
}
