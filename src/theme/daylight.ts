import { hourOf } from '../core/sim/clock'

/** Sky over the town at a given clock time: how dark it is and the tint the map is multiplied by. */
export interface Daylight {
  /** 0 at noon, 1 in the dead of night. */
  night: number
  tint: number
  alpha: number
}

const KEYS: [hour: number, night: number, tint: number, alpha: number][] = [
  [0, 1, 0x28396b, 0.44],
  [5, 1, 0x28396b, 0.44],
  [6.5, 0.35, 0xf0a894, 0.2],
  [8, 0, 0xffffff, 0],
  [17, 0, 0xffffff, 0],
  [18.5, 0.3, 0xf09a5a, 0.24],
  [20, 1, 0x28396b, 0.44],
  [24, 1, 0x28396b, 0.44],
]

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const lerpColor = (a: number, b: number, t: number) =>
  (Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, t)) << 16) |
  (Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t)) << 8) |
  Math.round(lerp(a & 255, b & 255, t))

export function daylight(minutes: number): Daylight {
  const h = hourOf(minutes)
  const i = KEYS.findIndex(([k], n) => h >= k && h < KEYS[n + 1][0])
  const [h0, n0, c0, a0] = KEYS[i]
  const [h1, n1, c1, a1] = KEYS[i + 1]
  const t = (h - h0) / (h1 - h0)
  const tint = a0 === 0 ? c1 : a1 === 0 ? c0 : lerpColor(c0, c1, t)
  return { night: lerp(n0, n1, t), tint, alpha: lerp(a0, a1, t) }
}
