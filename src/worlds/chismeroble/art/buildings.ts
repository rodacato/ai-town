import { Container, Graphics } from 'pixi.js'
import type { Building } from '../../../core/world/types'
import type { BuildingSprite } from '../../../render/art'
import { isoFlat, isoPoly } from '../../../render/iso'
import {
  chimney,
  cone,
  crenellations,
  cylinder,
  doorOn,
  faces,
  flag,
  gableRoof,
  groundShadow,
  masonry,
  quad,
  timberFrame,
  walls,
  windowOn,
  type Face,
  type Footprint,
  type RoofTexture,
} from '../../../render/kit'
import { shade } from '../../../render/palette'
import { C } from './palette'

type Anim = (t: number, dt: number) => void

interface Ctx {
  b: Building
  fp: Footprint
  g: Graphics
  view: Container
  chimneys: { x: number; y: number }[]
  anims: Anim[]
  doorFace: Face
  otherFace: Face
  doorU: number
}

export function drawBuilding(b: Building): BuildingSprite {
  const fp = { x: b.x, y: b.y, n: b.size }
  const { left, right } = faces(fp)
  const view = new Container()
  const g = new Graphics()
  view.addChild(g)
  const mid = Math.floor(b.size / 2)
  const ctx: Ctx = {
    b,
    fp,
    g,
    view,
    chimneys: [],
    anims: [],
    doorFace: b.doorSide === 'left' ? left : right,
    otherFace: b.doorSide === 'left' ? right : left,
    doorU: b.doorSide === 'left' ? mid + 0.5 : b.size - mid - 0.5,
  }
  groundShadow(g, fp)
  ;(DRAW[b.kind] ?? cottage)(ctx)
  const anims = ctx.anims
  return {
    view,
    depth: b.x + b.y + b.size,
    chimneys: ctx.chimneys,
    update: anims.length ? (t, dt) => anims.forEach((a) => a(t, dt)) : undefined,
  }
}

const shadeOf = (face: Face, ctx: Ctx) => (face === ctx.doorFace ? (ctx.b.doorSide === 'left' ? 0 : -0.13) : ctx.b.doorSide === 'left' ? -0.13 : 0)

const ROOFS: { texture: RoofTexture; color: number }[] = [
  { texture: 'thatch', color: C.thatch },
  { texture: 'tiles', color: C.tiles },
  { texture: 'slate', color: C.slate },
  { texture: 'thatch', color: 0xcaa05a },
  { texture: 'tiles', color: 0xb5704f },
  { texture: 'slate', color: 0x7d7f95 },
]

function cottage(ctx: Ctx) {
  const { g, fp, b } = ctx
  const H = 26
  const plaster = C.plaster[b.palette % C.plaster.length]
  const roof = ROOFS[b.palette % ROOFS.length]
  walls(g, fp, H, plaster, C.stoneDark)
  timberFrame(g, fp, H, C.beam)
  doorOn(g, ctx.doorFace, ctx.doorU, 0.36, 18, C.door, shade(C.beam, 0.1))
  windowOn(g, ctx.otherFace, fp.n / 2, H * 0.62, { frame: C.beam, glow: b.palette % 2 === 0, shutters: roof.color, shade: shadeOf(ctx.otherFace, ctx) })
  flowerBox(g, ctx.otherFace, fp.n / 2, H * 0.62 - 7, shadeOf(ctx.otherFace, ctx))
  gableRoof(g, fp, { h: H, rise: 26, ridge: b.palette % 2 ? 'y' : 'x', color: roof.color, texture: roof.texture, gable: shade(plaster, -0.1) })
  ctx.chimneys.push(chimney(g, fp.x + fp.n * 0.3, fp.y + fp.n * 0.3, H + 16, C.stoneDark))
}

