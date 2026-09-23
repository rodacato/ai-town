import { Graphics } from 'pixi.js'
import { PAL } from './palette'

export function drawStranger() {
  const g = new Graphics()
  g.ellipse(0, 0, 9, 4).fill({ color: PAL.shadow, alpha: 0.22 })
  g.poly([-8, 0, -6, -20, 6, -20, 8, 0]).fill(0x4d4659)
  g.poly([-6, -20, 0, -8, 6, -20]).fill(0x3d3748)
  g.circle(0, -25, 6.5).fill(0x4d4659)
  g.ellipse(1.5, -24, 3.6, 4).fill(0x2a2530)
  g.circle(2.8, -24.5, 0.8).fill(0xf2e6c9)
  g.ellipse(0, -30.5, 10, 2.6).fill(0x2e2a33)
  g.roundRect(-5, -38, 10, 8, 3).fill(0x2e2a33)
  return g
}
