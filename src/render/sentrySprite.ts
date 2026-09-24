import { Container, Graphics } from 'pixi.js'
import type { Sentry } from '../core/world/content'
import { iso } from './iso'
import { buildFigure } from './residentSprite'

/** A soldier on watch: stands still, breathes, glances around now and then, and ignores the pointer. */
export class SentrySprite {
  readonly view = new Container()
  private body: Container
  private phase: number

  constructor(readonly sentry: Sentry) {
    const figure = buildFigure(sentry.look, 30)
    this.body = figure.body
    this.phase = (sentry.x * 7 + sentry.y * 13) % 10
    const gear = new Graphics()
    // Spear held upright in the front hand, shield on the back arm.
    gear.moveTo(7, 1).lineTo(7, -36).stroke({ width: 1.4, color: 0x6b4a33, cap: 'round' })
    gear.poly([5.4, -36, 7, -41, 8.6, -36]).fill(0xb9c0c8)
    gear.roundRect(-9.5, -17, 7, 9.5, 3).fill(0x8a3b3b).stroke({ width: 1, color: 0xe3b94f })
    gear.circle(-6, -12.3, 1.2).fill(0xe3b94f)
    this.body.addChild(gear)
    this.body.scale.x = Math.abs(this.body.scale.x) * sentry.facing
    this.view.addChild(figure.shadow, this.body)
    this.view.eventMode = 'none'
    const p = iso(sentry.x + 0.5, sentry.y + 0.5)
    this.view.position.set(p.x, p.y)
    this.view.zIndex = sentry.x + sentry.y + 1
  }

  update(time: number) {
    const t = time + this.phase
    this.body.y = Math.sin(t * 1.6) * 0.3
    // Every so often they look the other way for a moment.
    const glance = Math.sin(t * 0.23) > 0.93 ? -1 : 1
    this.body.scale.x = Math.abs(this.body.scale.x) * this.sentry.facing * glance
  }
}