function cabin(ctx: Ctx) {
  const { g, fp } = ctx
  const H = 24
  walls(g, fp, H, C.wood, C.stoneDark)
  const { left, right } = faces(fp)
  for (let v = 8; v < H; v += 5) {
    g.moveTo(...isoFlat(...left(0, v))).lineTo(...isoFlat(...left(fp.n, v))).stroke({ width: 1.2, color: C.woodDark, alpha: 0.6 })
    g.moveTo(...isoFlat(...right(0, v))).lineTo(...isoFlat(...right(fp.n, v))).stroke({ width: 1.2, color: C.woodDark, alpha: 0.7 })
  }
  doorOn(g, ctx.doorFace, ctx.doorU, 0.34, 17, C.woodDark, shade(C.woodDark, -0.2), false)
  windowOn(g, ctx.otherFace, fp.n / 2, 15, { frame: C.woodDark, glow: true, shade: shadeOf(ctx.otherFace, ctx) })
  gableRoof(g, fp, { h: H, rise: 24, ridge: 'x', color: 0x6f6356, texture: 'slate', gable: shade(C.wood, -0.1) })
  ctx.chimneys.push(chimney(g, fp.x + fp.n * 0.7, fp.y + fp.n * 0.3, H + 14, C.stoneDark))
}

function manor(ctx: Ctx) {
  const { g, fp } = ctx
  const H = 36
  walls(g, fp, H, C.plaster[2], C.stoneDark)
  const { left, right } = faces(fp)
  g.poly(quad(left, 0, fp.n, 0, 15)).fill(C.stoneWarm)
  g.poly(quad(right, 0, fp.n, 0, 15)).fill(shade(C.stoneWarm, -0.13))
  masonry(g, fp, 0, 15, C.stoneWarm)
  timberFrame(g, { ...fp }, H, C.beam)
  doorOn(g, ctx.doorFace, ctx.doorU, 0.5, 22, C.door, C.stoneDark)
  for (const face of [left, right]) {
    const s = shadeOf(face, ctx)
    for (const u of [0.5, 2.5]) windowOn(g, face, u, 26, { frame: C.beam, glow: u === 0.5, shutters: C.crimson, shade: s })
  }
  gableRoof(g, fp, { h: H, rise: 30, ridge: 'y', color: C.slate, texture: 'slate', gable: shade(C.plaster[2], -0.08) })
  ctx.chimneys.push(chimney(g, fp.x + 0.6, fp.y + 0.6, H + 20, C.stoneDark), chimney(g, fp.x + 0.6, fp.y + 2.4, H + 20, C.stoneDark))
  hangingBanner(ctx, ctx.doorFace, ctx.doorU + 0.75, H - 4, C.crimson)
}

function tavern(ctx: Ctx) {
  const { g, fp } = ctx
  const H = 40
  walls(g, fp, H, C.plaster[0], C.stoneDark)
  timberFrame(g, fp, H, C.beam)
  const { left, right } = faces(fp)
  doorOn(g, ctx.doorFace, ctx.doorU, 0.5, 20, C.door, shade(C.beam, 0.1))
  for (const face of [left, right]) {
    const s = shadeOf(face, ctx)
    for (const u of [0.5, 1.5, 2.5]) {
      if (face === ctx.doorFace && Math.abs(u - ctx.doorU) < 0.4) continue
      windowOn(g, face, u, 12, { frame: C.beam, glow: true, shade: s })
    }
    for (const u of [0.5, 1.5, 2.5]) windowOn(g, face, u, 31, { frame: C.beam, glow: u !== 1.5, shade: s, h: 9 })
  }
  gableRoof(g, fp, { h: H, rise: 30, ridge: 'x', color: C.tiles, texture: 'tiles', gable: shade(C.plaster[0], -0.1) })
  ctx.chimneys.push(chimney(g, fp.x + 2.2, fp.y + 0.8, H + 18, C.stoneDark))
  const [sx, sy] = isoFlat(...ctx.doorFace(ctx.doorU + 0.95, H - 8))
  g.moveTo(sx - 2, sy).lineTo(sx + 16, sy + 2).stroke({ width: 2, color: C.iron })
  const sign = new Container()
  sign.position.set(sx + 12, sy + 2)
  const sg = new Graphics()
  sg.moveTo(-4, 0).lineTo(-4, 5).moveTo(4, 0).lineTo(4, 5).stroke({ width: 1, color: C.iron })
  sg.roundRect(-9, 5, 18, 14, 2).fill(C.wood).stroke({ width: 1.5, color: C.woodDark })
  sg.roundRect(-4, 8, 7, 8, 1.5).fill(C.gold)
  sg.moveTo(3, 10).quadraticCurveTo(7, 12, 3, 14).stroke({ width: 1.4, color: C.gold })
  sg.rect(-4, 8, 7, 2).fill(0xfff6e0)
  sign.addChild(sg)
  ctx.view.addChild(sign)
  ctx.anims.push((t) => (sign.rotation = Math.sin(t * 1.6) * 0.08))
}

