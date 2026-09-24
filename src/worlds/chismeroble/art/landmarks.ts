import { Container, Graphics } from 'pixi.js'
import type { Landmark } from '../../../core/world/types'
import type { ArtSprite } from '../../../render/art'
import { iso, isoFlat, isoPoly } from '../../../render/iso'
import { shade } from '../../../render/palette'
import { C } from './palette'

export function drawLandmark(l: Landmark): ArtSprite {
  if (l.kind === 'guard-post') return guardPost(l)
  return l.kind === 'crypt' ? crypt(l) : greatOak(l)
}

/** A timber watch post on a stone footing, with a brazier that burns through the night. */
function guardPost(l: Landmark): ArtSprite {
  const view = new Container()
  const g = new Graphics()
  view.addChild(g)
  const { x, y, size: n } = l
  const box = (x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, top: number, left: number, right: number) => {
    g.poly(isoPoly([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1])).fill(left)
    g.poly(isoPoly([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1])).fill(right)
    g.poly(isoPoly([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1])).fill(top)
  }
  g.poly(isoPoly([x - 0.1, y - 0.1, 0], [x + n + 0.1, y - 0.1, 0], [x + n + 0.1, y + n + 0.1, 0], [x - 0.1, y + n + 0.1, 0])).fill({ color: C.shadow, alpha: 0.15 })
  box(x + 0.1, y + 0.1, x + n - 0.1, y + n - 0.1, 0, 10, C.stone, shade(C.stone, -0.12), shade(C.stone, -0.22))
  const [ix0, iy0, ix1, iy1] = [x + 0.35, y + 0.35, x + n - 0.35, y + n - 0.35]
  box(ix0, iy0, ix1, iy1, 10, 52, C.wood, shade(C.wood, -0.1), shade(C.wood, -0.24))
  for (let k = 1; k < 4; k++) {
    const u = ix0 + ((ix1 - ix0) * k) / 4
    g.moveTo(...isoFlat(u, iy1, 12)).lineTo(...isoFlat(u, iy1, 50)).stroke({ width: 1, color: C.woodDark, alpha: 0.5 })
    const v = iy0 + ((iy1 - iy0) * k) / 4
    g.moveTo(...isoFlat(ix1, v, 12)).lineTo(...isoFlat(ix1, v, 50)).stroke({ width: 1, color: C.woodDark, alpha: 0.5 })
  }
  const [wx, wy] = isoFlat((ix0 + ix1) / 2, iy1, 40)
  g.rect(wx - 3, wy - 5, 6, 7).fill(0x3a2e26)
  box(x + 0.15, y + 0.15, x + n - 0.15, y + n - 0.15, 52, 56, shade(C.wood, 0.08), C.woodDark, shade(C.woodDark, -0.15))
  const [cx, cy] = isoFlat(x + n / 2, y + n / 2, 56)
  const peak = cy - 22
  const [lx, ly] = isoFlat(x + 0.15, y + n - 0.15, 56)
  const [rx, ry] = isoFlat(x + n - 0.15, y + 0.15, 56)
  const [fx, fy] = isoFlat(x + n - 0.15, y + n - 0.15, 56)
  g.poly([lx, ly, fx, fy, cx, peak]).fill(C.tiles)
  g.poly([fx, fy, rx, ry, cx, peak]).fill(shade(C.tiles, -0.2))
  g.moveTo(cx, peak).lineTo(cx, peak - 16).stroke({ width: 1.4, color: C.woodDark })
  const flag = new Graphics().poly([0, 0, 12, 3, 0, 7]).fill(C.crimson)
  flag.position.set(cx + 0.7, peak - 16)
  view.addChild(flag)

  const [bx, by] = isoFlat(x + n - 0.22, y + n - 0.22, 10)
  g.rect(bx - 1, by - 16, 2, 16).fill(C.iron)
  g.poly([bx - 6, by - 18, bx + 6, by - 18, bx + 4, by - 13, bx - 4, by - 13]).fill(C.iron)
  const fire = new Graphics()
  fire.poly([-4, 0, 0, -10, 4, 0]).fill(C.fire)
  fire.poly([-2, 0, 0, -6, 2, 0]).fill(0xffe08a)
  fire.position.set(bx, by - 18)
  view.addChild(fire)
  return {
    view,
    depth: x + y + n,
    glows: [{ x: bx, y: by - 24, r: 64, color: C.fire }],
    update: (t) => {
      flag.skew.y = Math.sin(t * 2.6) * 0.14
      fire.scale.set(1 + Math.sin(t * 12) * 0.1, 1 + Math.sin(t * 15) * 0.15)
    },
  }
}

