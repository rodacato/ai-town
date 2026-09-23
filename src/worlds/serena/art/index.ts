import type { WorldArt } from '../../../render/art'
import { drawBuilding } from './buildings'
import { fountainSpray } from './fountain'
import { TERRAIN } from './palette'
import { drawFountain, drawProp } from './props'
import { drawStranger } from './stranger'

export const serenaArt: WorldArt = {
  terrain: TERRAIN,
  building: (b) => {
    const s = drawBuilding(b)
    const flag = s.flag
    return { view: s.view, depth: s.depth, chimneys: s.chimneys, update: flag ? (t) => (flag.scale.x = 0.85 + Math.sin(t * 4) * 0.15) : undefined }
  },
  prop: drawProp,
  landmark: (l) => {
    const f = drawFountain(l.x, l.y, l.size)
    return { view: f.view, depth: f.depth, update: fountainSpray(f.water) }
  },
  stranger: drawStranger,
}
