import { Graphics } from 'pixi.js'
import { hash2 } from '../core/world/rng'
import type { Tile } from '../core/world/types'
import type { World } from '../core/world/world'
import { ISLAND_DEPTH, iso, isoFlat, isoPoly } from './iso'
import { PAL, shade } from './palette'

type Edge = 'n' | 's' | 'e' | 'w'
const NEIGHBORS: [Edge, number, number][] = [
  ['n', 0, -1],
  ['s', 0, 1],
  ['e', 1, 0],
  ['w', -1, 0],
]

function edgeLine(x: number, y: number, edge: Edge): [number, number, number, number] {
  switch (edge) {
    case 'n':
      return [...isoFlat(x, y), ...isoFlat(x + 1, y)]
    case 's':
      return [...isoFlat(x, y + 1), ...isoFlat(x + 1, y + 1)]
    case 'e':
      return [...isoFlat(x + 1, y), ...isoFlat(x + 1, y + 1)]
    case 'w':
      return [...isoFlat(x, y), ...isoFlat(x, y + 1)]
  }
}

const diamond = (x: number, y: number) => isoPoly([x, y, 0], [x + 1, y, 0], [x + 1, y + 1, 0], [x, y + 1, 0])
const isPaved = (t?: Tile) => !!t && (t.kind === 'path' || t.kind === 'plaza' || t.kind === 'bridge')

export function drawTerrain(world: World) {
  const g = new Graphics()
  const N = world.size
  const at = (x: number, y: number) => world.tiles[y]?.[x]

  drawIslandShadow(g, N)
  drawIslandSides(g, world)

  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const t = world.tiles[y][x]
      const h = hash2(x, y)
      let color: number
      switch (t.kind) {
        case 'path':
          color = PAL.path[Math.floor(h * PAL.path.length)]
          break
        case 'plaza':
          color = PAL.plaza[(x + y) % 2]
          break
        case 'water':
          color = PAL.water
          break
        case 'bridge':
          color = PAL.bridge
          break
        case 'field':
          color = PAL.field
          break
        default:
          color = PAL.grass[Math.floor(h * PAL.grass.length)]
      }
      g.poly(diamond(x, y)).fill(color)
    }

  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const t = world.tiles[y][x]
      const h = hash2(x, y, 3)
      if (t.kind === 'grass' && !t.prop && h < 0.45) drawTuft(g, x + 0.2 + hash2(x, y, 5) * 0.6, y + 0.2 + hash2(x, y, 6) * 0.6)
      if (t.kind === 'path' && h < 0.35) {
        const p = iso(x + 0.25 + hash2(x, y, 7) * 0.5, y + 0.25 + hash2(x, y, 8) * 0.5)
        g.ellipse(p.x, p.y, 2.2, 1.2).fill(PAL.pebble)
      }
      if (t.kind === 'plaza') {
        g.moveTo(...isoFlat(x + 0.5, y)).lineTo(...isoFlat(x + 0.5, y + 1)).stroke({ width: 1, color: PAL.plazaLine, alpha: 0.7 })
        g.moveTo(...isoFlat(x, y + 0.5)).lineTo(...isoFlat(x + 1, y + 0.5)).stroke({ width: 1, color: PAL.plazaLine, alpha: 0.7 })
      }
      if (t.kind === 'field') {
        for (const k of [0.25, 0.5, 0.75])
          g.moveTo(...isoFlat(x, y + k)).lineTo(...isoFlat(x + 1, y + k)).stroke({ width: 1.5, color: PAL.fieldRow, alpha: 0.8 })
      }
      if (t.kind === 'bridge') {
        for (let k = 0.1; k < 1; k += 0.2)
          g.moveTo(...isoFlat(x + k, y)).lineTo(...isoFlat(x + k, y + 1)).stroke({ width: 1.2, color: PAL.bridgePlank, alpha: 0.9 })
      }
      if (t.kind === 'water') {
        const deep = NEIGHBORS.every(([, dx, dy]) => (at(x + dx, y + dy)?.kind ?? 'water') === 'water')
        if (deep) g.poly(isoPoly([x + 0.2, y + 0.2, 0], [x + 0.8, y + 0.2, 0], [x + 0.8, y + 0.8, 0], [x + 0.2, y + 0.8, 0])).fill({ color: PAL.waterDeep, alpha: 0.5 })
      }
    }

  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const t = world.tiles[y][x]
      for (const [edge, dx, dy] of NEIGHBORS) {
        const n = at(x + dx, y + dy)
        if (!n) continue
        if (t.kind === 'water' && n.kind !== 'water' && n.kind !== 'bridge') {
          const [x0, y0, x1, y1] = edgeLine(x, y, edge)
          g.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: 3, color: PAL.waterFoam, alpha: 0.9 })
        }
        if ((t.kind === 'path' || t.kind === 'plaza') && n.kind === 'grass') {
          const [x0, y0, x1, y1] = edgeLine(x, y, edge)
          g.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: 1.5, color: PAL.pathEdge, alpha: 0.85 })
        }
        if (t.kind === 'bridge' && (edge === 'n' || edge === 's') && !isPaved(n)) {
          const [x0, y0, x1, y1] = edgeLine(x, y, edge)
          g.moveTo(x0, y0 - 6).lineTo(x1, y1 - 6).stroke({ width: 2, color: PAL.woodDark })
          for (const k of [0, 0.5, 1]) {
            const px = x0 + (x1 - x0) * k
            const py = y0 + (y1 - y0) * k
            g.moveTo(px, py).lineTo(px, py - 7).stroke({ width: 2, color: PAL.woodDark })
          }
        }
      }
    }
  return g
}

