import { Container, Graphics } from 'pixi.js'
import { hash2 } from '../../../core/world/rng'
import type { PropSprite } from '../../../render/art'
import { iso, isoFlat, isoPoly } from '../../../render/iso'
import { shade } from '../../../render/palette'
import { C } from './palette'

export function drawProp(kind: string, x: number, y: number): PropSprite | null {
  const h = hash2(x, y, 21)
  const jitter = { x: (hash2(x, y, 22) - 0.5) * 0.3, y: (hash2(x, y, 23) - 0.5) * 0.3 }
  const c = iso(x + 0.5 + jitter.x, y + 0.5 + jitter.y)
  const center = iso(x + 0.5, y + 0.5)
  const view = new Container()
  view.position.set(c.x, c.y)
  const depth = x + y + 1
  const g = new Graphics()
  view.addChild(g)
  const shadow = (rx: number, ry: number, a = 0.14) => g.ellipse(0, 0, rx, ry).fill({ color: C.shadow, alpha: a })

  switch (kind) {
    case 'tree': {
      const s = 0.85 + h * 0.35
      shadow(15 * s, 7 * s)
      g.roundRect(-2.5, -16 * s, 5, 16 * s, 2).fill(C.trunk)
      const crown = new Container()
      crown.position.set(0, -14 * s)
      const cg = new Graphics()
      const leaf = C.leaf[Math.floor(h * C.leaf.length)]
      const r = 13 * s
      cg.circle(-r * 0.55, -r * 0.55, r * 0.8).fill(shade(leaf, -0.1))
      cg.circle(r * 0.55, -r * 0.5, r * 0.8).fill(shade(leaf, -0.14))
      cg.circle(0, -r * 1.05, r * 0.95).fill(leaf)
      cg.circle(-r * 0.25, -r * 1.3, r * 0.5).fill(shade(leaf, 0.12))
      if (h > 0.7) for (let i = 0; i < 4; i++) cg.circle(-r * 0.5 + i * r * 0.35, -r * (0.6 + (i % 2) * 0.5), 1.8).fill(0xd9534f)
      crown.addChild(cg)
      view.addChild(crown)
      return { view, depth, sway: { target: crown, phase: h * 10, amount: 0.035 } }
    }
    case 'pine': {
      const s = 0.85 + h * 0.4
      const color = C.pine[Math.floor(h * C.pine.length)]
      shadow(12 * s, 6 * s)
      g.rect(-2, -8 * s, 4, 8 * s).fill(C.trunk)
      const crown = new Container()
      crown.position.set(0, -6 * s)
      const cg = new Graphics()
      for (let i = 0; i < 3; i++) {
        const w = (13 - i * 3.2) * s
        const top = -(14 + i * 10) * s
        const base = -(i * 10) * s
        cg.poly([-w, base, 0, top - 6 * s, 0, base + 2]).fill(color)
        cg.poly([0, top - 6 * s, w, base, 0, base + 2]).fill(shade(color, -0.15))
      }
      crown.addChild(cg)
      view.addChild(crown)
      return { view, depth, sway: { target: crown, phase: h * 10, amount: 0.025 } }
    }
    case 'bush':
      shadow(11, 5, 0.12)
      g.circle(-5, -5, 6).fill(shade(C.bush, -0.1))
      g.circle(5, -5, 6).fill(shade(C.bush, -0.15))
      g.circle(0, -8, 7).fill(C.bush)
      if (h > 0.5) for (let i = 0; i < 3; i++) g.circle(-4 + i * 4, -9 + (i % 2) * 3, 1.3).fill(0x7b5ea7)
      return { view, depth }
    case 'flowers':
      for (let i = 0; i < 6; i++) {
        const fx = (hash2(x, y, 30 + i) - 0.5) * 26
        const fy = (hash2(x, y, 40 + i) - 0.5) * 12
        g.moveTo(fx, fy).lineTo(fx, fy - 4).stroke({ width: 1, color: 0x78a06d })
        g.circle(fx, fy - 5, 2).fill(C.flowers[Math.floor(hash2(x, y, 50 + i) * C.flowers.length)])
      }
      return { view, depth: depth - 0.5 }
    case 'rock':
      shadow(9, 4, 0.12)
      g.poly([-8, 0, -6, -6, 1, -9, 7, -5, 8, 0]).fill(C.rock)
      g.poly([1, -9, 7, -5, 8, 0, 2, 0]).fill(C.rockShade)
      g.circle(-3, -5, 2).fill({ color: 0x7fa874, alpha: 0.7 })
      return { view, depth }
    case 'reeds':
      for (let i = 0; i < 5; i++) {
        const fx = (hash2(x, y, 60 + i) - 0.5) * 22
        const fy = (hash2(x, y, 70 + i) - 0.5) * 10
        const hh = 8 + hash2(x, y, 80 + i) * 6
        g.moveTo(fx, fy).quadraticCurveTo(fx + 1, fy - hh / 2, fx + 2, fy - hh).stroke({ width: 1.3, color: 0x7f9f68, cap: 'round' })
        if (i % 2 === 0) g.roundRect(fx + 1, fy - hh - 3, 2.2, 4, 1).fill(0x8a6448)
      }
      return { view, depth: depth - 0.5 }
    case 'bench': {
      view.position.set(center.x, center.y)
      shadow(14, 5, 0.1)
      g.poly(isoPoly([-0.3, -0.12, 5], [0.3, -0.12, 5], [0.3, 0.12, 5], [-0.3, 0.12, 5])).fill(C.wood)
      g.poly(isoPoly([-0.3, 0.12, 5], [0.3, 0.12, 5], [0.3, 0.12, 3], [-0.3, 0.12, 3])).fill(C.woodDark)
      g.poly(isoPoly([-0.3, -0.12, 5], [0.3, -0.12, 5], [0.3, -0.12, 12], [-0.3, -0.12, 12])).fill(shade(C.wood, 0.08))
      for (const lx of [-0.24, 0.24]) {
        const [px, py] = isoFlat(lx, 0.1, 3)
        g.rect(px - 1, py, 2, 3).fill(C.woodDark)
      }
      return { view, depth: depth - 0.2 }
    }
    case 'torch': {
      view.position.set(center.x, center.y)
      shadow(5, 2.5, 0.15)
      g.rect(-1.5, -26, 3, 26).fill(C.woodDark)
      g.poly([-5, -30, 5, -30, 3, -25, -3, -25]).fill(C.iron)
      const flame = new Container()
      flame.position.set(0, -30)
      const halo = new Graphics().circle(0, 0, 12).fill({ color: C.fire, alpha: 0.16 })
      halo.position.set(0, -34)
      view.addChildAt(halo, 0)
      const fg = new Graphics()
      fg.poly([-4, 0, 0, -12, 4, 0]).fill(C.fire)
      fg.poly([-2.3, 0, 0, -7.5, 2.3, 0]).fill(0xffe08a)
      flame.addChild(fg)
      view.addChild(flame)
      const phase = h * 20
      return {
        view,
        depth,
        glows: [{ x: center.x, y: center.y - 34, r: 58, color: C.fire }],
        update: (t, _dt, { night }) => {
          flame.scale.set(1 + Math.sin(t * 13 + phase) * 0.08, 1 + Math.sin(t * 17 + phase) * 0.14)
          flame.alpha = 0.88 + Math.sin(t * 29 + phase) * 0.1
          halo.scale.set(1 + night * 2.2 + Math.sin(t * 11 + phase) * 0.06)
          halo.alpha = 0.6 + night * 1.6
        },
      }
    }
    case 'banner': {
      view.position.set(center.x, center.y)
      shadow(5, 2.5)
      g.rect(-1.2, -40, 2.4, 40).fill(C.woodDark)
      g.circle(0, -41, 2).fill(C.gold)
      const cloth = new Graphics()
      cloth.poly([0, 0, 16, 0, 16, 22, 8, 17, 0, 22]).fill(C.crimson)
      cloth.circle(8, 8, 3.5).fill(C.gold)
      cloth.poly([4.5, 5, 8, 0.5, 11.5, 5]).fill(C.gold)
      cloth.position.set(1.2, -38)
      view.addChild(cloth)
      const phase = h * 10
      return { view, depth, update: (t) => (cloth.skew.y = Math.sin(t * 2.4 + phase) * 0.12) }
    }
    case 'barrels':
      shadow(16, 7, 0.12)
      for (const [bx, by] of [
        [-7, 0],
        [7, 1],
        [0, -9],
      ]) {
        g.ellipse(bx, by, 6.5, 3).fill(shade(C.wood, -0.25))
        g.rect(bx - 6.5, by - 12, 13, 12).fill(C.wood)
        g.rect(bx + 2, by - 12, 4.5, 12).fill(shade(C.wood, -0.12))
        for (const v of [-3, -9]) g.rect(bx - 6.5, by + v, 13, 1.4).fill(C.iron)
        g.ellipse(bx, by - 12, 6.5, 3).fill(shade(C.wood, 0.12))
      }
      return { view, depth }
    case 'stall': {
      const canopy = [C.crimson, C.royal, C.teal, C.arcane][Math.floor(h * 4)]
      shadow(16, 7, 0.12)
      g.poly(isoPoly([-0.35, -0.3, 10], [0.35, -0.3, 10], [0.35, 0.3, 10], [-0.35, 0.3, 10])).fill(C.wood)
      g.poly(isoPoly([-0.35, 0.3, 10], [0.35, 0.3, 10], [0.35, 0.3, 0], [-0.35, 0.3, 0])).fill(C.woodDark)
      g.poly(isoPoly([0.35, 0.3, 10], [0.35, -0.3, 10], [0.35, -0.3, 0], [0.35, 0.3, 0])).fill(shade(C.woodDark, -0.1))
      const goods = [C.pumpkin, 0xd9534f, 0x9cc184, C.gold, 0x9b6fb0]
      for (let i = 0; i < 6; i++) {
        const [fx, fy] = isoFlat(-0.22 + (i % 3) * 0.22, -0.12 + Math.floor(i / 3) * 0.24, 12)
        g.circle(fx, fy, 2.6).fill(goods[(i + Math.floor(h * 5)) % goods.length])
      }
      g.rect(-13, -28, 1.5, 18).fill(C.woodDark)
      g.rect(11.5, -28, 1.5, 18).fill(C.woodDark)
      g.poly([-17, -26, 0, -34, 17, -26, 0, -18]).fill(canopy)
      for (let i = 0; i < 4; i++) g.poly([-17 + i * 8.5, -26 + i * -2, -12.75 + i * 8.5, -27 + i * -2, -8.5 + i * 8.5, -22, -12.75 + i * 8.5, -21]).fill({ color: 0xfaf3e8, alpha: i % 2 ? 0 : 0.5 })
      return { view, depth }
    }
    case 'anvil':
      shadow(10, 5)
      g.ellipse(0, -1, 8, 4).fill(shade(C.trunk, -0.1))
      g.rect(-8, -8, 16, 7).fill(C.trunk)
      g.ellipse(0, -8, 8, 4).fill(shade(C.trunk, 0.15))
      g.poly([-9, -15, 7, -15, 11, -13, 7, -11, -5, -11, -9, -13]).fill(C.iron)
      g.rect(-3, -11, 6, 3).fill(shade(C.iron, -0.2))
      return { view, depth }
    case 'menhir': {
      shadow(9, 4.5)
      g.poly([-7, 0, -5, -30, 0, -36, 5, -31, 7, 0]).fill(0xa9a79f)
      g.poly([0, -36, 5, -31, 7, 0, 1, 0]).fill(0x8f8d86)
      g.circle(-4, -8, 3).fill({ color: 0x7fa874, alpha: 0.8 })
      const rune = new Graphics()
      rune.moveTo(-2, -24).lineTo(0, -18).lineTo(-2, -12).moveTo(0, -18).lineTo(2.5, -21).stroke({ width: 1.3, color: 0x9fe3ff })
      view.addChild(rune)
      const phase = h * 7
      return {
        view,
        depth,
        glows: [{ x: c.x, y: c.y - 18, r: 22, color: 0x9fe3ff }],
        update: (t) => (rune.alpha = 0.35 + Math.max(0, Math.sin(t * 0.8 + phase)) * 0.65),
      }
    }
    case 'haystack':
      shadow(14, 6)
      g.ellipse(0, -2, 13, 6).fill(shade(C.thatch, -0.15))
      g.moveTo(-13, -2).quadraticCurveTo(-10, -26, 0, -27).quadraticCurveTo(10, -26, 13, -2).fill(C.thatch)
      for (let i = -2; i <= 2; i++) g.moveTo(i * 4, -24 + Math.abs(i) * 2).lineTo(i * 5, -3).stroke({ width: 1, color: shade(C.thatch, -0.25), alpha: 0.5 })
      return { view, depth }
    case 'pumpkin':
      for (let i = 0; i < 3; i++) {
        const [fx, fy] = isoFlat(-0.3 + i * 0.3, 0, 0)
        const s = 0.8 + hash2(x, y, 90 + i) * 0.4
        g.ellipse(fx, fy - 3 * s, 5 * s, 4 * s).fill(C.pumpkin)
        g.ellipse(fx - 1.6 * s, fy - 3 * s, 1.5 * s, 3.6 * s).fill(shade(C.pumpkin, -0.12))
        g.rect(fx - 0.6, fy - 8.5 * s, 1.4, 2.5).fill(0x5a7a4a)
        g.ellipse(fx + 3, fy - 7 * s, 2.4, 1.2).fill(0x7fa86a)
      }
      return { view, depth: depth - 0.5 }
    case 'mushrooms':
      for (let i = 0; i < 3; i++) {
        const fx = (hash2(x, y, 110 + i) - 0.5) * 18
        const fy = (hash2(x, y, 120 + i) - 0.5) * 8
        const s = 0.7 + hash2(x, y, 130 + i) * 0.6
        g.rect(fx - 1.2 * s, fy - 6 * s, 2.4 * s, 6 * s).fill(0xf3eadb)
        g.moveTo(fx - 5 * s, fy - 5 * s).quadraticCurveTo(fx, fy - 12 * s, fx + 5 * s, fy - 5 * s).fill(0xd9534f)
        g.circle(fx - 1.5 * s, fy - 8 * s, 0.9 * s).fill(0xffffff)
        g.circle(fx + 2 * s, fy - 7 * s, 0.8 * s).fill(0xffffff)
      }
      return { view, depth }
    case 'well':
      shadow(16, 8, 0.12)
      g.ellipse(0, -6, 13, 6.5).fill(C.stoneDark)
      g.rect(-13, -6, 26, 6).fill(C.stoneDark)
      g.ellipse(0, 0, 13, 6.5).fill(C.stoneDark)
      g.ellipse(0, -6, 13, 6.5).fill(C.stone)
      g.ellipse(0, -6, 9, 4.5).fill(0x4a6a7a)
      g.rect(-11, -26, 2, 20).fill(C.woodDark)
      g.rect(9, -26, 2, 20).fill(C.woodDark)
      g.poly([-15, -24, 0, -34, 15, -24, 13, -22, 0, -31, -13, -22]).fill(C.thatch)
      g.moveTo(0, -24).lineTo(0, -14).stroke({ width: 1, color: C.woodDark })
      g.rect(-2.5, -14, 5, 4).fill(C.wood)
      return { view, depth }
    default:
      return null
  }
}
