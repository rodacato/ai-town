import { Container, Graphics } from 'pixi.js'
import { hash2 } from '../sim/rng'
import type { PropKind } from '../sim/types'
import { iso, isoFlat, isoPoly } from './iso'
import { PAL, shade } from './palette'

export interface PropSprite {
  view: Container
  depth: number
  sway?: { target: Container; phase: number; amount: number }
}

export function drawProp(kind: PropKind, x: number, y: number): PropSprite | null {
  const h = hash2(x, y, 21)
  const jitter = { x: (hash2(x, y, 22) - 0.5) * 0.3, y: (hash2(x, y, 23) - 0.5) * 0.3 }
  const c = iso(x + 0.5 + jitter.x, y + 0.5 + jitter.y)
  const view = new Container()
  view.position.set(c.x, c.y)
  const depth = x + y + 1
  const g = new Graphics()
  view.addChild(g)

  switch (kind) {
    case 'tree': {
      const scale = 0.85 + h * 0.35
      g.ellipse(0, 0, 15 * scale, 7 * scale).fill({ color: PAL.shadow, alpha: 0.14 })
      g.roundRect(-2.5, -16 * scale, 5, 16 * scale, 2).fill(PAL.trunk)
      const crown = new Container()
      crown.position.set(0, -14 * scale)
      const cg = new Graphics()
      const leaf = PAL.leaf[Math.floor(h * PAL.leaf.length)]
      const r = 13 * scale
      cg.circle(-r * 0.55, -r * 0.55, r * 0.8).fill(shade(leaf, -0.1))
      cg.circle(r * 0.55, -r * 0.5, r * 0.8).fill(shade(leaf, -0.14))
      cg.circle(0, -r * 1.05, r * 0.95).fill(leaf)
      cg.circle(-r * 0.25, -r * 1.3, r * 0.5).fill(shade(leaf, 0.12))
      cg.circle(-r * 0.4, -r * 1.45, r * 0.18).fill({ color: PAL.leafLight, alpha: 0.7 })
      crown.addChild(cg)
      view.addChild(crown)
      return { view, depth, sway: { target: crown, phase: h * 10, amount: 0.035 } }
    }
    case 'pine': {
      const scale = 0.85 + h * 0.4
      const color = PAL.pine[Math.floor(h * PAL.pine.length)]
      g.ellipse(0, 0, 12 * scale, 6 * scale).fill({ color: PAL.shadow, alpha: 0.14 })
      g.rect(-2, -8 * scale, 4, 8 * scale).fill(PAL.trunk)
      const crown = new Container()
      crown.position.set(0, -6 * scale)
      const cg = new Graphics()
      for (let i = 0; i < 3; i++) {
        const w = (13 - i * 3.2) * scale
        const top = -(14 + i * 10) * scale
        const base = -(i * 10) * scale
        cg.poly([-w, base, 0, top - 6 * scale, 0, base + 2]).fill(color)
        cg.poly([0, top - 6 * scale, w, base, 0, base + 2]).fill(shade(color, -0.15))
      }
      crown.addChild(cg)
      view.addChild(crown)
      return { view, depth, sway: { target: crown, phase: h * 10, amount: 0.025 } }
    }
    case 'bush': {
      g.ellipse(0, 0, 11, 5).fill({ color: PAL.shadow, alpha: 0.12 })
      g.circle(-5, -5, 6).fill(shade(PAL.bush, -0.1))
      g.circle(5, -5, 6).fill(shade(PAL.bush, -0.15))
      g.circle(0, -8, 7).fill(PAL.bush)
      if (h > 0.5) for (let i = 0; i < 3; i++) g.circle(-4 + i * 4, -9 + (i % 2) * 3, 1.3).fill(PAL.flowers[i])
      return { view, depth }
    }
    case 'flowers': {
      for (let i = 0; i < 6; i++) {
        const fx = (hash2(x, y, 30 + i) - 0.5) * 26
        const fy = (hash2(x, y, 40 + i) - 0.5) * 12
        g.moveTo(fx, fy).lineTo(fx, fy - 4).stroke({ width: 1, color: PAL.grassTuft })
        g.circle(fx, fy - 5, 2).fill(PAL.flowers[Math.floor(hash2(x, y, 50 + i) * PAL.flowers.length)])
      }
      return { view, depth: depth - 0.5 }
    }
    case 'rock': {
      g.ellipse(0, 0, 9, 4).fill({ color: PAL.shadow, alpha: 0.12 })
      g.poly([-8, 0, -6, -6, 1, -9, 7, -5, 8, 0]).fill(PAL.rock)
      g.poly([1, -9, 7, -5, 8, 0, 2, 0]).fill(PAL.rockShade)
      return { view, depth }
    }
    case 'reeds': {
      for (let i = 0; i < 5; i++) {
        const fx = (hash2(x, y, 60 + i) - 0.5) * 22
        const fy = (hash2(x, y, 70 + i) - 0.5) * 10
        const hh = 8 + hash2(x, y, 80 + i) * 6
        g.moveTo(fx, fy).quadraticCurveTo(fx + 1, fy - hh / 2, fx + 2, fy - hh).stroke({ width: 1.3, color: 0x7f9f68, cap: 'round' })
        if (i % 2 === 0) g.roundRect(fx + 1, fy - hh - 3, 2.2, 4, 1).fill(0x8a6448)
      }
      return { view, depth: depth - 0.5 }
    }
    case 'bench': {
      g.ellipse(0, 1, 14, 5).fill({ color: PAL.shadow, alpha: 0.1 })
      const seat = isoPoly([-0.3, -0.12, 5], [0.3, -0.12, 5], [0.3, 0.12, 5], [-0.3, 0.12, 5])
      g.poly(seat).fill(PAL.wood)
      g.poly(isoPoly([-0.3, 0.12, 5], [0.3, 0.12, 5], [0.3, 0.12, 3], [-0.3, 0.12, 3])).fill(PAL.woodDark)
      g.poly(isoPoly([-0.3, -0.12, 5], [0.3, -0.12, 5], [0.3, -0.12, 12], [-0.3, -0.12, 12])).fill(shade(PAL.wood, 0.08))
      for (const lx of [-0.24, 0.24]) {
        const [px, py] = isoFlat(lx, 0.1, 3)
        g.rect(px - 1, py, 2, 3).fill(PAL.woodDark)
      }
      return { view, depth: depth - 0.2 }
    }
    case 'lamp': {
      g.ellipse(0, 0, 5, 2.5).fill({ color: PAL.shadow, alpha: 0.15 })
      g.rect(-1.2, -30, 2.4, 30).fill(PAL.lamp)
      g.roundRect(-3, -3, 6, 3, 1).fill(PAL.lamp)
      g.roundRect(-4, -38, 8, 9, 2).fill(PAL.lamp)
      g.roundRect(-2.8, -36.5, 5.6, 6, 1.5).fill(PAL.lampGlow)
      g.poly([-5, -38, 0, -42, 5, -38]).fill(PAL.lamp)
      return { view, depth }
    }
    case 'well': {
      g.ellipse(0, 0, 16, 8).fill({ color: PAL.shadow, alpha: 0.12 })
      g.ellipse(0, -6, 13, 6.5).fill(PAL.stoneShade)
      g.rect(-13, -6, 26, 6).fill(PAL.stoneShade)
      g.ellipse(0, 0, 13, 6.5).fill(PAL.stoneShade)
      g.ellipse(0, -6, 13, 6.5).fill(PAL.stone)
      g.ellipse(0, -6, 9, 4.5).fill(0x5a7a8a)
      g.rect(-11, -26, 2, 20).fill(PAL.woodDark)
      g.rect(9, -26, 2, 20).fill(PAL.woodDark)
      g.poly([-15, -24, 0, -34, 15, -24, 13, -22, 0, -31, -13, -22]).fill(0xd98b6a)
      return { view, depth }
    }
    case 'stall': {
      g.ellipse(0, 0, 16, 7).fill({ color: PAL.shadow, alpha: 0.12 })
      g.poly(isoPoly([-0.35, -0.3, 10], [0.35, -0.3, 10], [0.35, 0.3, 10], [-0.35, 0.3, 10])).fill(PAL.wood)
      g.poly(isoPoly([-0.35, 0.3, 10], [0.35, 0.3, 10], [0.35, 0.3, 0], [-0.35, 0.3, 0])).fill(PAL.woodDark)
      g.poly(isoPoly([0.35, 0.3, 10], [0.35, -0.3, 10], [0.35, -0.3, 0], [0.35, 0.3, 0])).fill(shade(PAL.woodDark, -0.1))
      const fruit = [0xe07a5f, 0xe8c170, 0x9cc184, 0xf2a7a0]
      for (let i = 0; i < 6; i++) {
        const [fx, fy] = isoFlat(-0.22 + (i % 3) * 0.22, -0.12 + Math.floor(i / 3) * 0.24, 12)
        g.circle(fx, fy, 2.6).fill(fruit[(i + Math.floor(h * 4)) % fruit.length])
      }
      g.rect(-13, -28, 1.5, 18).fill(PAL.woodDark)
      g.rect(11.5, -28, 1.5, 18).fill(PAL.woodDark)
      g.poly([-17, -26, 0, -34, 17, -26, 0, -18]).fill(h > 0.5 ? 0xe8c170 : 0xd98b6a)
      return { view, depth }
    }
    case 'crop': {
      for (let i = 0; i < 4; i++) {
        const [fx, fy] = isoFlat(-0.35 + i * 0.23, 0, 0)
        g.ellipse(fx, fy - 3, 3.5, 3).fill(i % 2 ? PAL.crop : PAL.cropLight)
        g.ellipse(fx - 1, fy - 5, 2, 1.6).fill({ color: PAL.leafLight, alpha: 0.6 })
      }
      return { view, depth: depth - 0.5 }
    }
    default:
      return null
  }
}

