export const TILE_W = 64
export const TILE_H = 32
export const ISLAND_DEPTH = 26

export function iso(x: number, y: number, z = 0) {
  return { x: ((x - y) * TILE_W) / 2, y: ((x + y) * TILE_H) / 2 - z }
}

export function isoFlat(x: number, y: number, z = 0): [number, number] {
  const p = iso(x, y, z)
  return [p.x, p.y]
}

/** Polygon points for a list of [x, y, z] world corners. */
export function isoPoly(...corners: [number, number, number][]) {
  return corners.flatMap(([x, y, z]) => isoFlat(x, y, z))
}

export function screenToTile(sx: number, sy: number) {
  const a = sx / (TILE_W / 2)
  const b = sy / (TILE_H / 2)
  return { x: (a + b) / 2, y: (b - a) / 2 }
}