function forge(ctx: Ctx) {
  const { g, fp } = ctx
  const H = 26
  walls(g, fp, H, C.stone, C.stoneDark)
  masonry(g, fp, 0, H, C.stone)
  const s = shadeOf(ctx.doorFace, ctx)
  g.poly(quad(ctx.doorFace, ctx.doorU - 0.42, ctx.doorU + 0.42, 0, 20)).fill(0x2b221d)
  const glow = new Graphics()
  glow.poly(quad(ctx.doorFace, ctx.doorU - 0.36, ctx.doorU + 0.36, 2, 14)).fill(C.fire)
  glow.poly(quad(ctx.doorFace, ctx.doorU - 0.2, ctx.doorU + 0.2, 2, 9)).fill(0xffe08a)
  const [ax, ay] = isoFlat(...ctx.doorFace(ctx.doorU, 22))
  g.ellipse(ax, ay, 14, 5).fill(shade(C.stoneDark, s))
  windowOn(g, ctx.otherFace, fp.n / 2, 14, { frame: C.stoneDark, glow: true, shade: shadeOf(ctx.otherFace, ctx), h: 8 })
  gableRoof(g, fp, { h: H, rise: 22, ridge: 'x', color: 0x5f6b7c, texture: 'slate', gable: shade(C.stone, -0.1) })
  ctx.view.addChild(glow)
  ctx.chimneys.push(chimney(g, fp.x + 1.5, fp.y + 0.5, H + 12, C.stoneDark, 26))
  ctx.anims.push((t) => (glow.alpha = 0.75 + Math.sin(t * 9) * 0.12 + Math.sin(t * 23) * 0.08))
}

function potions(ctx: Ctx) {
  const { g, fp } = ctx
  const H = 28
  const wall = 0xd9e6dc
  walls(g, fp, H, wall, C.stoneDark)
  timberFrame(g, fp, H, 0x4a3a52)
  doorOn(g, ctx.doorFace, ctx.doorU, 0.34, 19, C.arcane, 0x4a3a52)
  const s = shadeOf(ctx.otherFace, ctx)
  const [wx, wy] = isoFlat(...ctx.otherFace(fp.n / 2, 16))
  g.circle(wx, wy, 8).fill(shade(0x4a3a52, s))
  g.circle(wx, wy, 6.2).fill(0x3a4f5f)
  for (const [dx, c] of [
    [-3, 0x7fd1a8],
    [0, 0xd07ad1],
    [3, 0xf2c14e],
  ] as const) {
    g.roundRect(wx + dx - 1.2, wy - 1, 2.4, 5, 1).fill(c)
    g.rect(wx + dx - 0.6, wy - 2.5, 1.2, 1.6).fill(c)
  }
  gableRoof(g, fp, { h: H, rise: 28, ridge: 'y', color: C.arcane, texture: 'slate', gable: shade(wall, -0.1) })
  ctx.chimneys.push(chimney(g, fp.x + 0.5, fp.y + 0.5, H + 16, 0x8a7a9a))
  const [bx, by] = isoFlat(...ctx.doorFace(ctx.doorU + 0.7, H - 6))
  g.moveTo(bx, by).lineTo(bx + 12, by + 1).stroke({ width: 1.6, color: C.iron })
  g.roundRect(bx + 5, by + 3, 10, 12, 4).fill(0x9b6fb0).stroke({ width: 1.2, color: 0x4a3a52 })
  g.rect(bx + 8.5, by + 1, 3, 3).fill(0x4a3a52)
  const sparkles = sparkleEmitter(ctx.view, wx, wy - 26, 0xc9a7e0)
  ctx.anims.push(sparkles)
}

