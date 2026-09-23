import type { Building } from '../../core/world/types'

export const TOWN_NAME = 'Villa Serena'
export const MAP_SIZE = 32
export const WORLD_SEED = 20260922

export const BUILDINGS: Omit<Building, 'door'>[] = [
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
]
