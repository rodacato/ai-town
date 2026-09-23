import type { Point } from './types'
import { isWalkable, tileCost, type World } from './world'

const DIRS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
] as const

class MinHeap {
  private items: { id: number; f: number }[] = []
  get size() {
    return this.items.length
  }
  push(id: number, f: number) {
    const a = this.items
    a.push({ id, f })
    let i = a.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (a[p].f <= a[i].f) break
      ;[a[p], a[i]] = [a[i], a[p]]
      i = p
    }
  }
  pop() {
    const a = this.items
    const top = a[0]
    const last = a.pop()!
    if (a.length) {
      a[0] = last
      let i = 0
      for (;;) {
        const l = i * 2 + 1
        const r = l + 1
        let m = i
        if (l < a.length && a[l].f < a[m].f) m = l
        if (r < a.length && a[r].f < a[m].f) m = r
        if (m === i) break
        ;[a[m], a[i]] = [a[i], a[m]]
        i = m
      }
    }
    return top.id
  }
}

/** A* over tiles, 8-directional, no corner cutting. Returns tiles after `from`, ending at `to`. */
export function findPath(world: World, from: Point, to: Point): Point[] | null {
  const N = world.size
  const t = world.tiles
  if (!isWalkable(t[to.y]?.[to.x])) return null
  const id = (x: number, y: number) => y * N + x
  const start = id(from.x, from.y)
  const goal = id(to.x, to.y)
  const g = new Float32Array(N * N).fill(Infinity)
  const came = new Int32Array(N * N).fill(-1)
  const closed = new Uint8Array(N * N)
  const h = (x: number, y: number) => {
    const dx = Math.abs(x - to.x)
    const dy = Math.abs(y - to.y)
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy)
  }
  const open = new MinHeap()
  g[start] = 0
  open.push(start, h(from.x, from.y))

  while (open.size) {
    const cur = open.pop()
    if (cur === goal) break
    if (closed[cur]) continue
    closed[cur] = 1
    const cx = cur % N
    const cy = (cur / N) | 0
    for (const [dx, dy, len] of DIRS) {
      const nx = cx + dx
      const ny = cy + dy
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue
      const nt = t[ny][nx]
      if (!isWalkable(nt)) continue
      if (dx && dy && (!isWalkable(t[cy][nx]) || !isWalkable(t[ny][cx]))) continue
      const nid = id(nx, ny)
      const cost = g[cur] + len * tileCost(nt)
      if (cost < g[nid]) {
        g[nid] = cost
        came[nid] = cur
        open.push(nid, cost + h(nx, ny))
      }
    }
  }
  if (goal === start) return []
  if (came[goal] === -1) return null
  const path: Point[] = []
  for (let c = goal; c !== start; c = came[c]) path.push({ x: c % N, y: (c / N) | 0 })
  return path.reverse()
}