function temple(ctx: Ctx) {
  const { g, fp } = ctx
  const H = 34
  const stone = 0xeee8dc
  walls(g, fp, H, stone, C.stoneDark)
  masonry(g, fp, 0, H, stone)
  doorOn(g, ctx.doorFace, ctx.doorU, 0.5, 22, C.door, C.stoneDark)
  const s = shadeOf(ctx.doorFace, ctx)
  const [rx, ry] = isoFlat(...ctx.doorFace(ctx.doorU, 29))
  g.circle(rx, ry, 5.5).fill(shade(C.stoneDark, s))
  const petals = [0xe07a5f, 0xe3b94f, 0x6fa8c7, 0x7fa876, 0xc9a7e0, 0xf2a7a0]
  petals.forEach((c, i) => {
    const a0 = (i / petals.length) * Math.PI * 2
    const a1 = ((i + 1) / petals.length) * Math.PI * 2
    g.moveTo(rx, ry).arc(rx, ry, 4.2, a0, a1).lineTo(rx, ry).fill(c)
  })
  for (const u of [0.5, 2.5]) windowOn(g, ctx.doorFace, u, 18, { frame: C.stoneDark, glass: 0x6f8fc3, arched: true, shade: s, w: 0.14, h: 14 })
  for (const u of [0.5, 1.5, 2.5]) windowOn(g, ctx.otherFace, u, 18, { frame: C.stoneDark, glass: 0x6f8fc3, arched: true, shade: shadeOf(ctx.otherFace, ctx), w: 0.14, h: 14 })
  gableRoof(g, fp, { h: H, rise: 30, ridge: ctx.b.doorSide === 'left' ? 'y' : 'x', color: 0x6c7fa3, texture: 'slate', gable: shade(stone, -0.08) })
  const cx = fp.x + fp.n / 2
  const cy = fp.y + fp.n / 2
  const w = 0.38
  const base = H + 22
  const top = base + 30
  g.poly(isoPoly([cx - w, cy + w, base], [cx + w, cy + w, base], [cx + w, cy + w, top], [cx - w, cy + w, top])).fill(stone)
  g.poly(isoPoly([cx + w, cy + w, base], [cx + w, cy - w, base], [cx + w, cy - w, top], [cx + w, cy + w, top])).fill(shade(stone, -0.13))
  g.poly(quad((u, v) => [cx - w + u, cy + w, v], 0.2, 0.56, base + 8, base + 24)).fill(0x3a342e)
  const [bellX, bellY] = isoFlat(cx, cy + w, base + 18)
  const bell = new Graphics()
  bell.poly([-4, 0, 4, 0, 3, -7, -3, -7]).fill(C.gold)
  bell.circle(0, -8, 2.5).fill(C.gold)
  bell.position.set(bellX, bellY)
  const p = 0.08
  g.poly(isoPoly([cx - w - p, cy - w - p, top], [cx + w + p, cy - w - p, top], [cx, cy, top + 22])).fill(shade(0x6c7fa3, 0.12))
  g.poly(isoPoly([cx - w - p, cy + w + p, top], [cx + w + p, cy + w + p, top], [cx, cy, top + 22])).fill(0x6c7fa3)
  g.poly(isoPoly([cx + w + p, cy + w + p, top], [cx + w + p, cy - w - p, top], [cx, cy, top + 22])).fill(shade(0x6c7fa3, -0.18))
  const [sx, sy] = isoFlat(cx, cy, top + 22)
  g.moveTo(sx, sy).lineTo(sx, sy - 8).stroke({ width: 1.5, color: C.gold })
  g.circle(sx, sy - 11, 3.5).stroke({ width: 1.5, color: C.gold })
  ctx.view.addChild(bell)
  ctx.anims.push((t) => (bell.rotation = Math.sin(t * 1.2) * 0.12))
}

