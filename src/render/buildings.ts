import { Container, Graphics } from 'pixi.js'
import type { Building } from '../sim/types'
import { isoFlat, isoPoly } from './iso'
import { PAL, shade } from './palette'

type V3 = [number, number, number]

interface Spec {
  wallH: number
  roofH: number
  ridge: 'x' | 'y'
  wall: number
  roof: number
  overhang: number
}

function specFor(b: Building): Spec {
  const wall = PAL.wall[b.palette % PAL.wall.length]
  const roof = PAL.roof[b.palette % PAL.roof.length]
  switch (b.kind) {
    case 'townhall':
      return { wallH: 52, roofH: 30, ridge: 'x', wall: 0xf1e8da, roof: 0x8ea8c4, overhang: 0.1 }
    case 'shop':
      return { wallH: 38, roofH: 28, ridge: 'y', wall, roof: 0x8fb08a, overhang: 0.12 }
    case 'cafe':
      return { wallH: 34, roofH: 26, ridge: 'x', wall: 0xf6e7d6, roof: 0xd98b6a, overhang: 0.12 }
    case 'bakery':
      return { wallH: 34, roofH: 26, ridge: 'y', wall: 0xf7ecdd, roof: 0xe3b865, overhang: 0.12 }
    case 'cabin':
      return { wallH: 28, roofH: 26, ridge: 'x', wall: PAL.wood, roof: 0x7d6b5c, overhang: 0.14 }
    default:
      return { wallH: 32, roofH: 28, ridge: b.palette % 2 ? 'y' : 'x', wall, roof, overhang: 0.12 }
  }
}

export interface BuildingSprite {
  view: Container
  depth: number
  chimneys: { x: number; y: number }[]
  flag?: Graphics
}

export function drawBuilding(b: Building): BuildingSprite {
  const s = specFor(b)
  const g = new Graphics()
  const { x, y, size: n } = b
  const H = s.wallH
  const leftFace = (u: number, v: number): V3 => [x + u, y + n, v]
  const rightFace = (u: number, v: number): V3 => [x + n, y + n - u, v]
  const panel = (face: typeof leftFace, u0: number, u1: number, v0: number, v1: number) =>
    isoPoly(face(u0, v0), face(u1, v0), face(u1, v1), face(u0, v1))

  const foot = 0.06
  g.poly(isoPoly([x - foot, y - foot, 0], [x + n + foot, y - foot, 0], [x + n + foot, y + n + foot, 0], [x - foot, y + n + foot, 0])).fill({
    color: PAL.shadow,
    alpha: 0.12,
  })
  g.poly(panel(leftFace, 0, n, 0, H)).fill(s.wall)
  g.poly(panel(rightFace, 0, n, 0, H)).fill(shade(s.wall, -0.12))
  g.poly(panel(leftFace, 0, n, 0, 4)).fill(shade(s.wall, -0.2))
  g.poly(panel(rightFace, 0, n, 0, 4)).fill(shade(s.wall, -0.3))

  if (b.kind === 'cabin') {
    for (let v = 6; v < H; v += 6) {
      g.moveTo(...isoFlat(...leftFace(0, v))).lineTo(...isoFlat(...leftFace(n, v))).stroke({ width: 1, color: PAL.woodDark, alpha: 0.5 })
      g.moveTo(...isoFlat(...rightFace(0, v))).lineTo(...isoFlat(...rightFace(n, v))).stroke({ width: 1, color: PAL.woodDark, alpha: 0.6 })
    }
  }

  const doorFace = b.doorSide === 'left' ? leftFace : rightFace
  const otherFace = b.doorSide === 'left' ? rightFace : leftFace
  const mid = Math.floor(n / 2) + 0.5
  const doorW = b.kind === 'townhall' ? 0.5 : 0.36
  const doorH = b.kind === 'townhall' ? 26 : 20
  g.poly(panel(doorFace, mid - doorW / 2 - 0.05, mid + doorW / 2 + 0.05, 0, doorH + 3)).fill(shade(s.wall, -0.25))
  g.poly(panel(doorFace, mid - doorW / 2, mid + doorW / 2, 0, doorH)).fill(PAL.door)
  g.circle(...isoFlat(...doorFace(mid + doorW / 2 - 0.07, doorH * 0.45)), 1.1).fill(0xe8c170)

  const windowRow = (face: typeof leftFace, faceShade: number, skip?: number) => {
    const count = n === 3 ? 3 : 2
    for (let i = 0; i < count; i++) {
      const u = (i + 0.5) * (n / count)
      if (skip !== undefined && Math.abs(u - skip) < 0.5) continue
      drawWindow(g, face, u, H * 0.42, faceShade, s.roof)
      if (b.kind === 'townhall') drawWindow(g, face, u, H * 0.78, faceShade, s.roof)
    }
  }
  windowRow(doorFace, b.doorSide === 'left' ? 0 : -0.12, mid)
  windowRow(otherFace, b.doorSide === 'left' ? -0.12 : 0)

  if (b.kind === 'cafe' || b.kind === 'bakery' || b.kind === 'shop') {
    const stripe = b.kind === 'cafe' ? 0xd98b6a : b.kind === 'bakery' ? 0xe3b865 : 0x8fb08a
    drawAwning(g, doorFace, 0.15, n - 0.15, H * 0.62, stripe, b.doorSide === 'left' ? 'left' : 'right', x, y, n)
  }

  const chimneys = drawRoof(g, b, s)

  const view = new Container()
  view.addChild(g)
  let flag: Graphics | undefined
  if (b.kind === 'townhall') flag = drawTower(view, b, s)

  return { view, depth: x + y + n, chimneys, flag }
}

