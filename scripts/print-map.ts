import { createWorld } from '../src/core/world/world'
import { activeWorld } from '../src/worlds'

const world = createWorld(activeWorld.content)
const KIND: Record<string, string> = { grass: '.', path: '=', plaza: '#', water: '~', bridge: 'H', field: ',', sand: ':' }
const PROP: Record<string, string> = {
  tree: 'T', pine: 'A', 'dead-tree': 't', bush: 'b', bench: 'n', lamp: 'l', torch: 'i', flowers: '*', mushrooms: 'm', rock: 'o', menhir: 'I',
  crop: '"', pumpkin: 'p', haystack: 'h', stall: 's', barrels: 'c', anvil: 'a', banner: 'f', well: 'w', reeds: 'r', grave: 'g',
}
// Fences and palisades come in pieces by orientation (fence-ew, palisade-e…); one symbol each is enough for a map.
const symbol = (prop: string) => PROP[prop] ?? (prop.startsWith('fence') ? '+' : prop.startsWith('palisade') ? '|' : prop.startsWith('grave') ? 'g' : '?')
for (let y = 0; y < world.size; y++) {
  let row = ''
  for (let x = 0; x < world.size; x++) {
    const t = world.tiles[y][x]
    const door = world.buildings.find((b) => b.door.x === x && b.door.y === y)
    row += door ? 'D' : t.buildingId ? 'B' : t.blocked && !t.prop ? 'F' : t.prop ? symbol(t.prop) : KIND[t.kind]
  }
  console.log(row)
}
for (const p of world.places) console.log(p.id.padEnd(10), p.spots.length)