function mageTower(ctx: Ctx) {
  const { g, fp } = ctx
  const cx = fp.x + fp.n / 2
  const cy = fp.y + fp.n / 2
  const stone = 0xbfc2d0
  const H = 104
  const body = cylinder(g, cx, cy, 0.8, 0, H, stone)
  const [dx, dy] = isoFlat(cx, cy, 0)
  g.poly([dx - 7, dy + body.ry - 1, dx + 7, dy + body.ry - 1, dx + 7, dy + body.ry - 20, dx - 7, dy + body.ry - 20]).fill(C.royal)
  g.ellipse(dx, dy + body.ry - 20, 7, 4).fill(C.royal)
  for (const [ox, z] of [
    [-16, 40],
    [14, 62],
    [-6, 84],
  ])
    g.roundRect(dx + ox - 3, dy + body.ry - z - 6, 6, 11, 3).fill(C.glow)
  for (let z = 14; z < H; z += 14) g.ellipse(dx, dy - z + 4, body.rx, body.ry).stroke({ width: 1, color: shade(stone, -0.3), alpha: 0.25 })
  g.ellipse(dx, dy - H, body.rx + 4, body.ry + 2).fill(shade(stone, -0.15))
  const tip = cone(g, cx, cy, H, 0.92, 58, 0x34467f)
  for (let i = 0; i < 6; i++) g.circle(tip.x - 14 + ((i * 11) % 26), tip.y + 22 + ((i * 7) % 26), 1.3).fill(C.gold)
  star(g, tip.x, tip.y - 6, 5, C.gold)
  const orb = new Graphics()
  orb.circle(0, 0, 9).fill({ color: 0x9fd8ff, alpha: 0.25 })
  orb.circle(0, 0, 4.5).fill(0xd6f0ff)
  ctx.view.addChild(orb)
  ctx.anims.push((t) => {
    orb.position.set(tip.x + Math.cos(t * 0.9) * 42, tip.y + 44 + Math.sin(t * 0.9) * 14)
    orb.alpha = 0.8 + Math.sin(t * 3) * 0.2
  })
}

function mill(ctx: Ctx) {
  const { g, fp } = ctx
  const cx = fp.x + fp.n / 2
  const cy = fp.y + fp.n / 2
  const H = 46
  const body = cylinder(g, cx, cy, 0.78, 0, H, C.plaster[1])
  const [dx, dy] = isoFlat(cx, cy, 0)
  g.poly([dx - 6, dy + body.ry - 1, dx + 6, dy + body.ry - 1, dx + 6, dy + body.ry - 17, dx - 6, dy + body.ry - 17]).fill(C.door)
  g.roundRect(dx + 8, dy + body.ry - 34, 6, 8, 2).fill(C.glow)
  cone(g, cx, cy, H, 0.9, 34, C.thatch)
  const hub = new Container()
  hub.position.set(dx + 4, dy - H + 4)
  const sails = new Graphics()
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    const cos = Math.cos(a)
    const sin = Math.sin(a)
    const pt = (r: number, w: number): [number, number] => [cos * r - sin * w, (sin * r + cos * w) * 0.9]
    sails.poly([...pt(4, -1.5), ...pt(40, -1.5), ...pt(40, 1.5), ...pt(4, 1.5)]).fill(C.woodDark)
    sails.poly([...pt(12, 1.5), ...pt(38, 1.5), ...pt(38, 9), ...pt(12, 9)]).fill({ color: 0xf6eee0, alpha: 0.92 })
    for (const r of [18, 25, 32]) sails.moveTo(...pt(r, 1.5)).lineTo(...pt(r, 9)).stroke({ width: 0.8, color: C.woodDark, alpha: 0.6 })
  }
  sails.circle(0, 0, 4).fill(C.woodDark)
  hub.addChild(sails)
  ctx.view.addChild(hub)
  ctx.anims.push((_, dt) => (sails.rotation += dt * 0.5))
}