function drawWindow(g: Graphics, face: (u: number, v: number) => V3, u: number, v: number, faceShade: number, trim: number) {
  const w = 0.2
  const h = 11
  const quad = (u0: number, u1: number, v0: number, v1: number) => isoPoly(face(u0, v0), face(u1, v0), face(u1, v1), face(u0, v1))
  g.poly(quad(u - w - 0.1, u - w, v - h / 2, v + h / 2)).fill(shade(trim, faceShade))
  g.poly(quad(u + w, u + w + 0.1, v - h / 2, v + h / 2)).fill(shade(trim, faceShade))
  g.poly(quad(u - w, u + w, v - h / 2 - 1.5, v + h / 2 + 1.5)).fill(shade(0xffffff, faceShade * 0.6))
  g.poly(quad(u - w + 0.03, u + w - 0.03, v - h / 2, v + h / 2)).fill(shade(PAL.glass, faceShade))
  g.poly(quad(u - w + 0.03, u - 0.02, v, v + h / 2)).fill({ color: PAL.glassLight, alpha: 0.55 })
  g.poly(quad(u - w - 0.02, u + w + 0.02, v - h / 2 - 3, v - h / 2 - 1.5)).fill(shade(0xffffff, faceShade - 0.08))
}

function drawAwning(
  g: Graphics,
  face: (u: number, v: number) => V3,
  u0: number,
  u1: number,
  v: number,
  color: number,
  side: 'left' | 'right',
  x: number,
  y: number,
  n: number,
) {
  const depth = 0.32
  const out = (u: number, vv: number): V3 => {
    const p = face(u, vv)
    return side === 'left' ? [p[0], y + n + depth, vv - 7] : [x + n + depth, p[1], vv - 7]
  }
  const stripes = 7
  for (let i = 0; i < stripes; i++) {
    const a = u0 + ((u1 - u0) * i) / stripes
    const b = u0 + ((u1 - u0) * (i + 1)) / stripes
    const c = i % 2 ? 0xfaf3e8 : color
    g.poly(isoPoly(face(a, v), face(b, v), out(b, v), out(a, v))).fill(side === 'right' ? shade(c, -0.08) : c)
    const [bx, by] = isoFlat(...out(a, v))
    const [ex, ey] = isoFlat(...out(b, v))
    g.moveTo(bx, by).quadraticCurveTo((bx + ex) / 2, (by + ey) / 2 + 4, ex, ey).lineTo(bx, by).fill(side === 'right' ? shade(c, -0.12) : shade(c, -0.05))
  }
}

function drawRoof(g: Graphics, b: Building, s: Spec) {
  const { x, y, size: n } = b
  const o = s.overhang
  const H = s.wallH
  const R = s.roofH
  const front = s.roof
  const back = shade(s.roof, 0.12)
  const side = shade(s.roof, -0.18)
  const edge = shade(s.roof, -0.3)
  const chimneys: { x: number; y: number }[] = []

  if (s.ridge === 'x') {
    const my = y + n / 2
    g.poly(isoPoly([x + n, y, H], [x + n, y + n, H], [x + n, my, H + R])).fill(shade(s.wall, -0.12))
    g.poly(isoPoly([x - o, y - o, H], [x + n + o, y - o, H], [x + n + o, my, H + R], [x - o, my, H + R])).fill(back)
    const frontPoly = isoPoly([x - o, y + n + o, H], [x + n + o, y + n + o, H], [x + n + o, my, H + R], [x - o, my, H + R])
    g.poly(frontPoly).fill(front)
    for (let k = 1; k < 4; k++) {
      const t = k / 4
      const yy = my + (y + n + o - my) * t
      const zz = H + R - R * t
      g.moveTo(...isoFlat(x - o, yy, zz)).lineTo(...isoFlat(x + n + o, yy, zz)).stroke({ width: 1, color: edge, alpha: 0.25 })
    }
    band(g, [x + n + o, y - o, H], [x + n + o, my, H + R], side)
    band(g, [x + n + o, my, H + R], [x + n + o, y + n + o, H], side)
    g.poly(isoPoly([x - o, y + n + o, H], [x + n + o, y + n + o, H], [x + n + o, y + n + o, H - 3], [x - o, y + n + o, H - 3])).fill(edge)
    g.moveTo(...isoFlat(x - o, my, H + R)).lineTo(...isoFlat(x + n + o, my, H + R)).stroke({ width: 2, color: shade(s.roof, 0.3) })
    if (b.kind === 'house' || b.kind === 'cabin' || b.kind === 'bakery' || b.kind === 'cafe')
      chimneys.push(drawChimney(g, x + n * 0.72, y + n * 0.3, H + R * 0.6))
  } else {
    const mx = x + n / 2
    g.poly(isoPoly([x, y + n, H], [x + n, y + n, H], [mx, y + n, H + R])).fill(s.wall)
    g.poly(isoPoly([x - o, y - o, H], [x - o, y + n + o, H], [mx, y + n + o, H + R], [mx, y - o, H + R])).fill(back)
    g.poly(isoPoly([x + n + o, y - o, H], [x + n + o, y + n + o, H], [mx, y + n + o, H + R], [mx, y - o, H + R])).fill(shade(front, -0.06))
    for (let k = 1; k < 4; k++) {
      const t = k / 4
      const xx = mx + (x + n + o - mx) * t
      const zz = H + R - R * t
      g.moveTo(...isoFlat(xx, y - o, zz)).lineTo(...isoFlat(xx, y + n + o, zz)).stroke({ width: 1, color: edge, alpha: 0.25 })
    }
    band(g, [x - o, y + n + o, H], [mx, y + n + o, H + R], side)
    band(g, [mx, y + n + o, H + R], [x + n + o, y + n + o, H], side)
    g.poly(isoPoly([x + n + o, y - o, H], [x + n + o, y + n + o, H], [x + n + o, y + n + o, H - 3], [x + n + o, y - o, H - 3])).fill(edge)
    g.moveTo(...isoFlat(mx, y - o, H + R)).lineTo(...isoFlat(mx, y + n + o, H + R)).stroke({ width: 2, color: shade(s.roof, 0.3) })
    if (b.kind === 'house' || b.kind === 'bakery') chimneys.push(drawChimney(g, x + n * 0.3, y + n * 0.3, H + R * 0.6))
  }
  return chimneys
}

