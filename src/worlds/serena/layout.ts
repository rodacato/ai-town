import type { Rect, WorldLayout } from '../../core/world/content'

export const PLAZA: Rect = { x0: 10, y0: 12, x1: 16, y1: 18 }
const PARK: Rect = { x0: 17, y0: 24, x1: 21, y1: 29 }
const N = 32

export const riverX = (y: number) => 23 + Math.round(1.3 * Math.sin(y * 0.28 + 0.6))

export const layout: WorldLayout = {
  size: N,
  seed: 20260922,
  river: { x: riverX, width: 2 },
  roads: [
    [1, 15, N - 2, 15],
    [13, 1, 13, N - 2],
    [3, 6, 13, 6],
    [4, 6, 4, 24],
    [4, 24, 20, 24],
  ],
  areas: [
    { kind: 'plaza', rect: PLAZA },
    { kind: 'field', rect: { x0: 1, y0: 1, x1: 4, y1: 4 }, prop: { name: 'crop', every: 'row' } },
    { kind: 'water', rect: { x0: 19, y0: 27, x1: 20, y1: 28 } },
  ],
  landmarks: [{ id: 'fountain', kind: 'fountain', x: 12, y: 14, size: 3 }],
  buildings: [
    { id: 'townhall', kind: 'townhall', name: 'Ayuntamiento', x: 10, y: 7, size: 3, doorSide: 'left', palette: 0 },
    { id: 'cafe', kind: 'cafe', name: 'Café La Glorieta', x: 17, y: 11, size: 2, doorSide: 'left', palette: 1 },
    { id: 'shop', kind: 'shop', name: 'Tienda Ferrer', x: 6, y: 16, size: 3, doorSide: 'right', palette: 2 },
    { id: 'bakery', kind: 'bakery', name: 'Panadería Herrera', x: 15, y: 20, size: 2, doorSide: 'left', palette: 3 },
    { id: 'h1', kind: 'house', name: 'Casa Méndez', x: 6, y: 4, size: 2, doorSide: 'left', palette: 0 },
    { id: 'h2', kind: 'house', name: 'Casa Ortega', x: 9, y: 3, size: 2, doorSide: 'left', palette: 1 },
    { id: 'h3', kind: 'house', name: 'Casa Salas', x: 16, y: 7, size: 2, doorSide: 'left', palette: 2 },
    { id: 'h4', kind: 'house', name: 'Casa Rivas', x: 16, y: 3, size: 2, doorSide: 'left', palette: 3 },
    { id: 'h5', kind: 'house', name: 'Casa Vidal', x: 2, y: 10, size: 2, doorSide: 'right', palette: 4 },
    { id: 'h6', kind: 'house', name: 'Casa Molina', x: 7, y: 10, size: 2, doorSide: 'left', palette: 1 },
    { id: 'h7', kind: 'house', name: 'Casa Campos', x: 2, y: 17, size: 2, doorSide: 'right', palette: 0 },
    { id: 'h8', kind: 'house', name: 'Casa Soto', x: 7, y: 21, size: 2, doorSide: 'left', palette: 2 },
    { id: 'h9', kind: 'house', name: 'Casa Del Río', x: 10, y: 25, size: 2, doorSide: 'right', palette: 4 },
    { id: 'h10', kind: 'house', name: 'Casa Núñez', x: 19, y: 18, size: 2, doorSide: 'left', palette: 3 },
    { id: 'h11', kind: 'house', name: 'Casa Quiroga', x: 3, y: 25, size: 2, doorSide: 'right', palette: 1 },
    { id: 'h12', kind: 'house', name: 'Casa Paredes', x: 1, y: 7, size: 2, doorSide: 'right', palette: 2 },
    { id: 'cabin', kind: 'cabin', name: 'Cabaña del río', x: 27, y: 8, size: 2, doorSide: 'left', palette: 0 },
  ],
  props: [
    ...[
      [10, 12],
      [16, 12],
      [10, 18],
      [16, 18],
      [18, 25],
      [21, 27],
      [17, 28],
    ].map(([x, y]) => ({ kind: 'bench', x, y })),
    { kind: 'well', x: 11, y: 20 },
    { kind: 'stall', x: 9, y: 13 },
    { kind: 'stall', x: 9, y: 14 },
  ],
  blockingProps: ['tree', 'pine', 'bush', 'lamp', 'rock', 'stall', 'well', 'fence'],
  decorate: (t) => {
    for (let x = 2; x < N - 2; x += 4) if (t.at(x, 14)?.kind === 'grass') t.setProp(x, 14, 'lamp')
    for (let y = 3; y < N - 2; y += 4) if (t.at(14, y)?.kind === 'grass') t.setProp(14, y, 'lamp')

    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const tile = t.at(x, y)!
        if (tile.kind !== 'grass' || tile.prop || tile.blocked) continue
        const edge = x === 0 || y === 0 || x === N - 1 || y === N - 1
        if (t.adjacentTo(x, y, (n) => n.kind === 'water')) {
          if (t.rng.chance(0.35)) t.setProp(x, y, 'reeds')
          continue
        }
        if (t.nearPaved(x, y, 1)) {
          if (t.adjacentTo(x, y, (n) => !!n.buildingId) && t.rng.chance(0.4)) t.setProp(x, y, 'flowers')
          continue
        }
        const r = t.rng.next()
        if (x > riverX(y) + 2) {
          if (r < 0.5) t.setProp(x, y, 'pine')
          else if (r < 0.62) t.setProp(x, y, 'tree')
          else if (r < 0.66) t.setProp(x, y, 'bush')
          continue
        }
        if (t.inRect(x, y, PARK)) {
          if (r < 0.18) t.setProp(x, y, 'tree')
          else if (r < 0.34) t.setProp(x, y, 'flowers')
          continue
        }
        if (r < (edge ? 0.3 : 0.1)) t.setProp(x, y, t.rng.chance(0.3) ? 'pine' : 'tree')
        else if (r < (edge ? 0.36 : 0.14)) t.setProp(x, y, 'bush')
        else if (r < (edge ? 0.38 : 0.17)) t.setProp(x, y, 'flowers')
        else if (r < (edge ? 0.4 : 0.18)) t.setProp(x, y, 'rock')
      }
  },
}

export { PARK }
