import { createWorld } from '../src/core/world/world'

const world = createWorld()
const KIND: Record<string, string> = { grass: '.', path: '=', plaza: '#', water: '~', bridge: 'H', field: ',', sand: ':' }
const PROP: Record<string, string> = {
  tree: 'T', pine: 'A', bush: 'b', bench: 'n', lamp: 'l', flowers: '*', rock: 'o', crop: '"', stall: 's', well: 'w', fence: '+', reeds: 'r',
}
for (let y = 0; y < world.size; y++) {
  let row = ''
  for (let x = 0; x < world.size; x++) {
    const t = world.tiles[y][x]
    const door = world.buildings.find((b) => b.door.x === x && b.door.y === y)
    row += door ? 'D' : t.buildingId ? 'B' : t.blocked && !t.prop ? 'F' : t.prop ? PROP[t.prop] : KIND[t.kind]
  }
  console.log(row)
}
for (const p of world.places) console.log(p.id.padEnd(10), p.spots.length)
