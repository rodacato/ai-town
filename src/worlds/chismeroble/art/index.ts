import type { WorldArt } from '../../../render/art'
import { drawBuilding } from './buildings'
import { drawLandmark } from './landmarks'
import { drawOutcome } from './outcome'
import { TERRAIN } from './palette'
import { drawProp } from './props'
import { drawStranger } from './stranger'

export const chismerobleArt: WorldArt = {
  terrain: TERRAIN,
  building: drawBuilding,
  prop: drawProp,
  landmark: drawLandmark,
  stranger: drawStranger,
  outcome: drawOutcome,
}