function keep(ctx: Ctx) {
  const { g, fp } = ctx
  const H = 64
  const stone = 0xc9c1b3
  walls(g, fp, H, stone, C.stoneDark)
  masonry(g, fp, 0, H, stone)
  crenellations(g, fp, H, stone)
  const s = shadeOf(ctx.doorFace, ctx)
  g.poly(quad(ctx.doorFace, ctx.doorU - 0.55, ctx.doorU + 0.55, 0, 30)).fill(shade(C.stoneDark, s))
  doorOn(g, ctx.doorFace, ctx.doorU, 0.8, 26, 0x5e3b24, shade(C.stoneDark, s - 0.1))
  for (const v of [8, 16]) g.poly(quad(ctx.doorFace, ctx.doorU - 0.4, ctx.doorU + 0.4, v, v + 1.5)).fill(C.iron)
  for (const face of [ctx.doorFace, ctx.otherFace])
    for (const u of [0.7, 3.3]) windowOn(g, face, u, 44, { frame: C.stoneDark, glow: true, shade: shadeOf(face, ctx), w: 0.08, h: 12, arched: true })
  for (const u of [ctx.doorU - 1.25, ctx.doorU + 1.25]) hangingBanner(ctx, ctx.doorFace, u, H - 8, C.crimson, 30)
  const towers = [
    [fp.x + 0.55, fp.y + fp.n - 0.55],
    [fp.x + fp.n - 0.55, fp.y + 0.55],
  ]
  for (const [tx, ty] of towers) {
    cylinder(g, tx, ty, 0.62, 0, H + 26, stone)
    const [px, py] = isoFlat(tx, ty, H + 26)
    for (let z = 10; z < H + 20; z += 10) g.ellipse(px, py + (H + 26 - z), 28, 14).stroke({ width: 1, color: shade(stone, -0.3), alpha: 0.18 })
    g.roundRect(px - 2, py + 20, 4, 10, 2).fill(C.glow)
    const tip = cone(g, tx, ty, H + 26, 0.72, 40, C.crimson)
    wavingFlag(ctx, tip.x, tip.y, 16, C.gold)
  }
}

function watchtower(ctx: Ctx) {
  const { g, fp } = ctx
  const { x, y, n } = fp
  const deck = 46
  const posts: [number, number][] = [
    [x + 0.25, y + 0.25],
    [x + n - 0.25, y + 0.25],
    [x + 0.25, y + n - 0.25],
    [x + n - 0.25, y + n - 0.25],
  ]
  for (const [px, py] of posts) {
    const [ax, ay] = isoFlat(px, py, 0)
    g.rect(ax - 2, ay - deck - 20, 4, deck + 20).fill(px > x + 1 && py > y + 1 ? C.wood : C.woodDark)
  }
  const [lx0, ly0] = isoFlat(x + 0.25, y + n - 0.25, 0)
  const [lx1, ly1] = isoFlat(x + n - 0.25, y + n - 0.25, 0)
  for (let k = 0; k < 2; k++) g.moveTo(lx0, ly0 - 8 - k * 20).lineTo(lx1, ly1 - 30 - k * 12).stroke({ width: 2, color: C.woodDark })
  const d = 0.12
  g.poly(isoPoly([x - d, y - d, deck], [x + n + d, y - d, deck], [x + n + d, y + n + d, deck], [x - d, y + n + d, deck])).fill(C.wood)
  const { left, right } = faces({ x: x - d, y: y - d, n: n + 2 * d })
  g.poly(quad(left, 0, n + 2 * d, deck - 5, deck + 10)).fill(C.wood)
  g.poly(quad(right, 0, n + 2 * d, deck - 5, deck + 10)).fill(shade(C.wood, -0.15))
  for (let u = 0.2; u < n; u += 0.35) {
    g.moveTo(...isoFlat(...left(u, deck - 5))).lineTo(...isoFlat(...left(u, deck + 10))).stroke({ width: 1, color: C.woodDark, alpha: 0.5 })
    g.moveTo(...isoFlat(...right(u, deck - 5))).lineTo(...isoFlat(...right(u, deck + 10))).stroke({ width: 1, color: C.woodDark, alpha: 0.5 })
  }
  const ladderU = ctx.doorU
  for (const k of [-0.15, 0.15]) g.moveTo(...isoFlat(...ctx.doorFace(ladderU + k, 0))).lineTo(...isoFlat(...ctx.doorFace(ladderU + k, deck))).stroke({ width: 1.6, color: C.woodDark })
  for (let v = 6; v < deck; v += 7) g.moveTo(...isoFlat(...ctx.doorFace(ladderU - 0.15, v))).lineTo(...isoFlat(...ctx.doorFace(ladderU + 0.15, v))).stroke({ width: 1.4, color: C.woodDark })
  gableRoof(g, fp, { h: deck + 30, rise: 18, ridge: 'x', color: C.thatch, texture: 'thatch', gable: C.wood, overhang: 0.28 })
  wavingFlag(ctx, ...isoFlat(x + n / 2, y + n / 2, deck + 48), 14, C.crimson)
}

