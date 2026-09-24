import { describe, expect, it } from 'vitest'
import { findPath } from '../src/core/world/pathfinding'
import { createWorld, isWalkable } from '../src/core/world/world'
import { content } from './helpers'

describe('world generation', () => {
  const world = createWorld(content)
  const hub = world.buildings.find((b) => b.id === content.authorityOrigin.building)!.door

  it('is deterministic', () => {
    const fingerprint = (w: typeof world) => w.tiles.map((row) => row.map((t) => t.kind + (t.prop ?? '')).join()).join()
    expect(fingerprint(createWorld(content))).toBe(fingerprint(world))
  })

  it('connects every door to the town hub', () => {
    for (const b of world.buildings) expect(findPath(world, hub, b.door), b.id).not.toBeNull()
  })

  it('gives every place reachable, walkable spots', () => {
    for (const place of world.places) {
      expect(place.spots.length, place.id).toBeGreaterThan(0)
      for (const s of place.spots) expect(isWalkable(world.tiles[s.y][s.x]), `${place.id} ${s.x},${s.y}`).toBe(true)
      expect(findPath(world, hub, place.spots[0]), place.id).not.toBeNull()
    }
  })

  it('homes every resident in an existing building', () => {
    for (const r of content.residents) expect(world.buildings.some((b) => b.id === r.home), r.id).toBe(true)
  })

  it('keeps sentries on grass, off paths and buildings, and blocking their own tile', () => {
    expect(world.sentries.length).toBeGreaterThan(0)
    for (const s of world.sentries) {
      const t = world.tiles[s.y][s.x]
      expect(t.blocked, `${s.x},${s.y}`).toBe(true)
      expect(t.kind, `${s.x},${s.y}`).toBe('grass')
      expect(t.buildingId).toBeUndefined()
    }
  })

  it('only relates residents to residents who exist', () => {
    const ids = new Set(content.residents.map((r) => r.id))
    for (const r of content.residents) for (const rel of r.relationships) expect(ids.has(rel.id), `${r.id} → ${rel.id}`).toBe(true)
  })

  it('only routes residents to places that exist', () => {
    const ids = new Set([...world.places.map((p) => p.id), 'home', 'visit'])
    for (const r of content.residents) for (const key of Object.keys(r.routine)) expect(ids.has(key), `${r.id} → ${key}`).toBe(true)
  })
})

describe('pathfinding', () => {
  const world = createWorld(content)

  it('never steps on water or blocked tiles', () => {
    const a = world.places[0].spots[0]
    const b = world.places.at(-1)!.spots.at(-1)!
    const path = findPath(world, a, b)!
    for (const p of path) expect(isWalkable(world.tiles[p.y][p.x])).toBe(true)
    expect(path.at(-1)).toEqual(b)
  })

  it('returns null for a blocked target', () => {
    const b = world.buildings[0]
    expect(findPath(world, b.door, { x: b.x, y: b.y })).toBeNull()
  })
})
