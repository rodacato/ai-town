import { Container, Graphics } from 'pixi.js'
import type { Landmark } from '../../../core/world/types'
import type { ArtSprite } from '../../../render/art'
import { iso, isoFlat, isoPoly } from '../../../render/iso'
import { shade } from '../../../render/palette'
import { C } from './palette'

export function drawLandmark(l: Landmark): ArtSprite {
  return l.kind === 'crypt' ? crypt(l) : greatOak(l)
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
