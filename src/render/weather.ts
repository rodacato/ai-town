import { Container, Graphics } from 'pixi.js'
import type { Weather } from '../core/sim/weather'

interface Drop {
  x: number
  y: number
  speed: number
  drift: number
}

/** Rain, snow and fog drawn over the whole island, plus lightning for storms. */
export class WeatherFx {
  readonly view = new Container()
  /** Full-screen flash, added above the world by the renderer. */
  readonly flash = new Graphics()
  private streaks = new Graphics()
  private fog: { g: Graphics; x: number; y: number; speed: number }[] = []
  private drops: Drop[] = []
  private weather: Weather = 'clear'
  private nextBolt = 3
  private bolt = 0

  constructor(
    private span: number,
    private depth: number,
  ) {
    this.view.addChild(this.streaks)
    for (let i = 0; i < 9; i++) {
      // Stacked ellipses fade the edges, so the fog has no hard outline.
      const g = new Graphics()
      for (let k = 0; k < 5; k++) g.ellipse(0, 0, 150 + k * 40, 55 + k * 14).fill({ color: 0xf4f1ea, alpha: 0.07 })
      g.visible = false
      this.view.addChild(g)
      this.fog.push({ g, x: (Math.random() - 0.5) * span * 2, y: Math.random() * depth, speed: 6 + Math.random() * 10 })
    }
    this.flash.alpha = 0
    this.flash.eventMode = 'none'
  }

  set(weather: Weather) {
    if (weather === this.weather) return
    this.weather = weather
    const count = weather === 'storm' ? 800 : weather === 'rain' ? 520 : weather === 'snow' ? 700 : 0
    this.drops = Array.from({ length: count }, () => this.spawn(true))
    for (const f of this.fog) f.g.visible = weather === 'fog'
    if (!count) this.streaks.clear()
  }

  private spawn(anywhere: boolean): Drop {
    const snow = this.weather === 'snow'
    return {
      x: (Math.random() - 0.5) * this.span * 2,
      y: anywhere ? Math.random() * this.depth - 200 : -200 - Math.random() * 80,
      speed: snow ? 25 + Math.random() * 25 : 520 + Math.random() * 220,
      drift: snow ? Math.random() * Math.PI * 2 : 0,
    }
  }

  /** `screen` sizes the lightning flash; `calm` freezes motion for reduced-motion users. */
  update(dt: number, time: number, screen: { width: number; height: number }, calm: boolean) {
    const w = this.weather
    if (this.drops.length) {
      const g = this.streaks
      g.clear()
      const snow = w === 'snow'
      for (const d of this.drops) {
        if (!calm) {
          d.y += d.speed * dt
          d.x += snow ? Math.sin(time * 0.8 + d.drift) * 12 * dt : -d.speed * 0.18 * dt
          if (d.y > this.depth) Object.assign(d, this.spawn(false))
        }
        if (snow) g.circle(d.x, d.y, 2.4).fill({ color: 0xffffff, alpha: 0.95 })
        else g.moveTo(d.x, d.y).lineTo(d.x - 4, d.y + 22).stroke({ width: 1.6, color: 0xdde9f2, alpha: 0.7 })
      }
    }
    if (w === 'fog' && !calm)
      for (const f of this.fog) {
        f.x += f.speed * dt
        if (f.x > this.span * 1.2) f.x = -this.span * 1.2
        f.g.position.set(f.x, f.y)
      }
    this.flash.clear().rect(0, 0, screen.width, screen.height).fill(0xffffff)
    if (w !== 'storm' || calm) return void (this.flash.alpha = 0)
    this.nextBolt -= dt
    if (this.nextBolt <= 0) {
      this.bolt = 1
      this.nextBolt = 4 + Math.random() * 6
    }
    // Two quick pulses, like real lightning.
    this.bolt = Math.max(0, this.bolt - dt * 2.5)
    this.flash.alpha = this.bolt > 0.6 ? (this.bolt - 0.6) * 1.2 : this.bolt > 0.3 && this.bolt < 0.45 ? 0.25 : 0
  }
}

/** Colour of the map under each sky, as per-channel [multiply, add] pairs. */
export const WEATHER_GRADE: Record<Weather, [number, number][]> = {
  clear: [
    [1, 0],
    [1, 0],
    [1, 0],
  ],
  rain: [
    [0.82, 0],
    [0.86, 0],
    [0.93, 0],
  ],
  storm: [
    [0.64, 0],
    [0.68, 0],
    [0.8, 0],
  ],
  snow: [
    [0.8, 0.2],
    [0.82, 0.2],
    [0.84, 0.21],
  ],
  fog: [
    [0.72, 0.24],
    [0.74, 0.24],
    [0.76, 0.24],
  ],
}

