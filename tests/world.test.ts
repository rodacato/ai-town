import { describe, expect, it } from 'vitest'
import { findPath } from '../src/sim/pathfinding'
import { createWorld, isWalkable } from '../src/sim/world'

describe('world generation', () => {
  const world = createWorld()
  const plaza = world.places.find((p) => p.id === 'plaza')!.spots[0]

  it('is deterministic', () => {
    const again = createWorld()
    expect(again.tiles.map((row) => row.map((t) => t.kind + (t.prop ?? '')).join()).join()).toBe(
      world.tiles.map((row) => row.map((t) => t.kind + (t.prop ?? '')).join()).join(),
    )
  })

  it('connects every door to the plaza', () => {
    for (const b of world.buildings) expect(findPath(world, plaza, b.door), b.id).not.toBeNull()
  })

  it('only lists walkable spots for places', () => {
    for (const place of world.places) {
      expect(place.spots.length, place.id).toBeGreaterThan(0)
      for (const s of place.spots) expect(isWalkable(world.tiles[s.y][s.x]), `${place.id} ${s.x},${s.y}`).toBe(true)
    }
  })
})

describe('pathfinding', () => {
  const world = createWorld()

  it('never steps on water or blocked tiles', () => {
    const forest = world.places.find((p) => p.id === 'forest')!.spots[0]
    const plaza = world.places.find((p) => p.id === 'plaza')!.spots[0]
    const path = findPath(world, plaza, forest)!
    expect(path.length).toBeGreaterThan(0)
    for (const p of path) expect(isWalkable(world.tiles[p.y][p.x])).toBe(true)
    expect(path.at(-1)).toEqual(forest)
  })

  it('returns null for a blocked target', () => {
    const b = world.buildings[0]
    expect(findPath(world, b.door, { x: b.x, y: b.y })).toBeNull()
  })
})
