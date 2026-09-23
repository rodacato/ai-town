/** Deterministic PRNG (mulberry32) so the town looks the same on every load. */
export function createRng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    range: (min: number, max: number) => min + next() * (max - min),
    int: (min: number, max: number) => Math.floor(min + next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
    chance: (p: number) => next() < p,
    weighted: <T>(items: readonly { item: T; weight: number }[]): T => {
      const total = items.reduce((s, i) => s + i.weight, 0)
      let r = next() * total
      for (const i of items) {
        r -= i.weight
        if (r <= 0) return i.item
      }
      return items[items.length - 1].item
    },
  }
}

export type Rng = ReturnType<typeof createRng>

/** Cheap stable hash for per-tile variation. */
export function hash2(x: number, y: number, salt = 0) {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
