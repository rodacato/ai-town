import { Container, Graphics } from 'pixi.js'
import { createRng, hash2 } from '../sim/rng'
import type { World } from '../sim/world'
import { ISLAND_DEPTH, iso, isoFlat } from './iso'
import { PAL } from './palette'

interface Puff {
  g: Graphics
  age: number
  life: number
  x: number
  y: number
  drift: number
}

export class Smoke {
  readonly view = new Container()
  private puffs: Puff[] = []
  private timers: number[]

  constructor(private sources: { x: number; y: number }[]) {
    this.timers = sources.map((_, i) => hash2(i, 1) * 1.5)
  }

  update(dt: number) {
    this.sources.forEach((s, i) => {
      this.timers[i] -= dt
      if (this.timers[i] > 0) return
      this.timers[i] = 0.55 + hash2(i, this.puffs.length) * 0.5
      const g = new Graphics().circle(0, 0, 4).fill(0xffffff)
      this.view.addChild(g)
      this.puffs.push({ g, age: 0, life: 3.4, x: s.x, y: s.y - 2, drift: 6 + hash2(i, this.puffs.length, 3) * 8 })
    })
    this.puffs = this.puffs.filter((p) => {
      p.age += dt
      const t = p.age / p.life
      if (t >= 1) {
        p.g.destroy()
        return false
      }
      p.g.position.set(p.x + p.drift * t + Math.sin(p.age * 2) * 1.5, p.y - 34 * t)
      p.g.scale.set(0.7 + t * 1.6)
      p.g.alpha = (t < 0.15 ? t / 0.15 : 1 - t) * 0.55
      return true
    })
  }
}

export class WaterShimmer {
  readonly view = new Graphics()
  private tiles: { x: number; y: number; seed: number }[] = []
  private falls: { x: number; y: number }[] = []

  constructor(world: World) {
    for (let y = 0; y < world.size; y++)
      for (let x = 0; x < world.size; x++) if (world.tiles[y][x].kind === 'water') this.tiles.push({ x, y, seed: hash2(x, y, 90) })
    const N = world.size
    for (let x = 0; x < N; x++) if (world.tiles[N - 1][x].kind === 'water') this.falls.push({ x, y: N })
  }

  update(time: number) {
    const g = this.view
    g.clear()
    for (const t of this.tiles) {
      for (let k = 0; k < 2; k++) {
        const phase = (time * 0.35 + t.seed + k * 0.5) % 1
        const px = t.x + 0.25 + ((t.seed * 7 + k * 0.37) % 0.5)
        const py = t.y + phase
        const a = Math.sin(phase * Math.PI) * 0.8
        const [x0, y0] = isoFlat(px, py)
        g.moveTo(x0 - 5, y0 - 2.5).lineTo(x0 + 5, y0 + 2.5).stroke({ width: 1.6, color: PAL.waterGlint, alpha: a, cap: 'round' })
      }
    }
    for (const f of this.falls) {
      for (let k = 0; k < 4; k++) {
        const u = f.x + 0.15 + k * 0.23
        const phase = (time * 1.2 + k * 0.29 + f.x * 0.13) % 1
        const [sx, sy] = isoFlat(u, f.y, -phase * ISLAND_DEPTH)
        g.moveTo(sx, sy).lineTo(sx, sy + 6).stroke({ width: 1.5, color: PAL.waterGlint, alpha: 0.8 * (1 - phase), cap: 'round' })
      }
    }
  }
}

export class FountainSpray {
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

export class CloudShadows {
  readonly view = new Container()
  private clouds: { g: Graphics; x: number; y: number; speed: number }[] = []

  constructor(private span: number) {
    const rng = createRng(33)
    for (let i = 0; i < 4; i++) {
      const g = new Graphics()
      const w = rng.range(150, 260)
      for (let k = 0; k < 5; k++) {
        const s = 1 - k * 0.14
        for (let b = 0; b < 3; b++) g.ellipse((b - 1) * w * 0.35, (b % 2) * 10, w * 0.45 * s, w * 0.2 * s).fill({ color: 0x2e3a2a, alpha: 0.012 })
      }
      this.view.addChild(g)
      this.clouds.push({ g, x: rng.range(-span, span), y: rng.range(-60, span * 0.9), speed: rng.range(10, 18) })
    }
  }

  update(dt: number) {
    for (const c of this.clouds) {
      c.x += c.speed * dt
      c.y += c.speed * 0.25 * dt
      if (c.x > this.span * 1.2) {
        c.x = -this.span * 1.2
        c.y = hash2(Math.round(c.y), 3) * this.span * 0.9
      }
      c.g.position.set(c.x, c.y)
    }
  }
}

export class Birds {
  readonly view = new Container()
  private flock: { g: Graphics; ox: number; oy: number; phase: number }[] = []
  private t = -4
  private start = { x: 0, y: 0 }

  constructor(private span: number) {
    for (let i = 0; i < 3; i++) {
      const g = new Graphics()
      g.moveTo(-5, -1).quadraticCurveTo(-2, -3, 0, 0).quadraticCurveTo(2, -3, 5, -1).stroke({ width: 1.6, color: 0x4f4a44, cap: 'round' })
      this.view.addChild(g)
      this.flock.push({ g, ox: -i * 16, oy: i * 9 * (i % 2 ? 1 : -1), phase: i * 1.7 })
    }
    this.view.visible = false
  }

  update(dt: number, time: number) {
    this.t += dt
    if (this.t < 0) return
    if (!this.view.visible) {
      this.view.visible = true
      this.start = { x: -this.span, y: hash2(Math.floor(time), 7) * this.span * 0.6 - 80 }
    }
    const x = this.start.x + this.t * 70
    const y = this.start.y + this.t * 12
    for (const b of this.flock) {
      b.g.position.set(x + b.ox, y + b.oy)
      b.g.scale.y = 0.5 + Math.abs(Math.sin(time * 7 + b.phase)) * 0.7
    }
    if (x > this.span * 1.3) {
      this.view.visible = false
      this.t = -(12 + hash2(Math.floor(time), 2) * 14)
    }
  }
}

export class Butterflies {
  readonly view = new Container()
  private items: { g: Graphics; home: { x: number; y: number }; phase: number }[] = []

  constructor(world: World) {
    const rng = createRng(55)
    const flowers: { x: number; y: number }[] = []
    for (let y = 0; y < world.size; y++)
      for (let x = 0; x < world.size; x++) if (world.tiles[y][x].prop === 'flowers') flowers.push({ x, y })
    const colors = [0xf7d57a, 0xffffff, 0xf2a7a0, 0xc9a7e0]
    for (let i = 0; i < 7 && flowers.length; i++) {
      const f = rng.pick(flowers)
      const g = new Graphics()
      g.ellipse(-2.2, 0, 2.4, 1.7).fill(colors[i % colors.length])
      g.ellipse(2.2, 0, 2.4, 1.7).fill(colors[i % colors.length])
      this.view.addChild(g)
      this.items.push({ g, home: iso(f.x + 0.5, f.y + 0.5), phase: rng.range(0, 10) })
    }
  }

  update(time: number) {
    for (const b of this.items) {
      const t = time * 0.6 + b.phase
      b.g.position.set(b.home.x + Math.sin(t * 1.3) * 22 + Math.sin(t * 3.1) * 5, b.home.y - 16 + Math.cos(t * 0.9) * 10 + Math.sin(t * 4) * 3)
      b.g.scale.x = 0.3 + Math.abs(Math.sin(time * 14 + b.phase)) * 0.7
    }
  }
}
