import type { Graphics } from 'pixi.js'
import { isoFlat, isoPoly } from './iso'
import { PAL, shade } from './palette'

/** Reusable isometric building blocks for world art kits. Coordinates are tiles (x, y) and pixels up (z). */
export type V3 = [number, number, number]
export type Face = (u: number, v: number) => V3

export interface Footprint {
  x: number
  y: number
  n: number
}

/** Left face runs along +y (bottom-left on screen), right face along +x (bottom-right); both face the viewer. */
export function faces({ x, y, n }: Footprint): { left: Face; right: Face } {
  return { left: (u, v) => [x + u, y + n, v], right: (u, v) => [x + n, y + n - u, v] }
}

export const quad = (face: Face, u0: number, u1: number, v0: number, v1: number) => isoPoly(face(u0, v0), face(u1, v0), face(u1, v1), face(u0, v1))

export function groundShadow(g: Graphics, { x, y, n }: Footprint, spread = 0.08, alpha = 0.13) {
  g.poly(isoPoly([x - spread, y - spread, 0], [x + n + spread, y - spread, 0], [x + n + spread, y + n + spread, 0], [x - spread, y + n + spread, 0])).fill({ color: PAL.shadow, alpha })
}

/** Two visible walls with a darker plinth; the right face is shaded as if lit from the left. */
export function walls(g: Graphics, fp: Footprint, h: number, color: number, plinth = shade(color, -0.22)) {
  const { left, right } = faces(fp)
  g.poly(quad(left, 0, fp.n, 0, h)).fill(color)
  g.poly(quad(right, 0, fp.n, 0, h)).fill(shade(color, -0.13))
  g.poly(quad(left, 0, fp.n, 0, 5)).fill(plinth)
  g.poly(quad(right, 0, fp.n, 0, 5)).fill(shade(plinth, -0.1))
}

/** Stone courses: staggered joints that read as masonry at any zoom. */
export function masonry(g: Graphics, fp: Footprint, h0: number, h1: number, color: number) {
  const { left, right } = faces(fp)
  for (const [face, a] of [
    [left, 0.28],
    [right, 0.34],
  ] as const) {
    for (let v = h0 + 7, row = 0; v < h1; v += 7, row++) {
      g.moveTo(...isoFlat(...face(0, v))).lineTo(...isoFlat(...face(fp.n, v))).stroke({ width: 1, color: shade(color, -0.3), alpha: a })
      for (let u = row % 2 ? 0.2 : 0.45; u < fp.n; u += 0.5) g.moveTo(...isoFlat(...face(u, v - 7))).lineTo(...isoFlat(...face(u, v))).stroke({ width: 1, color: shade(color, -0.3), alpha: a * 0.8 })
    }
  }
}

/** Dark timber beams over plaster: posts, a mid rail and diagonal braces. */
export function timberFrame(g: Graphics, fp: Footprint, h: number, beam: number) {
  const { left, right } = faces(fp)
  for (const [face, s] of [
    [left, 0],
    [right, -0.15],
  ] as const) {
    const c = shade(beam, s)
    for (let u = 0; u <= fp.n + 0.001; u += fp.n / (fp.n > 2 ? 3 : 2)) g.poly(quad(face, Math.max(0, u - 0.05), Math.min(fp.n, u + 0.05), 5, h)).fill(c)
    g.poly(quad(face, 0, fp.n, h * 0.5 - 1.5, h * 0.5 + 1.5)).fill(c)
    g.poly(quad(face, 0, fp.n, h - 3, h)).fill(c)
    const step = fp.n / (fp.n > 2 ? 3 : 2)
    for (let u = 0; u < fp.n - 0.01; u += step) {
      g.moveTo(...isoFlat(...face(u + 0.05, h * 0.5))).lineTo(...isoFlat(...face(u + step - 0.05, h - 3))).stroke({ width: 2.2, color: c })
    }
  }
}

export type RoofTexture = 'thatch' | 'tiles' | 'slate'

export interface RoofSpec {
  h: number
  rise: number
  ridge: 'x' | 'y'
  color: number
  texture: RoofTexture
  overhang?: number
  gable: number
}