function treehouse(ctx: Ctx) {
  const { g, fp } = ctx
  const cx = fp.x + fp.n / 2
  const cy = fp.y + fp.n / 2
  const [bx, by] = isoFlat(cx, cy, 0)
  g.ellipse(bx, by, 50, 24).fill({ color: C.shadow, alpha: 0.14 })
  for (const [ox, oy, r] of [
    [-16, 4, 7],
    [14, 6, 6],
    [0, 9, 6],
  ])
    g.ellipse(bx + ox, by + oy, r * 2, r).fill(shade(C.trunk, -0.1))
  g.poly([bx - 13, by + 6, bx - 9, by - 70, bx + 9, by - 70, bx + 14, by + 6]).fill(C.trunk)
  g.poly([bx + 2, by + 6, bx + 3, by - 70, bx + 9, by - 70, bx + 14, by + 6]).fill(shade(C.trunk, -0.18))
  const hut = { x: fp.x + 0.35, y: fp.y + 0.35, n: fp.n - 0.7 }
  const deck = 62
  g.ellipse(bx, by - deck + 8, 44, 20).fill(C.woodDark)
  g.ellipse(bx, by - deck + 5, 44, 20).fill(C.wood)
  const hf = hut
  const { left, right } = faces(hf)
  g.poly(quad(left, 0, hf.n, deck, deck + 20)).fill(0xc9a57a)
  g.poly(quad(right, 0, hf.n, deck, deck + 20)).fill(shade(0xc9a57a, -0.15))
  windowOn(g, left, hf.n / 2, deck + 11, { frame: C.woodDark, glow: true, w: 0.16, h: 8 })
  gableRoof(g, hf, { h: deck + 20, rise: 18, ridge: 'x', color: 0x7fa876, texture: 'thatch', gable: 0xc9a57a })
  const canopy = new Container()
  canopy.position.set(bx, by - deck - 30)
  const cg = new Graphics()
  const blobs: [number, number, number, number][] = [
    [-34, -4, 26, C.leaf[2]],
    [34, -2, 26, C.leaf[2]],
    [-18, -26, 30, C.leaf[0]],
    [20, -26, 30, C.leaf[1]],
    [0, -44, 30, C.leaf[3]],
    [-8, -54, 14, C.leafLight],
  ]
  for (const [ox, oy, r, c] of blobs) cg.circle(ox, oy, r).fill(c)
  for (const [ox, oy] of [
    [-30, 10],
    [28, 12],
  ]) {
    cg.moveTo(ox, oy - 12).lineTo(ox, oy).stroke({ width: 1, color: C.woodDark })
    cg.circle(ox, oy + 3, 3.5).fill(C.glow)
    cg.circle(ox, oy + 3, 7).fill({ color: C.glow, alpha: 0.25 })
  }
  canopy.addChild(cg)
  ctx.view.addChild(canopy)
  const [ladX, ladY] = isoFlat(...ctx.doorFace(ctx.doorU, 0))
  const ladder = new Graphics()
  for (const k of [-4, 4]) ladder.moveTo(ladX + k, ladY).lineTo(bx + k * 0.8, by - deck + 12).stroke({ width: 1.3, color: 0x8a6a48 })
  for (let t = 0.1; t < 1; t += 0.12) {
    const px = ladX + (bx - ladX) * t
    const py = ladY + (by - deck + 12 - ladY) * t
    ladder.moveTo(px - 4, py).lineTo(px + 4, py).stroke({ width: 1.2, color: 0x8a6a48 })
  }
  ctx.view.addChildAt(ladder, 1)
  ctx.anims.push((t) => (canopy.skew.x = Math.sin(t * 0.9) * 0.02))
}