function band(g: Graphics, a: V3, b: V3, color: number) {
  g.poly(isoPoly(a, b, [b[0], b[1], b[2] - 3], [a[0], a[1], a[2] - 3])).fill(color)
}

function drawChimney(g: Graphics, cx: number, cy: number, base: number) {
  const w = 0.14
  const top = base + 16
  const color = 0xc98f75
  g.poly(isoPoly([cx - w, cy + w, base], [cx + w, cy + w, base], [cx + w, cy + w, top], [cx - w, cy + w, top])).fill(color)
  g.poly(isoPoly([cx + w, cy + w, base], [cx + w, cy - w, base], [cx + w, cy - w, top], [cx + w, cy + w, top])).fill(shade(color, -0.15))
  g.poly(isoPoly([cx - w - 0.03, cy - w - 0.03, top], [cx + w + 0.03, cy - w - 0.03, top], [cx + w + 0.03, cy + w + 0.03, top], [cx - w - 0.03, cy + w + 0.03, top])).fill(shade(color, -0.3))
  const [sx, sy] = isoFlat(cx, cy, top)
  return { x: sx, y: sy }
}

function drawTower(view: Container, b: Building, s: Spec) {
  const g = new Graphics()
  const cx = b.x + b.size / 2
  const cy = b.y + b.size / 2
  const w = 0.42
  const base = s.wallH + s.roofH * 0.5
  const top = base + 34
  const wall = 0xf4ecdf
  g.poly(isoPoly([cx - w, cy + w, base], [cx + w, cy + w, base], [cx + w, cy + w, top], [cx - w, cy + w, top])).fill(wall)
  g.poly(isoPoly([cx + w, cy + w, base], [cx + w, cy - w, base], [cx + w, cy - w, top], [cx + w, cy + w, top])).fill(shade(wall, -0.12))
  const [clx, cly] = isoFlat(cx, cy + w, top - 14)
  g.ellipse(clx - 12, cly + 6, 6.5, 7.5).fill(0xfffaf0).stroke({ width: 1.5, color: 0x8ea8c4 })
  g.moveTo(clx - 12, cly + 6).lineTo(clx - 12, cly + 1.5).stroke({ width: 1.2, color: PAL.ink })
  g.moveTo(clx - 12, cly + 6).lineTo(clx - 9, cly + 7).stroke({ width: 1.2, color: PAL.ink })
  const p = 0.08
  g.poly(isoPoly([cx - w - p, cy - w - p, top], [cx + w + p, cy - w - p, top], [cx, cy, top + 26])).fill(shade(s.roof, 0.12))
  g.poly(isoPoly([cx - w - p, cy + w + p, top], [cx + w + p, cy + w + p, top], [cx, cy, top + 26])).fill(s.roof)
  g.poly(isoPoly([cx + w + p, cy + w + p, top], [cx + w + p, cy - w - p, top], [cx, cy, top + 26])).fill(shade(s.roof, -0.18))
  const [fx, fy] = isoFlat(cx, cy, top + 26)
  g.moveTo(fx, fy).lineTo(fx, fy - 18).stroke({ width: 1.5, color: PAL.lamp })
  view.addChild(g)

  const flag = new Graphics()
  flag.poly([0, 0, 13, 3, 0, 7]).fill(PAL.accent)
  flag.position.set(fx + 0.5, fy - 18)
  view.addChild(flag)
  return flag
}