/** Gable roof with a lit front plane, a shaded end and a texture that reads as thatch, tiles or slate. */
export function gableRoof(g: Graphics, fp: Footprint, s: RoofSpec) {
  const { x, y, n } = fp
  const o = s.overhang ?? (s.texture === 'thatch' ? 0.2 : 0.12)
  const H = s.h
  const R = s.rise
  const edge = shade(s.color, -0.32)
  const thick = s.texture === 'thatch' ? 6 : 3
  const lines = (count: number, along: (t: number) => [V3, V3]) => {
    for (let k = 1; k < count; k++) {
      const [a, b] = along(k / count)
      g.moveTo(...isoFlat(...a)).lineTo(...isoFlat(...b)).stroke({ width: s.texture === 'thatch' ? 1.4 : 1, color: edge, alpha: s.texture === 'slate' ? 0.35 : 0.28 })
    }
  }
  if (s.ridge === 'x') {
    const my = y + n / 2
    g.poly(isoPoly([x + n, y, H], [x + n, y + n, H], [x + n, my, H + R])).fill(s.gable)
    g.poly(isoPoly([x - o, y - o, H], [x + n + o, y - o, H], [x + n + o, my, H + R], [x - o, my, H + R])).fill(shade(s.color, 0.1))
    g.poly(isoPoly([x - o, y + n + o, H], [x + n + o, y + n + o, H], [x + n + o, my, H + R], [x - o, my, H + R])).fill(s.color)
    lines(s.texture === 'thatch' ? 5 : 6, (t) => {
      const yy = my + (y + n + o - my) * t
      const zz = H + R - R * t
      return [
        [x - o, yy, zz],
        [x + n + o, yy, zz],
      ]
    })
    if (s.texture === 'tiles')
      for (let k = 1; k < n * 5; k++) {
        const xx = x - o + ((n + 2 * o) * k) / (n * 5)
        g.moveTo(...isoFlat(xx, my, H + R)).lineTo(...isoFlat(xx, y + n + o, H)).stroke({ width: 1, color: edge, alpha: 0.18 })
      }
    band(g, [x + n + o, y - o, H], [x + n + o, my, H + R], shade(s.color, -0.18), thick)
    band(g, [x + n + o, my, H + R], [x + n + o, y + n + o, H], shade(s.color, -0.18), thick)
    g.poly(isoPoly([x - o, y + n + o, H], [x + n + o, y + n + o, H], [x + n + o, y + n + o, H - thick], [x - o, y + n + o, H - thick])).fill(edge)
    g.moveTo(...isoFlat(x - o, my, H + R)).lineTo(...isoFlat(x + n + o, my, H + R)).stroke({ width: s.texture === 'thatch' ? 4 : 2.5, color: shade(s.color, s.texture === 'thatch' ? -0.12 : 0.28), cap: 'round' })
  } else {
    const mx = x + n / 2
    g.poly(isoPoly([x, y + n, H], [x + n, y + n, H], [mx, y + n, H + R])).fill(s.gable)
    g.poly(isoPoly([x - o, y - o, H], [x - o, y + n + o, H], [mx, y + n + o, H + R], [mx, y - o, H + R])).fill(shade(s.color, 0.1))
    g.poly(isoPoly([x + n + o, y - o, H], [x + n + o, y + n + o, H], [mx, y + n + o, H + R], [mx, y - o, H + R])).fill(shade(s.color, -0.07))
    lines(s.texture === 'thatch' ? 5 : 6, (t) => {
      const xx = mx + (x + n + o - mx) * t
      const zz = H + R - R * t
      return [
        [xx, y - o, zz],
        [xx, y + n + o, zz],
      ]
    })
    band(g, [x - o, y + n + o, H], [mx, y + n + o, H + R], shade(s.color, -0.12), thick)
    band(g, [mx, y + n + o, H + R], [x + n + o, y + n + o, H], shade(s.color, -0.12), thick)
    g.poly(isoPoly([x + n + o, y - o, H], [x + n + o, y + n + o, H], [x + n + o, y + n + o, H - thick], [x + n + o, y - o, H - thick])).fill(edge)
    g.moveTo(...isoFlat(mx, y - o, H + R)).lineTo(...isoFlat(mx, y + n + o, H + R)).stroke({ width: s.texture === 'thatch' ? 4 : 2.5, color: shade(s.color, s.texture === 'thatch' ? -0.12 : 0.28), cap: 'round' })
  }
}

