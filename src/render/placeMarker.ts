import { Container, Graphics } from 'pixi.js'
import { PAL } from './palette'

export class PlaceMarker {
  readonly view = new Container()
  private ring = new Graphics()
  private pin = new Container()
  private shown = 0
  private target = 0
  private t = 0

  constructor() {
    this.ring.ellipse(0, 0, 26, 13).stroke({ width: 2, color: PAL.accent })
    this.ring.ellipse(0, 0, 26, 13).fill({ color: PAL.accent, alpha: 0.12 })
    const shadow = new Graphics().ellipse(0, 0, 7, 3.5).fill({ color: PAL.shadow, alpha: 0.2 })
    const g = new Graphics()
    g.circle(0, -38, 11).fill(PAL.accent)
    g.poly([-9.5, -33, 9.5, -33, 0, -17]).fill(PAL.accent)
    g.circle(0, -38, 4.5).fill(0xffffff)
    this.pin.addChild(g)
    this.view.addChild(this.ring, shadow, this.pin)
    this.view.alpha = 0
    this.view.visible = false
  }

  show(point: { x: number; y: number } | null) {
    if (point) this.view.position.set(point.x, point.y)
    this.target = point ? 1 : 0
  }

  update(dt: number) {
    this.t += dt
    this.shown += (this.target - this.shown) * Math.min(1, dt * 7)
    this.view.visible = this.shown > 0.01
    this.view.alpha = this.shown
    this.pin.y = -Math.abs(Math.sin(this.t * 2.4)) * 6 - (1 - this.shown) * 20
    const pulse = (this.t * 0.7) % 1
    this.ring.scale.set(0.6 + pulse * 0.9)
    this.ring.alpha = 1 - pulse
  }
}