/** The gossiping oak at the heart of the plaza, with a notice board and lanterns. */
function greatOak(l: Landmark): ArtSprite {
  const c = iso(l.x + l.size / 2, l.y + l.size / 2)
  const view = new Container()
  view.position.set(c.x, c.y)
  const g = new Graphics()
  view.addChild(g)
  g.ellipse(0, 6, 78, 36).fill({ color: C.shadow, alpha: 0.12 })
  g.ellipse(0, 0, 44, 20).fill(0xb5ac9c)
  g.ellipse(0, -2, 40, 18).fill(0x8fae78)
  for (const [ox, oy, r] of [
    [-22, 2, 9],
    [20, 3, 8],
    [-6, 8, 7],
    [10, 8, 6],
  ])
    g.ellipse(ox, oy - 2, r * 1.7, r * 0.8).fill(shade(C.trunk, -0.12))
  g.poly([-17, 4, -12, -62, 12, -62, 18, 4]).fill(C.trunk)
  g.poly([3, 4, 4, -62, 12, -62, 18, 4]).fill(shade(C.trunk, -0.2))
  for (let i = 0; i < 5; i++) g.moveTo(-10 + i * 5, -2).quadraticCurveTo(-11 + i * 5, -30, -8 + i * 4, -58).stroke({ width: 1, color: shade(C.trunk, -0.3), alpha: 0.35 })
  g.roundRect(-10, -36, 18, 16, 1.5).fill(C.wood).stroke({ width: 1.2, color: C.woodDark })
  for (const [px, py, rot] of [
    [-7, -34, -0.1],
    [0, -33, 0.08],
    [-4, -28, 0.05],
  ]) {
    const note = new Graphics().rect(0, 0, 6, 7).fill(0xfbf5e6)
    note.position.set(px, py)
    note.rotation = rot
    view.addChild(note)
  }
  const crown = new Container()
  crown.position.set(0, -58)
  const cg = new Graphics()
  const blobs: [number, number, number, number][] = [
    [-52, 6, 30, C.leaf[2]],
    [52, 8, 30, C.leaf[2]],
    [-34, -24, 36, C.leaf[0]],
    [36, -22, 36, C.leaf[1]],
    [0, -12, 38, C.leaf[3]],
    [-8, -50, 38, C.leaf[0]],
    [24, -48, 26, C.leaf[3]],
    [-20, -66, 16, C.leafLight],
  ]
  for (const [ox, oy, r, color] of blobs) cg.circle(ox, oy, r).fill(color)
  for (const [ox, oy] of [
    [-40, -34],
    [30, -58],
    [-4, -80],
    [46, -10],
  ])
    cg.circle(ox, oy, 2.5).fill(0xe0b24f)
  crown.addChild(cg)
  const lanterns = new Graphics()
  for (const [ox, oy] of [
    [-44, 30],
    [40, 34],
    [-12, 40],
  ]) {
    lanterns.moveTo(ox, oy - 16).lineTo(ox, oy - 4).stroke({ width: 1, color: C.woodDark })
    lanterns.circle(ox, oy, 9).fill({ color: C.glow, alpha: 0.22 })
    lanterns.roundRect(ox - 3, oy - 4, 6, 8, 2).fill(C.glow)
  }
  crown.addChild(lanterns)
  view.addChild(crown)
  return {
    view,
    depth: l.x + l.y + l.size,
    glows: [
      [-44, 30],
      [40, 34],
      [-12, 40],
    ].map(([ox, oy]) => ({ x: c.x + ox, y: c.y - 58 + oy, r: 40, color: C.glow })),
    update: (t, _dt, { night }) => {
      crown.skew.x = Math.sin(t * 0.8) * 0.015
      lanterns.alpha = 0.7 + night * 0.3 + Math.sin(t * 2.2) * 0.1
      lanterns.scale.set(1 + night * 0.08)
    },
  }
}

