import type { Look, Rect, Sentry, WorldLayout } from '../../core/world/content'

const N = 40
export const PLAZA: Rect = { x0: 11, y0: 12, x1: 17, y1: 18 }
const FIELD: Rect = { x0: 1, y0: 1, x1: 4, y1: 4 }
export const OAK = { x: 13, y: 14, size: 3 }
export const CRYPT = { x: 27, y: 23, size: 2 }
export const CEMETERY: Rect = { x0: 3, y0: 33, x1: 11, y1: 38 }
export const GATE = { x: 14, y: 34 }
const GUARD_POST = { x: 16, y: 35, size: 2 }

/** Fence pieces around a rectangle; each names the neighbours it joins so corners and gaps line up. */
function fenceAround(r: Rect, style: string, gaps: { x: number; y: number }[]) {
  const onEdge = (x: number, y: number) =>
    x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1 && (x === r.x0 || x === r.x1 || y === r.y0 || y === r.y1) && !gaps.some((g) => g.x === x && g.y === y)
  return fenceWhere(r, style, onEdge)
}

function fenceLine(y: number, x0: number, x1: number, style: string, gaps: number[]) {
  const on = (x: number, yy: number) => yy === y && x >= x0 && x <= x1 && !gaps.includes(x)
  return fenceWhere({ x0, y0: y, x1, y1: y }, style, on)
}

function fenceWhere(r: Rect, style: string, on: (x: number, y: number) => boolean) {
  const out: { kind: string; x: number; y: number }[] = []
  for (let y = r.y0; y <= r.y1; y++)
    for (let x = r.x0; x <= r.x1; x++) {
      if (!on(x, y)) continue
      const dirs = [on(x, y - 1) && 'n', on(x + 1, y) && 'e', on(x, y + 1) && 's', on(x - 1, y) && 'w'].filter(Boolean).join('')
      if (dirs) out.push({ kind: `${style}-${dirs}`, x, y })
    }
  return out
}

const FENCES = [...fenceAround(CEMETERY, 'fence', [{ x: 6, y: CEMETERY.y0 }]), ...fenceLine(GATE.y, 12, 22, 'palisade', [GATE.x])]

const SOLDIER: Look = { skin: 0xe9bf9a, hair: 0x6b4430, hairStyle: 'short', shirt: 0x8a3b3b, pants: 0x4a3f36, accessory: 'helmet', ancestry: 'human' }
const SENTRIES: Sentry[] = [
  { x: GATE.x - 1, y: GATE.y + 1, facing: 1, look: SOLDIER },
  { x: GATE.x + 1, y: GATE.y + 1, facing: -1, look: { ...SOLDIER, skin: 0xa8714e, hair: 0x2c2522 } },
  { x: 28, y: 14, facing: -1, look: { ...SOLDIER, skin: 0xd39c72, ancestry: 'dwarf', hair: 0xb5532d } },
  { x: 10, y: 12, facing: 1, look: { ...SOLDIER, skin: 0x93a86f, ancestry: 'halforc' } },
]

export const riverX = (y: number) => 23 + Math.round(1.3 * Math.sin(y * 0.28 + 0.6))
export const inForest = (x: number, y: number) => x > riverX(y) + 2

