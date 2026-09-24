import type { Look, Rect, Sentry, WorldLayout } from '../../core/world/content'

const N = 32
/** The lake fills the east; a strip of beach runs along it and the pier walks out over the water. */
export const LAKE: Rect = { x0: 24, y0: 0, x1: N - 1, y1: N - 1 }
export const BEACH: Rect = { x0: 22, y0: 0, x1: 23, y1: N - 1 }
export const PIER: Rect = { x0: 24, y0: 14, x1: 28, y1: 14 }
export const LONJA: Rect = { x0: 13, y0: 11, x1: 18, y1: 16 }
export const PADDY: Rect = { x0: 1, y0: 26, x1: 6, y1: 30 }
export const WILLOW = { x: 16, y: 15, size: 3 }
export const GATE = { x: 11, y: 29 }
const GUARD_POST = { x: 13, y: 29, size: 2 }
export const inPinewood = (x: number, y: number) => x <= 3 && y >= 8 && y <= 22

const GUARD: Look = { skin: 0xd39c72, hair: 0x2c2522, hairStyle: 'short', shirt: 0x3f6e8c, pants: 0x3a3a44, accessory: 'helmet', ancestry: 'human' }
const SENTRIES: Sentry[] = [
  { x: GATE.x - 1, y: GATE.y + 1, facing: 1, look: GUARD },
  { x: GATE.x + 1, y: GATE.y + 1, facing: -1, look: { ...GUARD, skin: 0xe9bf9a, hair: 0x8e5a36 } },
]

export const layout: WorldLayout = {
  size: N,
  seed: 20260925,
  roads: [
    [1, 14, 23, 14],
    [11, 1, 11, N - 2],
    [3, 6, 11, 6],
    [3, 6, 3, 24],
    [3, 24, 21, 24],
    [18, 3, 18, 11],
    [18, 3, 21, 3],
  ],
  areas: [
    { kind: 'water', rect: LAKE },
    { kind: 'sand', rect: BEACH },
    { kind: 'bridge', rect: PIER },
    { kind: 'plaza', rect: LONJA },
    { kind: 'field', rect: PADDY, prop: { name: 'haystack', every: 'row' } },
  ],
  landmarks: [
    { id: 'willow', kind: 'great-oak', ...WILLOW },
    { id: 'guard-post', kind: 'guard-post', ...GUARD_POST },
  ],
  buildings: [
    { id: 'townhall', kind: 'manor', name: 'Alcaldía de Aguamansa', x: 6, y: 8, size: 3, doorSide: 'right', palette: 0 },
    { id: 'inn', kind: 'tavern', name: 'Posada La Anguila Tuerta', x: 13, y: 7, size: 3, doorSide: 'left', palette: 0 },
    { id: 'shrine', kind: 'temple', name: 'Santuario de las Aguas', x: 5, y: 16, size: 3, doorSide: 'right', palette: 0 },
    { id: 'lighthouse', kind: 'watchtower', name: 'Faro de Fermín', x: 19, y: 6, size: 2, doorSide: 'left', palette: 0 },
    { id: 'workshop', kind: 'forge', name: 'Calderería Latón', x: 13, y: 18, size: 2, doorSide: 'left', palette: 0 },
    { id: 'hut', kind: 'potions', name: 'Choza de la Bruja del Carrizal', x: 18, y: 26, size: 2, doorSide: 'left', palette: 0 },
    { id: 'granary', kind: 'mill', name: 'Molino de Olmo', x: 5, y: 1, size: 2, doorSide: 'left', palette: 0 },
    { id: 'nerea', kind: 'cottage', name: 'Casa de las Redes', x: 18, y: 18, size: 2, doorSide: 'left', palette: 1 },
    { id: 'tobias', kind: 'cottage', name: 'Pescadería Escamas', x: 7, y: 20, size: 2, doorSide: 'right', palette: 2 },
    { id: 'anselmo', kind: 'cottage', name: 'Casa del Abuelo Anselmo', x: 1, y: 3, size: 2, doorSide: 'right', palette: 3 },
    { id: 'barracks', kind: 'cabin', name: 'Cuartelillo', x: 8, y: 25, size: 2, doorSide: 'right', palette: 0 },
    { id: 'rita', kind: 'cottage', name: 'Casa de la Cantora', x: 15, y: 1, size: 2, doorSide: 'right', palette: 4 },
    { id: 'yara', kind: 'cabin', name: 'Cabaña de la Recién Llegada', x: 14, y: 26, size: 2, doorSide: 'left', palette: 0 },
  ],
  props: [
    ...[
      [13, 11],
      [18, 11],
      [13, 16],
      [22, 20],
      [22, 8],
    ].map(([x, y]) => ({ kind: 'bench', x, y })),
    { kind: 'well', x: 9, y: 12 },
    { kind: 'stall', x: 14, y: 12 },
    { kind: 'stall', x: 14, y: 13 },
    { kind: 'barrels', x: 22, y: 13 },
    { kind: 'barrels', x: 22, y: 15 },
    { kind: 'anvil', x: 15, y: 20 },
    { kind: 'banner', x: 10, y: 7 },
    { kind: 'rock', x: 22, y: 2 },
    { kind: 'rock', x: 23, y: 27 },
    { kind: 'torch', x: 23, y: 13 },
    { kind: 'torch', x: 10, y: 28 },
    { kind: 'torch', x: 12, y: 28 },
  ],
  sentries: SENTRIES,
  blockingProps: ['tree', 'pine', 'bush', 'torch', 'rock', 'stall', 'well', 'barrels', 'anvil', 'haystack', 'banner', 'mushrooms'],
  decorate: (t) => {
    for (let x = 2; x < 22; x += 4) if (t.at(x, 13)?.kind === 'grass') t.setProp(x, 13, 'torch')
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const tile = t.at(x, y)!
        if (tile.prop || tile.blocked) continue
        if (tile.kind === 'sand') {
          if (t.adjacentTo(x, y, (n) => n.kind === 'water') && t.rng.chance(0.12)) t.setProp(x, y, 'reeds')
          continue
        }
        if (tile.kind !== 'grass') continue
        if (t.nearPaved(x, y, 1)) {
          if (t.adjacentTo(x, y, (n) => !!n.buildingId) && t.rng.chance(0.4)) t.setProp(x, y, 'flowers')
          continue
        }
        const r = t.rng.next()
        if (inPinewood(x, y)) {
          if (r < 0.5) t.setProp(x, y, 'pine')
          else if (r < 0.6) t.setProp(x, y, 'mushrooms')
          continue
        }
        const edge = x === 0 || y === 0 || y === N - 1
        if (r < (edge ? 0.25 : 0.07)) t.setProp(x, y, t.rng.chance(0.3) ? 'pine' : 'tree')
        else if (r < (edge ? 0.3 : 0.11)) t.setProp(x, y, 'bush')
        else if (r < (edge ? 0.33 : 0.15)) t.setProp(x, y, 'flowers')
      }
  },
}