function band(g: Graphics, a: V3, b: V3, color: number, t: number) {
  g.poly(isoPoly(a, b, [b[0], b[1], b[2] - t], [a[0], a[1], a[2] - t])).fill(color)
}

/** Battlements along the two front edges of a flat top at height h. */
export function crenellations(g: Graphics, fp: Footprint, h: number, color: number) {
  const { x, y, n } = fp
  g.poly(isoPoly([x, y, h], [x + n, y, h], [x + n, y + n, h], [x, y + n, h])).fill(shade(color, -0.35))
  const merlon = (cx: number, cy: number) => {
    const w = 0.16
    g.poly(isoPoly([cx - w, cy + w, h], [cx + w, cy + w, h], [cx + w, cy + w, h + 8], [cx - w, cy + w, h + 8])).fill(color)
    g.poly(isoPoly([cx + w, cy + w, h], [cx + w, cy - w, h], [cx + w, cy - w, h + 8], [cx + w, cy + w, h + 8])).fill(shade(color, -0.14))
    g.poly(isoPoly([cx - w, cy - w, h + 8], [cx + w, cy - w, h + 8], [cx + w, cy + w, h + 8], [cx - w, cy + w, h + 8])).fill(shade(color, 0.12))
  }
  for (let k = 0.2; k < n; k += 0.5) merlon(x + k, y + 0.2)
  for (let k = 0.2; k < n; k += 0.5) merlon(x + 0.2, y + k)
  for (let k = 0.2; k < n; k += 0.5) merlon(x + k, y + n - 0.2)
  for (let k = 0.2; k < n; k += 0.5) merlon(x + n - 0.2, y + k)
}

/** Round tower: shaded vertical bands give the cylinder its roundness. */
export function cylinder(g: Graphics, cx: number, cy: number, r: number, z0: number, z1: number, color: number) {
  const [bx, by] = isoFlat(cx, cy, z0)
  const [, ty] = isoFlat(cx, cy, z1)
  const rx = r * 45.25
  const ry = r * 22.6
  const bands = 7
  for (let i = 0; i < bands; i++) {
    const a = -rx + (2 * rx * i) / bands
    const b = -rx + (2 * rx * (i + 1)) / bands
    const mid = (a + b) / 2 / rx
    const c = shade(color, mid < 0 ? 0.04 * (1 + mid) : -0.2 * mid)
    const ya = Math.sqrt(Math.max(0, 1 - (a / rx) ** 2)) * ry
    const yb = Math.sqrt(Math.max(0, 1 - (b / rx) ** 2)) * ry
    g.poly([bx + a, ty + ya, bx + b, ty + yb, bx + b, by + yb, bx + a, by + ya]).fill(c)
  }
  g.ellipse(bx, ty, rx, ry).fill(shade(color, 0.1))
  return { rx, ry, top: { x: bx, y: ty } }
}

/** Conical roof sitting on an ellipse, lit on its left flank. */
export function cone(g: Graphics, cx: number, cy: number, baseZ: number, r: number, height: number, color: number) {
  const [bx, by] = isoFlat(cx, cy, baseZ)
  const rx = r * 45.25
  const ry = r * 22.6
  g.ellipse(bx, by, rx, ry).fill(shade(color, -0.25))
  g.poly([bx - rx, by, bx, by - height, bx, by + ry]).fill(shade(color, 0.06))
  g.poly([bx, by - height, bx + rx, by, bx, by + ry]).fill(shade(color, -0.12))
  return { x: bx, y: by - height }
}

export interface WindowSpec {
  w?: number
  h?: number
  frame: number
  glass?: number
  glow?: boolean
  arched?: boolean
  shutters?: number
  shade?: number
}