export const layout: WorldLayout = {
  size: N,
  seed: 20260923,
  river: { x: riverX, width: 2 },
  roads: [
    [1, 15, N - 2, 15],
    [14, 1, 14, N - 2],
    [3, 6, 14, 6],
    [4, 6, 4, 24],
    [4, 24, 21, 24],
    [26, 15, 26, 22],
    [4, 24, 4, 31],
    [4, 31, 14, 31],
    [6, 31, 6, CEMETERY.y0],
  ],
  areas: [
    { kind: 'plaza', rect: PLAZA },
    { kind: 'field', rect: FIELD, prop: { name: 'pumpkin', every: 'row' } },
    { kind: 'water', rect: { x0: 19, y0: 27, x1: 20, y1: 28 } },
  ],
  landmarks: [
    { id: 'oak', kind: 'great-oak', ...OAK },
    { id: 'crypt', kind: 'crypt', ...CRYPT },
    { id: 'guard-post', kind: 'guard-post', ...GUARD_POST },
  ],
  buildings: [
    { id: 'keep', kind: 'keep', name: 'Torreón de la Baronesa', x: 10, y: 7, size: 4, doorSide: 'left', palette: 0 },
    { id: 'tavern', kind: 'tavern', name: 'La Jarra del Grifo', x: 18, y: 11, size: 3, doorSide: 'left', palette: 0 },
    { id: 'forge', kind: 'forge', name: 'Forja Yunquefuerte', x: 7, y: 16, size: 2, doorSide: 'right', palette: 0 },
    { id: 'potions', kind: 'potions', name: 'Pócimas Lunaverde', x: 17, y: 20, size: 2, doorSide: 'left', palette: 0 },
    { id: 'temple', kind: 'temple', name: 'Templo de la Aurora', x: 6, y: 9, size: 3, doorSide: 'right', palette: 0 },
    { id: 'tower', kind: 'mage-tower', name: 'Torre de Zafiro', x: 17, y: 5, size: 2, doorSide: 'left', palette: 0 },
    { id: 'mill', kind: 'mill', name: 'Molino de Ottokar', x: 7, y: 2, size: 2, doorSide: 'left', palette: 0 },
    { id: 'watch', kind: 'watchtower', name: 'Atalaya del Puente', x: 26, y: 12, size: 2, doorSide: 'left', palette: 0 },
    { id: 'treehouse', kind: 'treehouse', name: 'Casa-árbol de Elowen', x: 28, y: 4, size: 2, doorSide: 'left', palette: 0 },
    { id: 'cabin', kind: 'cabin', name: 'Cabaña del Leñador', x: 28, y: 18, size: 2, doorSide: 'left', palette: 0 },
    { id: 'farm', kind: 'cottage', name: 'Granja Mazorca', x: 1, y: 7, size: 2, doorSide: 'right', palette: 1 },
    { id: 'agnes', kind: 'cottage', name: 'Casita de la Abuela Agnes', x: 1, y: 11, size: 2, doorSide: 'right', palette: 2 },
    { id: 'bard', kind: 'cottage', name: 'Casa del Bardo', x: 1, y: 18, size: 2, doorSide: 'right', palette: 3 },
    { id: 'manor', kind: 'manor', name: 'Mansión Vallecristal', x: 7, y: 21, size: 3, doorSide: 'right', palette: 0 },
    { id: 'gnome', kind: 'cottage', name: 'Casa de Cambio Cuentamonedas', x: 10, y: 26, size: 2, doorSide: 'right', palette: 4 },
    { id: 'hunter', kind: 'cottage', name: 'Refugio del Cazador', x: 19, y: 17, size: 2, doorSide: 'left', palette: 5 },
    { id: 'peddler', kind: 'cottage', name: 'Carromato de Lucio', x: 1, y: 22, size: 2, doorSide: 'right', palette: 2 },
    { id: 'tinker', kind: 'cottage', name: 'Taller de Fizzwick', x: 16, y: 27, size: 2, doorSide: 'left', palette: 1 },
    { id: 'gravedigger', kind: 'cabin', name: 'Caseta del Sepulturero', x: 1, y: 28, size: 2, doorSide: 'right', palette: 0 },
  ],
  props: [
    ...[
      [11, 12],
      [17, 12],
      [11, 18],
      [17, 18],
      [18, 26],
      [21, 27],
    ].map(([x, y]) => ({ kind: 'bench', x, y })),
    { kind: 'well', x: 12, y: 20 },
    { kind: 'stall', x: 10, y: 13 },
    { kind: 'stall', x: 10, y: 15 },
    { kind: 'stall', x: 10, y: 17 },
    { kind: 'barrels', x: 17, y: 14 },
    { kind: 'anvil', x: 9, y: 18 },
    { kind: 'banner', x: 13, y: 11 },
    { kind: 'banner', x: 15, y: 11 },
    { kind: 'menhir', x: 26, y: 25 },
    { kind: 'menhir', x: 29, y: 22 },
    { kind: 'menhir', x: 29, y: 26 },
    { kind: 'haystack', x: 5, y: 3 },
    ...FENCES,
    ...[
      [4, 35, 'grave'],
      [6, 35, 'grave-cross'],
      [8, 35, 'grave'],
      [10, 35, 'grave'],
      [4, 37, 'grave-cross'],
      [6, 37, 'grave'],
      [8, 37, 'grave'],
      [10, 37, 'grave-cross'],
      [9, 34, 'dead-tree'],
      [5, 36, 'grave'],
      [9, 36, 'grave'],
    ].map(([x, y, kind]) => ({ kind: kind as string, x: x as number, y: y as number })),
    { kind: 'torch', x: 5, y: 32 },
    { kind: 'torch', x: 13, y: 33 },
    { kind: 'torch', x: 15, y: 33 },
  ],
  sentries: SENTRIES,
  blockingProps: ['tree', 'pine', 'bush', 'torch', 'rock', 'stall', 'well', 'barrels', 'anvil', 'menhir', 'haystack', 'banner', 'mushrooms', 'grave', 'grave-cross', 'dead-tree', ...new Set(FENCES.map((f) => f.kind))],
  decorate: (t) => {
    for (let x = 2; x < N - 2; x += 4) if (t.at(x, 14)?.kind === 'grass') t.setProp(x, 14, 'torch')
    for (let y = 3; y < N - 2; y += 4) if (t.at(15, y)?.kind === 'grass') t.setProp(15, y, 'torch')

    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const tile = t.at(x, y)!
        if (tile.kind !== 'grass' || tile.prop || tile.blocked || t.inRect(x, y, CEMETERY)) continue
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
        if (inForest(x, y)) {
          if (r < 0.46) t.setProp(x, y, 'pine')
          else if (r < 0.6) t.setProp(x, y, 'tree')
          else if (r < 0.66) t.setProp(x, y, 'mushrooms')
          else if (r < 0.7) t.setProp(x, y, 'bush')
          continue
        }
        if (r < (edge ? 0.3 : 0.09)) t.setProp(x, y, t.rng.chance(0.35) ? 'pine' : 'tree')
        else if (r < (edge ? 0.36 : 0.13)) t.setProp(x, y, 'bush')
        else if (r < (edge ? 0.38 : 0.16)) t.setProp(x, y, 'flowers')
        else if (r < (edge ? 0.4 : 0.17)) t.setProp(x, y, 'rock')
      }
  },
}
