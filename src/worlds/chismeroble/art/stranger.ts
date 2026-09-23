import { Graphics } from 'pixi.js'
import { C } from './palette'

/** A hooded traveller leaning on a staff. */
export function drawStranger() {
  const g = new Graphics()
  const cloak = 0x3f4a44
  g.ellipse(0, 0, 10, 4).fill({ color: C.shadow, alpha: 0.24 })
  g.moveTo(9, 2).lineTo(11, -40).stroke({ width: 2, color: C.woodDark, cap: 'round' })
  g.circle(11, -41, 2.6).fill(0x9fe3ff)
  g.poly([-9, 0, -6, -22, 6, -22, 9, 0]).fill(cloak)
  g.poly([-6, -22, 0, -6, 6, -22]).fill(0x333c37)
  g.poly([-7, -20, -8, -32, 0, -38, 8, -32, 7, -20]).fill(cloak)
  g.ellipse(1.5, -27, 4, 5).fill(0x1c1f1d)
  g.circle(0, -27.5, 0.9).fill(0xf2e6c9)
  g.circle(3, -27.5, 0.9).fill(0xf2e6c9)
  g.roundRect(-4, -12, 8, 3, 1).fill(C.gold)
  return g
}
