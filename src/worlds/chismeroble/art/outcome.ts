import { Container, Graphics } from 'pixi.js'
import { hash2 } from '../../../core/world/rng'
import type { Outcome, OutcomeVisual } from '../../../core/reactions/outcome'
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
  const scene = o.truth ? SCENES[o.visual](view) : nothing(view)
  let age = 0
  view.scale.set(0.2)
  return {
    view,
    // A fire rises above the trees around it; everything else sits among them.
    depth: o.at.x + o.at.y + (o.truth && (o.visual === 'fire' || o.visual === 'meteor') ? 6 : o.truth && o.visual === 'flood' ? -0.4 : 0.6),
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

/** A dragon's fire spreads over a whole wood; a house fire (`withDragon` false) stays around one building. */
function fire(view: Container, withDragon = true): Animate {
  const k = withDragon ? 1 : 0.4
  const glow = new Graphics().ellipse(0, -10, 220 * k, 110 * k).fill({ color: C.fire, alpha: 0.2 })
  view.addChild(glow)
  const flames = Array.from({ length: withDragon ? 26 : 11 }, (_, i) => {
    const [dx, dy] = isoFlat((hash2(i, 3, 71) - 0.5) * 7 * k, (hash2(i, 5, 73) - 0.5) * 7 * k)
    const f = flame(1.3 + hash2(i, 7, 79) * 1.2)
    f.position.set(dx, dy)
    return { f, phase: i * 1.7 }
  }).sort((a, b) => a.f.y - b.f.y)
  const smoke = Array.from({ length: 16 }, (_, i) => {
    const s = new Graphics().circle(0, 0, 14).fill({ color: 0x4a423c, alpha: 0.4 })
    view.addChild(s)
    return { s, seed: i / 16, x: (hash2(i, 9, 83) - 0.5) * 200 * k }
  })
  for (const { f } of flames) view.addChild(f)
  const shadow = new Graphics().ellipse(0, 0, 34, 12).fill({ color: C.shadow, alpha: 0.2 })
  const dragon = drawDragon()
  if (withDragon) view.addChild(shadow, dragon)
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
  mark.position.set(0, -30)
  mark.scale.set(1.7)
  puff.scale.set(1.3)
  view.addChild(puff, mark)
  return (t) => {
    mark.y = -30 + Math.sin(t * 2) * 3
    puff.alpha = 0.85 + Math.sin(t * 1.3) * 0.1
  }
}

const SCENES: Record<OutcomeVisual, (view: Container) => Animate> = {
  fire: (v) => fire(v),
  blaze: (v) => fire(v, false),
  monster: troll,
  feast,
  treasure,
  sparkle: sparkles,
  undead,
  wolves,
  flood,
  caravan,
  thief,
  ghost,
  meteor,
}

/** Three skeletons shambling out of the ground, with a green mist. */
function undead(view: Container): Animate {
  const mist = new Graphics()
  for (let k = 0; k < 4; k++) mist.ellipse(0, 4, 70 + k * 18, 26 + k * 7).fill({ color: 0x9fe3b8, alpha: 0.06 })
  view.addChild(mist)
  const bone = 0xe8e2d0
  const bones = [
    [-30, -4],
    [8, 10],
    [34, -10],
  ].map(([dx, dy], i) => {
    const f = buildFigure({ skin: bone, hair: bone, hairStyle: 'bald', shirt: 0xd8d0bc, pants: 0xcfc6b0 }, 40)
    const ribs = new Graphics()
    for (let r = 0; r < 3; r++) ribs.moveTo(-4, -16 + r * 3).lineTo(4, -16 + r * 3).stroke({ width: 1, color: 0x8a8272 })
    ribs.circle(2.5, -23, 1.3).fill(0x7dffb0)
    f.body.addChild(ribs)
    const c = new Container()
    c.position.set(dx, dy)
    c.addChild(f.shadow, f.body)
    view.addChild(c)
    return { f, c, phase: i * 2.1 }
  })
  return (t) => {
    for (const b of bones) {
      b.f.body.rotation = Math.sin(t * 2 + b.phase) * 0.12
      b.f.armL.rotation = -1.2 + Math.sin(t * 3 + b.phase) * 0.3
      b.f.armR.rotation = -1.1 + Math.sin(t * 3 + b.phase + 1) * 0.3
      b.c.x += Math.sin(t * 0.5 + b.phase) * 0.06
    }
    mist.alpha = 0.8 + Math.sin(t * 1.5) * 0.2
  }
}

/** A small pack of grey wolves prowling in a circle, eyes glinting. */
function wolves(view: Container): Animate {
  const pack = [0, 1, 2].map((i) => {
    const w = new Container()
    const g = new Graphics()
    g.ellipse(0, 1, 14, 4).fill({ color: C.shadow, alpha: 0.18 })
    g.ellipse(0, -10, 13, 7).fill(0x6e6a66)
    g.ellipse(-3, -8, 9, 5).fill(0x86817c)
    g.poly([10, -14, 22, -16, 20, -8, 11, -7]).fill(0x6e6a66)
    g.poly([13, -15, 15, -22, 17, -15]).fill(0x5a5652)
    g.poly([17, -15, 19, -21, 20, -14]).fill(0x5a5652)
    g.circle(18, -13, 1.3).fill(0xffd84d)
    g.moveTo(-12, -11).quadraticCurveTo(-22, -16, -24, -8).stroke({ width: 3, color: 0x6e6a66, cap: 'round' })
    for (const lx of [-8, -3, 5, 9]) g.rect(lx, -5, 2.4, 6).fill(0x5a5652)
    w.addChild(g)
    view.addChild(w)
    return { w, phase: (i / 3) * Math.PI * 2 }
  })
  return (t) => {
    for (const p of pack) {
      const a = t * 0.6 + p.phase
      p.w.position.set(Math.cos(a) * 44, Math.sin(a) * 18)
      p.w.scale.x = -Math.sin(a) >= 0 ? 1 : -1
      p.w.y += -Math.abs(Math.sin(t * 8 + p.phase)) * 1.5
    }
  }
}

/** Water spilling over the tiles around the spot, with ripples. */
function flood(view: Container): Animate {
  const g = new Graphics()
  for (let dx = -2; dx <= 2; dx++)
    for (let dy = -2; dy <= 2; dy++) {
      if (Math.hypot(dx, dy) > 2.6) continue
      g.poly(isoPoly([dx - 0.5, dy - 0.5, 0], [dx + 0.5, dy - 0.5, 0], [dx + 0.5, dy + 0.5, 0], [dx - 0.5, dy + 0.5, 0])).fill({ color: 0x7fb2c6, alpha: 0.75 })
    }
  view.addChild(g)
  const ripples = Array.from({ length: 6 }, (_, i) => {
    const r = new Graphics().ellipse(0, 0, 10, 4).stroke({ width: 1.4, color: 0xcde4eb })
    const [x, y] = isoFlat((hash2(i, 1, 61) - 0.5) * 3.5, (hash2(i, 2, 63) - 0.5) * 3.5)
    r.position.set(x, y)
    view.addChild(r)
    return { r, seed: i / 6 }
  })
  return (t) => {
    for (const p of ripples) {
      const k = (t * 0.5 + p.seed) % 1
      p.r.scale.set(0.4 + k * 1.6)
      p.r.alpha = 1 - k
    }
  }
}

/** A covered wagon and its horse, stopped with goods on show. */
function caravan(view: Container): Animate {
  const g = new Graphics()
  view.addChild(g)
  g.ellipse(0, 4, 46, 14).fill({ color: C.shadow, alpha: 0.15 })
  g.roundRect(-30, -22, 44, 16, 3).fill(0x8a5f40)
  g.moveTo(-30, -22).quadraticCurveTo(-8, -52, 14, -22).fill(0xf3e6cf)
  g.moveTo(-30, -22).quadraticCurveTo(-8, -52, 14, -22).stroke({ width: 1.5, color: 0xc9b89a })
  for (const wx of [-22, 6]) {
    g.circle(wx, -4, 7).stroke({ width: 2.5, color: 0x5e4231 })
    g.circle(wx, -4, 1.5).fill(0x5e4231)
  }
  for (const [bx, color] of [
    [-24, 0xb23a48],
    [-12, 0x3f5f9f],
    [0, 0xe3b94f],
  ] as const)
    g.roundRect(bx, -30, 8, 8, 2).fill(color)
  const horse = new Graphics()
  horse.ellipse(34, -16, 12, 7).fill(0x8a5a3a)
  horse.poly([42, -20, 52, -34, 56, -30, 48, -16]).fill(0x8a5a3a)
  horse.poly([50, -34, 52, -40, 54, -34]).fill(0x6b4428)
  for (const lx of [26, 30, 38, 42]) horse.rect(lx, -10, 2.5, 10).fill(0x6b4428)
  horse.moveTo(14, -14).lineTo(26, -16).stroke({ width: 1.5, color: 0x5e4231 })
  view.addChild(horse)
  return (t) => {
    horse.y = Math.sin(t * 2) * 0.6
    horse.rotation = Math.sin(t * 1.3) * 0.01
  }
}

/** A hooded thief darting to and fro with a stolen sack. */
function thief(view: Container): Animate {
  const f = buildFigure({ skin: 0xd39c72, hair: 0x2c2522, hairStyle: 'short', shirt: 0x3a3440, pants: 0x2e2a30, accessory: 'bag' }, 30)
  const hood = new Graphics().poly([-6, -22, 0, -32, 6, -22, 5, -17, -5, -17]).fill(0x2e2a36)
  f.body.addChild(hood)
  const sack = new Graphics().circle(9, -10, 5).fill(0xb98b63)
  sack.poly([6, -15, 9, -19, 12, -15]).fill(0xb98b63)
  f.body.addChild(sack)
  view.addChild(f.shadow, f.body)
  return (t) => {
    const x = Math.sin(t * 1.4) * 40
    f.body.x = x
    f.shadow.x = x
    f.body.scale.x = Math.abs(f.body.scale.x) * (Math.cos(t * 1.4) >= 0 ? 1 : -1)
    f.legL.y = Math.max(0, Math.sin(t * 16)) * -2
    f.legR.y = Math.max(0, -Math.sin(t * 16)) * -2
  }
}

/** A see-through spectre floating and flickering. */
function ghost(view: Container): Animate {
  const spirit = new Container()
  const g = new Graphics()
  g.moveTo(-14, 0).lineTo(-14, -26).quadraticCurveTo(-14, -44, 0, -44).quadraticCurveTo(14, -44, 14, -26).lineTo(14, 0)
  for (let i = 0; i < 4; i++) g.lineTo(14 - (i + 0.5) * 7, i % 2 ? 0 : -6)
  g.lineTo(-14, 0).fill({ color: 0xf4f7fb, alpha: 0.75 })
  g.ellipse(-5, -30, 2.5, 3.5).fill(0x3a3a4a)
  g.ellipse(5, -30, 2.5, 3.5).fill(0x3a3a4a)
  g.ellipse(0, -21, 3, 4).fill(0x3a3a4a)
  spirit.addChild(g)
  const halo = new Graphics().ellipse(0, 4, 26, 9).fill({ color: 0xbfd8ff, alpha: 0.2 })
  view.addChild(halo, spirit)
  return (t) => {
    spirit.y = -18 + Math.sin(t * 1.6) * 6
    spirit.alpha = 0.55 + Math.sin(t * 3.1) * 0.25
    spirit.rotation = Math.sin(t * 1.1) * 0.06
  }
}

/** A glowing rock in a smoking crater, after a streak across the sky. */
function meteor(view: Container): Animate {
  const crater = new Graphics()
  crater.ellipse(0, 0, 44, 18).fill(0x6b5a48)
  crater.ellipse(0, -2, 34, 13).fill(0x3e342c)
  view.addChild(crater)
  const rock = new Graphics()
  rock.poly([-12, -4, -8, -18, 4, -22, 13, -12, 10, -2]).fill(0x5a4a44)
  rock.poly([-6, -14, 2, -18, 8, -12, 0, -8]).fill(0xff9a3c)
  view.addChild(rock)
  const glow = new Graphics().ellipse(0, -8, 60, 26).fill({ color: 0xff9a3c, alpha: 0.18 })
  view.addChildAt(glow, 0)
  const streak = new Graphics().moveTo(0, 0).lineTo(-120, -260).stroke({ width: 6, color: 0xffe08a, alpha: 0.8 })
  view.addChild(streak)
  const puffs = Array.from({ length: 8 }, (_, i) => {
    const p = new Graphics().circle(0, 0, 9).fill({ color: 0x6e645c, alpha: 0.4 })
    view.addChild(p)
    return { p, seed: i / 8, x: (hash2(i, 5, 67) - 0.5) * 40 }
  })
  let age = 0
  let last = 0
  return (t) => {
    age += last ? Math.min(0.1, t - last) : 0
    last = t
    streak.alpha = Math.max(0, 0.9 - age * 1.5)
    glow.alpha = 0.7 + Math.sin(t * 4) * 0.3
    for (const q of puffs) {
      const k = (t * 0.25 + q.seed) % 1
      q.p.position.set(q.x + Math.sin(k * 5) * 8, -14 - k * 110)
      q.p.scale.set(0.8 + k * 2)
      q.p.alpha = Math.sin(k * Math.PI) * 0.8
    }
  }
}