/** Ruined entrance to the Crypt of Whispers: stairs into darkness, broken pillars, glowing runes and mist. */
function crypt(l: Landmark): ArtSprite {
  const view = new Container()
  const g = new Graphics()
  view.addChild(g)
  const { x, y, size: n } = l
  const stone = 0xa9a49a
  g.poly(isoPoly([x - 0.1, y - 0.1, 0], [x + n + 0.1, y - 0.1, 0], [x + n + 0.1, y + n + 0.1, 0], [x - 0.1, y + n + 0.1, 0])).fill({ color: C.shadow, alpha: 0.15 })
  g.poly(isoPoly([x, y, 0], [x + n, y, 0], [x + n, y + n, 0], [x, y + n, 0])).fill(stone)
  g.poly(isoPoly([x, y + n, 0], [x + n, y + n, 0], [x + n, y + n, -5], [x, y + n, -5])).fill(shade(stone, -0.2))
  g.poly(isoPoly([x + n, y, 0], [x + n, y + n, 0], [x + n, y + n, -5], [x + n, y, -5])).fill(shade(stone, -0.3))
  const hole = isoPoly([x + 0.4, y + 0.5, 0], [x + n - 0.4, y + 0.5, 0], [x + n - 0.4, y + n - 0.3, 0], [x + 0.4, y + n - 0.3, 0])
  g.poly(hole).fill(0x1f1c24)
  for (let k = 1; k < 4; k++) {
    const yy = y + n - 0.3 - k * 0.25
    g.moveTo(...isoFlat(x + 0.4, yy, -k * 3)).lineTo(...isoFlat(x + n - 0.4, yy, -k * 3)).stroke({ width: 2, color: shade(stone, -0.45), alpha: 0.9 })
  }
  const pillar = (px: number, py: number, hgt: number) => {
    const w = 0.16
    g.poly(isoPoly([px - w, py + w, 0], [px + w, py + w, 0], [px + w, py + w, hgt], [px - w, py + w, hgt])).fill(stone)
    g.poly(isoPoly([px + w, py + w, 0], [px + w, py - w, 0], [px + w, py - w, hgt], [px + w, py + w, hgt])).fill(shade(stone, -0.15))
    g.poly(isoPoly([px - w, py - w, hgt], [px + w, py - w, hgt], [px + w, py + w, hgt], [px - w, py + w, hgt])).fill(shade(stone, 0.1))
  }
  pillar(x + 0.25, y + 0.35, 42)
  pillar(x + n - 0.25, y + 0.35, 26)
  const [ax, ay] = isoFlat(x + 0.25, y + 0.35, 42)
  const [bx, by] = isoFlat(x + n - 0.25, y + 0.35, 38)
  g.moveTo(ax, ay).quadraticCurveTo((ax + bx) / 2, ay - 16, bx - 18, by - 6).stroke({ width: 6, color: stone, cap: 'round' })
  const runes = new Graphics()
  for (const [rx, ry] of [
    [ax - 1, ay + 14],
    [bx - 1, by + 22],
  ])
    runes.moveTo(rx, ry).lineTo(rx + 2, ry + 5).lineTo(rx, ry + 10).moveTo(rx + 2, ry + 5).lineTo(rx + 4, ry + 3).stroke({ width: 1.3, color: 0x9fe3ff })
  view.addChild(runes)
  const mist = Array.from({ length: 6 }, (_, i) => {
    const m = new Graphics().ellipse(0, 0, 10, 5).fill({ color: 0xb8e6d4, alpha: 0.35 })
    view.addChild(m)
    return { m, seed: i / 6 }
  })
  const [hx, hy] = isoFlat(x + n / 2, y + n / 2 + 0.1, 0)
  return {
    view,
    depth: x + y + n,
    glows: [{ x: hx, y: hy - 6, r: 50, color: 0x7fe0c0 }],
    update: (t) => {
      runes.alpha = 0.4 + Math.max(0, Math.sin(t * 1.1)) * 0.6
      for (const p of mist) {
        const k = (t * 0.12 + p.seed) % 1
        p.m.position.set(hx + Math.sin((p.seed + k) * 7) * 14, hy - k * 26)
        p.m.alpha = Math.sin(k * Math.PI) * 0.8
        p.m.scale.set(0.8 + k * 1.2)
      }
    },
  }
}
