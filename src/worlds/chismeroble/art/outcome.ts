import { Container, Graphics } from 'pixi.js'
import { hash2 } from '../../../core/world/rng'
import type { Outcome } from '../../../core/reactions/outcome'
import type { ArtSprite } from '../../../render/art'
import { iso, isoFlat, isoPoly } from '../../../render/iso'
import { shade } from '../../../render/palette'
import { buildFigure } from '../../../render/residentSprite'
import { C } from './palette'

/** What turned out to happen, drawn where it happened; everything grows in so it reads as a reveal. */
export function drawOutcome(o: Outcome): ArtSprite {
  const view = new Container()
  const c = iso(o.at.x, o.at.y)
  view.position.set(c.x, c.y)
  const scene = !o.truth ? nothing(view) : o.visual === 'fire' ? fire(view) : o.visual === 'monster' ? troll(view) : o.visual === 'feast' ? feast(view) : o.visual === 'treasure' ? treasure(view) : sparkles(view)
  let age = 0
  view.scale.set(0.2)
  return {
    view,
    // A fire rises above the trees around it; everything else sits among them.
    depth: o.at.x + o.at.y + (o.truth && o.visual === 'fire' ? 6 : 0.6),
    glows: [],
    update: (t, dt, ambience) => {
      age += dt
      view.scale.set(Math.min(1, 0.2 + age * 1.6))
      scene(t, ambience.night)
    },
  }
}

type Animate = (t: number, night: number) => void

function flame(size: number) {
  const f = new Graphics()
  f.poly([-6 * size, 0, 0, -20 * size, 6 * size, 0]).fill(C.fire)
  f.poly([-3.5 * size, 0, 0, -12 * size, 3.5 * size, 0]).fill(0xffe08a)
  return f
}

function fire(view: Container): Animate {
  const glow = new Graphics().ellipse(0, -10, 220, 110).fill({ color: C.fire, alpha: 0.2 })
  view.addChild(glow)
  const flames = Array.from({ length: 26 }, (_, i) => {
    const [dx, dy] = isoFlat((hash2(i, 3, 71) - 0.5) * 7, (hash2(i, 5, 73) - 0.5) * 7)
    const f = flame(1.3 + hash2(i, 7, 79) * 1.2)
    f.position.set(dx, dy)
    return { f, phase: i * 1.7 }
  }).sort((a, b) => a.f.y - b.f.y)
  const smoke = Array.from({ length: 16 }, (_, i) => {
    const s = new Graphics().circle(0, 0, 14).fill({ color: 0x4a423c, alpha: 0.4 })
    view.addChild(s)
    return { s, seed: i / 16, x: (hash2(i, 9, 83) - 0.5) * 200 }
  })
  for (const { f } of flames) view.addChild(f)
  const shadow = new Graphics().ellipse(0, 0, 34, 12).fill({ color: C.shadow, alpha: 0.2 })
  const dragon = drawDragon()
  view.addChild(shadow, dragon)
  return (t) => {
    for (const { f, phase } of flames) f.scale.set(1 + Math.sin(t * 11 + phase) * 0.1, 1 + Math.sin(t * 15 + phase) * 0.18)
    for (const p of smoke) {
      const k = (t * 0.18 + p.seed) % 1
      p.s.position.set(p.x + Math.sin(k * 6 + p.seed * 9) * 14, -30 - k * 200)
      p.s.scale.set(1 + k * 2.6)
      p.s.alpha = Math.sin(k * Math.PI) * 0.9
    }
    glow.alpha = 0.8 + Math.sin(t * 7) * 0.2
    const a = t * 0.45
    const [dx, dy] = [Math.cos(a) * 170, Math.sin(a) * 70]
    dragon.position.set(dx, dy - 190)
    dragon.scale.x = Math.cos(a) > 0 ? -1 : 1
    dragon.rotation = Math.sin(a) * 0.08
    ;(dragon.children[1] as Graphics).scale.y = 0.6 + Math.abs(Math.sin(t * 5)) * 0.6
    shadow.position.set(dx, dy)
  }
}

/** A red dragon in profile; child 1 is the wing so it can flap. */
function drawDragon() {
  const d = new Container()
  const red = 0xb23a3a
  const body = new Graphics()
  body.moveTo(-46, 4).quadraticCurveTo(-20, 10, 0, 0).quadraticCurveTo(20, -8, 34, -4).lineTo(46, -10).lineTo(40, 0).quadraticCurveTo(20, 8, 0, 10).quadraticCurveTo(-24, 16, -46, 4).fill(red)
  body.circle(44, -9, 5).fill(shade(red, 0.1))
  body.poly([46, -13, 52, -18, 49, -10]).fill(0x3a2a2a)
  body.circle(46, -10, 1.2).fill(0xffe08a)
  body.poly([-46, 4, -58, -2, -54, 8]).fill(shade(red, -0.2))
  const wing = new Graphics()
  wing.poly([-8, 0, 6, -40, 14, -12, 24, -34, 22, -2]).fill(shade(red, -0.25))
  wing.pivot.set(0, 0)
  wing.position.set(4, -2)
  d.addChild(body, wing)
  return d
}

