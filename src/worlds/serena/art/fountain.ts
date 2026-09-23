import { Graphics } from 'pixi.js'
import { PAL } from './palette'

class FountainSpray {
  private drops = Array.from({ length: 14 }, (_, i) => ({ seed: (i * 0.37) % 1, angle: (i / 14) * Math.PI * 2 }))

  constructor(private g: Graphics) {}

  update(time: number) {
    const g = this.g
    g.clear()
    for (let k = 0; k < 3; k++) {
      const t = (time * 0.45 + k / 3) % 1
      g.ellipse(0, -9, 16 + t * 36, 8 + t * 18).stroke({ width: 1.3, color: PAL.waterGlint, alpha: (1 - t) * 0.6 })
    }
    for (let k = 0; k < 7; k++) {
      const a = Math.PI * (0.1 + k * 0.13)
      const x = Math.cos(a) * 13
      const top = -34 + Math.sin(a) * 5.5
      const phase = (time * 1.6 + k * 0.37) % 1
      g.moveTo(x, top).lineTo(x * 1.08, top + 24).stroke({ width: 1.6, color: PAL.waterGlint, alpha: 0.35 })
      g.circle(x * (1 + phase * 0.08), top + phase * 24, 1.2).fill({ color: 0xffffff, alpha: 0.9 * (1 - phase) })
    }
    for (const d of this.drops) {
      const t = (time * 0.8 + d.seed) % 1
      const r = t * 11
      const x = Math.cos(d.angle) * r
      const y = -48 - 8 * t + 22 * t * t + Math.sin(d.angle) * r * 0.5
      g.circle(x, y, 1.2).fill({ color: 0xffffff, alpha: 0.8 * (1 - t) })
    }
    g.roundRect(-1.5, -50, 3, 16, 1.5).fill({ color: 0xffffff, alpha: 0.7 })
  }
}

export function fountainSpray(g: Graphics) {
  const spray = new FountainSpray(g)
  return (time: number) => spray.update(time)
}