export interface FountainSprite {
  view: Container
  depth: number
  water: Graphics
  center: { x: number; y: number }
}

export function drawFountain(fx: number, fy: number, size: number): FountainSprite {
  const c = iso(fx + size / 2, fy + size / 2)
  const view = new Container()
  view.position.set(c.x, c.y)
  const g = new Graphics()
  const rx = 58
  const ry = 29
  g.ellipse(0, 4, rx + 6, ry + 4).fill({ color: PAL.shadow, alpha: 0.1 })
  g.ellipse(0, 0, rx, ry).fill(PAL.stoneShade)
  g.rect(-rx, -9, rx * 2, 9).fill(PAL.stoneShade)
  g.ellipse(0, -9, rx, ry).fill(PAL.stone)
  g.ellipse(0, -9, rx - 7, ry - 4).fill(PAL.water)
  g.ellipse(0, -7, rx - 12, ry - 8).fill({ color: PAL.waterDeep, alpha: 0.4 })
  g.ellipse(0, -9, 12, 6).fill(PAL.stoneShade)
  g.rect(-5, -32, 10, 23).fill(PAL.stone)
  g.rect(1, -32, 4, 23).fill(PAL.stoneShade)
  g.ellipse(0, -32, 16, 7).fill(PAL.stoneShade)
  g.ellipse(0, -34, 16, 7).fill(PAL.stone)
  g.ellipse(0, -34, 12, 5).fill(PAL.water)
  view.addChild(g)
  const water = new Graphics()
  view.addChild(water)
  return { view, depth: fx + fy + size, water, center: c }
}