function troll(view: Container): Animate {
  const look = { skin: 0x7d8f6a, hair: 0x3a3430, hairStyle: 'bald', shirt: 0x6b5a44, pants: 0x4a3f36, ancestry: 'halforc' }
  const figure = buildFigure(look, 40)
  const body = figure.body
  body.scale.set(body.scale.x * 1.9, body.scale.y * 1.9)
  const club = new Graphics()
  club.moveTo(7, 2).lineTo(12, -22).stroke({ width: 3, color: 0x6b4a33, cap: 'round' })
  club.circle(12.5, -24, 4.5).fill(0x7d5a3f)
  body.addChild(club)
  figure.shadow.scale.set(2)
  view.addChild(figure.shadow, body)
  return (t) => {
    body.y = -Math.abs(Math.sin(t * 2.2)) * 3
    club.rotation = Math.sin(t * 2.2) * 0.25
  }
}

function feast(view: Container): Animate {
  const g = new Graphics()
  view.addChild(g)
  const w = 1.1
  const d = 0.35
  g.poly(isoPoly([-w, -d, 12], [w, -d, 12], [w, d, 12], [-w, d, 12])).fill(0xf3e6cf)
  g.poly(isoPoly([-w, d, 12], [w, d, 12], [w, d, 7], [-w, d, 7])).fill(0xe0cfb0)
  g.poly(isoPoly([w, -d, 12], [w, d, 12], [w, d, 7], [w, -d, 7])).fill(0xcdbb9b)
  for (const x of [-0.9, 0.9]) {
    const [lx, ly] = isoFlat(x, d, 0)
    g.rect(lx - 1.5, ly - 7, 3, 7).fill(C.woodDark)
  }
  const [bx, by] = isoFlat(0, 0, 12)
  g.ellipse(bx, by - 5, 14, 7).fill(0xa0522d)
  g.ellipse(bx - 3, by - 7, 8, 4).fill(0xc0703d)
  g.circle(bx + 13, by - 6, 3.5).fill(0x8b4a2b)
  for (const x of [-0.75, 0.55]) {
    const [mx, my] = isoFlat(x, -0.1, 12)
    g.roundRect(mx - 3, my - 9, 6, 9, 1.5).fill(0xd9b36c)
    g.rect(mx - 3, my - 9, 6, 2).fill(0xfbf5e6)
  }
  for (const x of [-0.4, 0.3, 0.8]) {
    const [px, py] = isoFlat(x, 0.2, 12)
    g.ellipse(px, py - 1, 4, 2).fill(0xfbf6ee)
    g.circle(px, py - 2.5, 2).fill(C.pumpkin)
  }
  return sparkleLayer(view, 0xffd98a)
}

function treasure(view: Container): Animate {
  const g = new Graphics()
  view.addChild(g)
  g.ellipse(0, 0, 60, 28).fill({ color: C.gold, alpha: 0.18 })
  g.poly(isoPoly([-0.3, -0.2, 0], [0.3, -0.2, 0], [0.3, 0.2, 0], [-0.3, 0.2, 0])).fill(0x6b4a33)
  g.poly(isoPoly([-0.3, 0.2, 0], [0.3, 0.2, 0], [0.3, 0.2, 12], [-0.3, 0.2, 12])).fill(0x8a5f40)
  g.poly(isoPoly([0.3, -0.2, 0], [0.3, 0.2, 0], [0.3, 0.2, 12], [0.3, -0.2, 12])).fill(0x74502f)
  g.poly(isoPoly([-0.3, -0.2, 12], [0.3, -0.2, 12], [0.3, 0.2, 12], [-0.3, 0.2, 12])).fill(C.gold)
  g.poly(isoPoly([-0.3, -0.2, 12], [0.3, -0.2, 12], [0.3, -0.35, 24], [-0.3, -0.35, 24])).fill(0x8a5f40)
  for (let i = 0; i < 7; i++) {
    const [cx, cy] = isoFlat((hash2(i, 1, 91) - 0.5) * 1.2, 0.4 + hash2(i, 2, 93) * 0.3, 0)
    g.ellipse(cx, cy, 3, 1.6).fill(C.gold)
  }
  return sparkleLayer(view, C.gold)
}

function sparkles(view: Container): Animate {
  return sparkleLayer(view, 0xffd98a)
}

function sparkleLayer(view: Container, color: number): Animate {
  const bits = Array.from({ length: 12 }, (_, i) => {
    const s = new Graphics().star(0, 0, 4, 3.5, 1.2).fill(color)
    view.addChild(s)
    return { s, seed: i / 12, x: (hash2(i, 4, 97) - 0.5) * 70 }
  })
  return (t) => {
    for (const b of bits) {
      const k = (t * 0.4 + b.seed) % 1
      b.s.position.set(b.x, -10 - k * 60)
      b.s.alpha = Math.sin(k * Math.PI)
      b.s.rotation = t * 2 + b.seed * 6
    }
  }
}

/** A lie: a puff of dust and a question mark over the empty spot. */
function nothing(view: Container): Animate {
  const puff = new Graphics()
  for (const [x, y, r] of [
    [-10, 0, 9],
    [6, -2, 11],
    [0, -8, 10],
  ])
    puff.circle(x, y, r).fill({ color: 0xd8cfc2, alpha: 0.8 })
  const mark = new Graphics()
  mark.moveTo(-5, -12).quadraticCurveTo(-5, -20, 1, -20).quadraticCurveTo(7, -20, 6, -14).quadraticCurveTo(5, -10, 1, -8).lineTo(1, -4).stroke({ width: 3, color: 0x74685c, cap: 'round' })
  mark.circle(1, 1, 1.8).fill(0x74685c)
  mark.position.set(0, -24)
  view.addChild(puff, mark)
  return (t) => {
    mark.y = -24 + Math.sin(t * 2) * 3
    puff.alpha = 0.85 + Math.sin(t * 1.3) * 0.1
  }
}
