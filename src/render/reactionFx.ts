import { Container, Graphics } from 'pixi.js'
import type { ReactionEngine } from '../core/reactions/engine'
import { iso } from './iso'
import { PAL } from './palette'

const TILE_RX = 32 * Math.SQRT2
const TILE_RY = 16 * Math.SQRT2

/** Expanding rings on the ground that show how far the announcement has travelled. */
export class WaveFx {
  readonly view = new Graphics()
  private fade = 0

  constructor(private engine: ReactionEngine) {}

  update(dt: number) {
    const e = this.engine
    const g = this.view
    g.clear()
    const target = e.waveActive ? 1 : 0
    this.fade += (target - this.fade) * Math.min(1, dt * (target ? 8 : 1.5))
    if (!e.announcement || this.fade < 0.01) return
    const c = iso(e.origin.x, e.origin.y)
    const max = e.waveMax + 4
    for (let k = 0; k < 4; k++) {
      const r = e.waveRadius - k * 2.6
      if (r <= 0.2) continue
      const life = 1 - Math.min(1, r / max)
      const alpha = this.fade * life * (1 - k * 0.22)
      g.ellipse(c.x, c.y, r * TILE_RX, r * TILE_RY).stroke({ width: k === 0 ? 5 : 3, color: PAL.accent, alpha: alpha * 0.9 })
      if (k === 0) g.ellipse(c.x, c.y, r * TILE_RX, r * TILE_RY).fill({ color: PAL.accent, alpha: alpha * 0.08 })
    }
  }
}

/** Megaphone above the mayor's balcony or the stranger, visible while the news spreads. */
export class OriginBeacon {
  readonly view = new Container()
  private stranger: Container
  private bubble = new Graphics()
  private shown = 0
  private t = 0

  constructor(
    private engine: ReactionEngine,
    stranger: Container,
  ) {
    this.stranger = stranger
    this.bubble.circle(0, 0, 15).fill(0xf6e7c4).stroke({ width: 2.5, color: 0xffffff })
    this.bubble.poly([-4, 12, 4, 12, 0, 19]).fill(0xf6e7c4)
    const icon = new Graphics()
    icon.poly([-7, -3, -2, -3, 5, -8, 5, 8, -2, 3, -7, 3]).fill(0xb07a24)
    icon.moveTo(8, -4).quadraticCurveTo(11, 0, 8, 4).stroke({ width: 1.8, color: 0xb07a24, cap: 'round' })
    this.bubble.addChild(icon)
    this.view.addChild(this.stranger, this.bubble)
    this.view.visible = false
  }

  update(dt: number) {
    const e = this.engine
    const a = e.announcement
    // A neighbour speaks from their own sprite and a sighting has no speaker, so neither gets the megaphone.
    const noBeacon = a?.speaker.kind === 'neighbor' || a?.speaker.kind === 'sight'
    const target = a && !noBeacon && e.waveActive ? 1 : 0
    this.shown += (target - this.shown) * Math.min(1, dt * (target ? 6 : 1.2))
    this.view.visible = this.shown > 0.01
    if (!this.view.visible || !a) return
    this.t += dt
    const c = iso(e.origin.x, e.origin.y)
    const isStranger = a.speaker.kind === 'stranger'
    this.view.position.set(c.x, c.y)
    this.view.zIndex = c.y
    this.view.alpha = this.shown
    this.stranger.visible = isStranger
    this.bubble.position.set(isStranger ? 14 : 0, (isStranger ? -52 : -78) + Math.sin(this.t * 5) * 2)
    this.bubble.scale.set(1 + Math.max(0, Math.sin(this.t * 7)) * 0.08)
  }
}