const DRAW: Record<string, (ctx: Ctx) => void> = {
  cottage,
  cabin,
  manor,
  tavern,
  forge,
  potions,
  temple,
  'mage-tower': mageTower,
  mill,
  keep,
  watchtower,
  treehouse,
}

function flowerBox(g: Graphics, face: Face, u: number, v: number, s: number) {
  g.poly(quad(face, u - 0.24, u + 0.24, v - 3, v)).fill(shade(C.woodDark, s))
  for (let i = 0; i < 5; i++) {
    const [fx, fy] = isoFlat(...face(u - 0.2 + i * 0.1, v))
    g.circle(fx, fy - 1, 1.6).fill(C.flowers[i % C.flowers.length])
  }
}

function hangingBanner(ctx: Ctx, face: Face, u: number, v: number, color: number, length = 22) {
  const g = ctx.g
  const [x0, y0] = isoFlat(...face(u - 0.18, v))
  const [x1, y1] = isoFlat(...face(u + 0.18, v))
  g.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: 2, color: C.woodDark })
  g.poly([x0, y0, x1, y1, x1, y1 + length, (x0 + x1) / 2, (y0 + y1) / 2 + length - 6, x0, y0 + length]).fill(color)
  const mx = (x0 + x1) / 2
  const my = (y0 + y1) / 2 + length * 0.42
  g.circle(mx, my, 3.2).fill(C.gold)
  g.poly([mx - 2.5, my - 3, mx, my - 6.5, mx + 2.5, my - 3]).fill(C.gold)
}

function wavingFlag(ctx: Ctx, px: number, py: number, pole: number, color: number) {
  const p = flag(ctx.g, px, py, pole, color)
  const cloth = new Graphics()
  cloth.poly([0, 0, 13, 2, 11, 5, 13, 8, 0, 8]).fill(color)
  cloth.position.set(p.x, p.y)
  ctx.view.addChild(cloth)
  const phase = px * 0.1
  ctx.anims.push((t) => {
    cloth.scale.x = 0.85 + Math.sin(t * 4 + phase) * 0.15
    cloth.skew.y = Math.sin(t * 3 + phase) * 0.08
  })
}

function star(g: Graphics, x: number, y: number, r: number, color: number) {
  const pts: number[] = []
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? r * 0.45 : r
    pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  g.poly(pts).fill(color)
}

function sparkleEmitter(view: Container, x: number, y: number, color: number): Anim {
  const bits = Array.from({ length: 6 }, (_, i) => {
    const s = new Graphics()
    star(s, 0, 0, 2.6, i % 2 ? color : 0xfff3c4)
    view.addChild(s)
    return { s, seed: i / 6 }
  })
  return (t) => {
    for (const b of bits) {
      const p = (t * 0.35 + b.seed) % 1
      b.s.position.set(x + Math.sin((b.seed + p) * 9) * 10, y - p * 28)
      b.s.alpha = Math.sin(p * Math.PI)
      b.s.rotation = p * 3
    }
  }
}