/** Draws a window and returns its center, so lit windows can also cast light at night. */
export function windowOn(g: Graphics, face: Face, u: number, v: number, s: WindowSpec) {
  const w = s.w ?? 0.18
  const h = s.h ?? 11
  const sh = s.shade ?? 0
  if (s.shutters !== undefined) {
    g.poly(quad(face, u - w - 0.1, u - w, v - h / 2, v + h / 2)).fill(shade(s.shutters, sh))
    g.poly(quad(face, u + w, u + w + 0.1, v - h / 2, v + h / 2)).fill(shade(s.shutters, sh))
  }
  g.poly(quad(face, u - w - 0.03, u + w + 0.03, v - h / 2 - 1.5, v + h / 2 + 1.5)).fill(shade(s.frame, sh))
  const glass = s.glow ? 0xffd98a : (s.glass ?? 0x6f8fa3)
  g.poly(quad(face, u - w + 0.02, u + w - 0.02, v - h / 2, v + h / 2)).fill(shade(glass, s.glow ? 0 : sh))
  if (s.arched) {
    const [ax, ay] = isoFlat(...face(u, v + h / 2))
    g.ellipse(ax, ay, w * 30, 4).fill(shade(s.frame, sh))
    g.ellipse(ax, ay + 0.5, w * 24, 3).fill(shade(glass, s.glow ? 0 : sh))
  }
  g.moveTo(...isoFlat(...face(u, v - h / 2))).lineTo(...isoFlat(...face(u, v + h / 2))).stroke({ width: 1, color: shade(s.frame, sh), alpha: 0.9 })
  g.moveTo(...isoFlat(...face(u - w, v))).lineTo(...isoFlat(...face(u + w, v))).stroke({ width: 1, color: shade(s.frame, sh), alpha: 0.9 })
  const [cx, cy] = isoFlat(...face(u, v))
  return { x: cx, y: cy }
}

export function doorOn(g: Graphics, face: Face, u: number, w: number, h: number, color: number, frame: number, arched = true) {
  g.poly(quad(face, u - w / 2 - 0.06, u + w / 2 + 0.06, 0, h + 3)).fill(frame)
  g.poly(quad(face, u - w / 2, u + w / 2, 0, h)).fill(color)
  if (arched) {
    const [ax, ay] = isoFlat(...face(u, h))
    g.ellipse(ax, ay, w * 30, 5).fill(color)
  }
  for (const k of [-0.25, 0.25]) g.moveTo(...isoFlat(...face(u + k * w, 1))).lineTo(...isoFlat(...face(u + k * w, h - 1))).stroke({ width: 1, color: shade(color, -0.3), alpha: 0.7 })
  g.circle(...isoFlat(...face(u + w * 0.3, h * 0.45)), 1.2).fill(0xe8c170)
}

/** A square chimney standing on a roof at height `base`; returns the screen point where smoke starts. */
export function chimney(g: Graphics, cx: number, cy: number, base: number, color = 0x9c8f82, tall = 16) {
  const w = 0.14
  const top = base + tall
  g.poly(isoPoly([cx - w, cy + w, base], [cx + w, cy + w, base], [cx + w, cy + w, top], [cx - w, cy + w, top])).fill(color)
  g.poly(isoPoly([cx + w, cy + w, base], [cx + w, cy - w, base], [cx + w, cy - w, top], [cx + w, cy + w, top])).fill(shade(color, -0.16))
  g.poly(isoPoly([cx - w - 0.03, cy - w - 0.03, top], [cx + w + 0.03, cy - w - 0.03, top], [cx + w + 0.03, cy + w + 0.03, top], [cx - w - 0.03, cy + w + 0.03, top])).fill(shade(color, -0.35))
  const [sx, sy] = isoFlat(cx, cy, top)
  return { x: sx, y: sy }
}

/** A small flag on a pole; returns the cloth so callers can make it wave. */
export function flag(g: Graphics, px: number, py: number, pole: number, color: number) {
  g.moveTo(px, py).lineTo(px, py - pole).stroke({ width: 1.6, color: 0x4f4a44 })
  g.circle(px, py - pole, 1.6).fill(0xe8c170)
  return { x: px + 0.5, y: py - pole + 1, color }
}