function drawTuft(g: Graphics, x: number, y: number) {
  const p = iso(x, y)
  g.moveTo(p.x - 2.5, p.y).lineTo(p.x - 3.5, p.y - 3.5).stroke({ width: 1.2, color: PAL.grassTuft, cap: 'round' })
  g.moveTo(p.x, p.y).lineTo(p.x, p.y - 4.5).stroke({ width: 1.2, color: PAL.grassTuft, cap: 'round' })
  g.moveTo(p.x + 2.5, p.y).lineTo(p.x + 3.5, p.y - 3.5).stroke({ width: 1.2, color: PAL.grassTuft, cap: 'round' })
}

function drawIslandShadow(g: Graphics, N: number) {
  const corners = [iso(0, 0), iso(N, 0), iso(N, N), iso(0, N)]
  const c = iso(N / 2, N / 2)
  for (let i = 0; i < 8; i++) {
    const k = 1 + i * 0.012
    const dy = ISLAND_DEPTH + 10 + i * 5
    g.poly(corners.flatMap((p) => [c.x + (p.x - c.x) * k, c.y + (p.y - c.y) * k + dy])).fill({ color: PAL.shadow, alpha: 0.022 })
  }
}

export function islandMask(N: number) {
  return new Graphics().poly(isoPoly([0, 0, 0], [N, 0, 0], [N, N, 0], [0, N, 0])).fill(0xffffff)
}

function drawIslandSides(g: Graphics, world: World) {
  const N = world.size
  const D = ISLAND_DEPTH
  for (let i = 0; i < N; i++) {
    const jag = (s: number) => 8 + hash2(i, s, 11) * 6
    const leftWater = world.tiles[N - 1][i].kind === 'water'
    const rightWater = world.tiles[i][N - 1].kind === 'water'

    g.poly(isoPoly([i, N, 0], [i + 1, N, 0], [i + 1, N, -D], [i, N, -D])).fill(leftWater ? PAL.water : PAL.sideLeft)
    g.poly(isoPoly([N, i, 0], [N, i + 1, 0], [N, i + 1, -D], [N, i, -D])).fill(rightWater ? PAL.water : PAL.sideRight)
    if (!leftWater)
      g.poly(isoPoly([i, N, -D + jag(1)], [i + 1, N, -D + jag(2)], [i + 1, N, -D], [i, N, -D])).fill(shade(PAL.sideRock, 0.05))
    if (!rightWater)
      g.poly(isoPoly([N, i, -D + jag(3)], [N, i + 1, -D + jag(4)], [N, i + 1, -D], [N, i, -D])).fill(shade(PAL.sideRock, -0.08))
    g.poly(isoPoly([i, N, 0], [i + 1, N, 0], [i + 1, N, -3], [i, N, -3])).fill(leftWater ? PAL.waterFoam : PAL.grassDark)
    g.poly(isoPoly([N, i, 0], [N, i + 1, 0], [N, i + 1, -3], [N, i, -3])).fill(rightWater ? PAL.waterFoam : shade(PAL.grassDark, -0.08))
  }
}
