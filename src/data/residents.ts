export type RoutineSpot =
  | 'plaza'
  | 'fountain'
  | 'benches'
  | 'cafe'
  | 'bakery'
  | 'shop'
  | 'townhall'
  | 'park'
  | 'riverbank'
  | 'forest'
  | 'field'
  | 'bridge'
  | 'street'
  | 'home'
  | 'visit'

export type Accessory = 'hat' | 'cap' | 'apron' | 'glasses' | 'bag' | 'cane' | 'bow' | 'scarf'

export interface Look {
  skin: number
  hair: number
  hairStyle: 'short' | 'long' | 'bun' | 'bald' | 'curly'
  shirt: number
  pants: number
  accessory?: Accessory
}

export interface Relationship {
  id: string
  label: string
}

export interface ResidentProfile {
  id: string
  name: string
  age: number
  occupation: string
  bio: string
  traits: string[]
  relationships: Relationship[]
  home: string
  routine: Partial<Record<RoutineSpot, number>>
  look: Look
}

const SKIN = { light: 0xf3d2b6, fair: 0xe9bf9a, tan: 0xd39c72, brown: 0xa8714e, deep: 0x7a4f35 }
const HAIR = { black: 0x2c2522, brown: 0x6b4430, chestnut: 0x8e5a36, blond: 0xd9b36c, grey: 0xb9b4ad, white: 0xe8e4de, red: 0xa94d2c }

export const RESIDENTS: ResidentProfile[] = [
  {
    id: 'rosa',
    name: 'Rosa Méndez',
    age: 67,
    occupation: 'Panadera jubilada',
    bio: 'Horneó el pan del pueblo durante cuarenta años. Se entera de todo antes que nadie.',
    traits: ['chismosa', 'generosa', 'desconfiada de lo nuevo'],
    relationships: [
      { id: 'tomas', label: 'hijo' },
      { id: 'marta', label: 'mejor amiga' },
      { id: 'nicolas', label: 'rival de toda la vida' },
    ],
    home: 'h1',
    routine: { bakery: 3, benches: 3, plaza: 2, cafe: 2, visit: 2, home: 2 },
    look: { skin: SKIN.fair, hair: HAIR.grey, hairStyle: 'bun', shirt: 0xc86f5a, pants: 0x6e5a4e, accessory: 'scarf' },
  },
  {
    id: 'tomas',
    name: 'Tomás Herrera',
    age: 34,
    occupation: 'Panadero',
    bio: 'Heredó la panadería de su madre. Madruga, trabaja duro y no tiene tiempo para tonterías.',
    traits: ['trabajador', 'pragmático', 'reservado'],
    relationships: [
      { id: 'rosa', label: 'madre' },
      { id: 'carmen', label: 'le surte pan al café' },
      { id: 'pablo', label: 'amigo de la infancia' },
    ],
    home: 'bakery',
    routine: { bakery: 6, cafe: 1, shop: 1, home: 2 },
    look: { skin: SKIN.tan, hair: HAIR.brown, hairStyle: 'short', shirt: 0xf1e6d3, pants: 0x4f5d6b, accessory: 'apron' },
  },
  {
    id: 'lucia',
    name: 'Lucía Ortega',
    age: 28,
    occupation: 'Maestra',
    bio: 'Llegó hace tres años a dar clases y se quedó. Pregunta el porqué de todo.',
    traits: ['curiosa', 'empática', 'racional'],
    relationships: [
      { id: 'sofia', label: 'su alumna' },
      { id: 'elena', label: 'amiga cercana' },
      { id: 'carmen', label: 'madre de una alumna' },
    ],
    home: 'h2',
    routine: { plaza: 2, park: 3, cafe: 2, townhall: 1, benches: 1, home: 2 },
    look: { skin: SKIN.light, hair: HAIR.chestnut, hairStyle: 'long', shirt: 0x7fa7b8, pants: 0x3f4a5a, accessory: 'glasses' },
  },
  {
    id: 'ernesto',
    name: 'Ernesto Salas',
    age: 72,
    occupation: 'Exalcalde',
    bio: 'Fue alcalde veinte años. Aún cree que el pueblo funcionaba mejor con él.',
    traits: ['escéptico', 'orgulloso', 'influyente'],
    relationships: [
      { id: 'ines', label: 'la considera una usurpadora' },
      { id: 'marta', label: 'viejo amigo' },
      { id: 'rosa', label: 'la escucha con desconfianza' },
    ],
    home: 'h3',
    routine: { benches: 3, townhall: 2, cafe: 3, plaza: 2, home: 2 },
    look: { skin: SKIN.fair, hair: HAIR.white, hairStyle: 'bald', shirt: 0x5a6e5a, pants: 0x3b3531, accessory: 'cane' },
  },
  {
    id: 'mateo',
    name: 'Mateo Rivas',
    age: 19,
    occupation: 'Estudiante',
    bio: 'Vuelve al pueblo en vacaciones. Aburrido, busca cualquier excusa para una aventura.',
    traits: ['impulsivo', 'curioso', 'sociable'],
    relationships: [
      { id: 'pablo', label: 'mejor amigo' },
      { id: 'julian', label: 'tío' },
      { id: 'elena', label: 'le gusta en secreto' },
    ],
    home: 'h4',
    routine: { plaza: 3, street: 2, bridge: 2, park: 2, forest: 1, visit: 2, home: 1 },
    look: { skin: SKIN.tan, hair: HAIR.black, hairStyle: 'curly', shirt: 0xe3a857, pants: 0x3c4f6b, accessory: 'cap' },
  },
  {
    id: 'carmen',
    name: 'Carmen Vidal',
    age: 45,
    occupation: 'Dueña del café',
    bio: 'Su café es el corazón social del pueblo. Sabe quién está triste por cómo pide el café.',
    traits: ['sociable', 'práctica', 'protectora'],
    relationships: [
      { id: 'sofia', label: 'hija' },
      { id: 'valeria', label: 'amiga' },
      { id: 'tomas', label: 'proveedor' },
    ],
    home: 'h5',
    routine: { cafe: 7, plaza: 1, bakery: 1, home: 2 },
    look: { skin: SKIN.brown, hair: HAIR.black, hairStyle: 'bun', shirt: 0xb85d4a, pants: 0x3b3531, accessory: 'apron' },
  },
  {
    id: 'sofia',
    name: 'Sofía Vidal',
    age: 11,
    occupation: 'Estudiante de primaria',
    bio: 'Corre a todas partes. Cree todo lo que le cuentan, salvo si su madre dice lo contrario.',
    traits: ['curiosa', 'crédula', 'inquieta'],
    relationships: [
      { id: 'carmen', label: 'madre' },
      { id: 'lucia', label: 'su maestra favorita' },
      { id: 'marta', label: 'le cuenta historias' },
    ],
    home: 'h5',
    routine: { fountain: 3, park: 3, plaza: 3, cafe: 1, riverbank: 1, home: 1 },
    look: { skin: SKIN.brown, hair: HAIR.black, hairStyle: 'long', shirt: 0xe7b8c8, pants: 0x5b7a99, accessory: 'bow' },
  },
  {
    id: 'andres',
    name: 'Andrés Molina',
    age: 39,
    occupation: 'Guardia del pueblo',
    bio: 'El único agente de seguridad del pueblo. Ha visto suficientes estafas para sospechar de todo.',
    traits: ['responsable', 'desconfiado', 'metódico'],
    relationships: [
      { id: 'valeria', label: 'pareja' },
      { id: 'hugo', label: 'no le cae bien' },
      { id: 'ines', label: 'reporta al ayuntamiento' },
    ],
    home: 'h6',
    routine: { street: 5, plaza: 2, bridge: 2, townhall: 2, home: 1 },
    look: { skin: SKIN.fair, hair: HAIR.brown, hairStyle: 'short', shirt: 0x4f6a8a, pants: 0x2e3a4a, accessory: 'cap' },
  },
  {
    id: 'julian',
    name: 'Julián Paredes',
    age: 51,
    occupation: 'Granjero',
    bio: 'Cultiva el huerto del pueblo. Habla poco, calcula mucho y nunca regala nada.',
    traits: ['cauteloso', 'ahorrador', 'madrugador'],
    relationships: [
      { id: 'mateo', label: 'sobrino' },
      { id: 'nicolas', label: 'le vende verduras' },
      { id: 'hugo', label: 'compañero de silencios' },
    ],
    home: 'h12',
    routine: { field: 7, shop: 1, street: 1, home: 2 },
    look: { skin: SKIN.tan, hair: HAIR.brown, hairStyle: 'short', shirt: 0x8a9a5b, pants: 0x5a4a3a, accessory: 'hat' },
  },
  {
    id: 'valeria',
    name: 'Valeria Campos',
    age: 31,
    occupation: 'Enfermera',
    bio: 'Atiende el pequeño consultorio y visita a los mayores. Mantiene la calma cuando nadie más puede.',
    traits: ['altruista', 'serena', 'responsable'],
    relationships: [
      { id: 'andres', label: 'pareja' },
      { id: 'marta', label: 'la cuida' },
      { id: 'carmen', label: 'amiga' },
    ],
    home: 'h7',
    routine: { visit: 3, plaza: 2, cafe: 2, shop: 1, park: 1, home: 2 },
    look: { skin: SKIN.light, hair: HAIR.blond, hairStyle: 'bun', shirt: 0x9cc4b8, pants: 0x9cc4b8 },
  },
  {
    id: 'nicolas',
    name: 'Nicolás Ferrer',
    age: 58,
    occupation: 'Tendero',
    bio: 'Dueño de la única tienda. Ve una oportunidad de negocio en cada noticia.',
    traits: ['oportunista', 'tacaño', 'bien informado'],
    relationships: [
      { id: 'rosa', label: 'rival' },
      { id: 'julian', label: 'proveedor' },
      { id: 'ines', label: 'le debe favores' },
    ],
    home: 'shop',
    routine: { shop: 7, plaza: 1, cafe: 1 },
    look: { skin: SKIN.fair, hair: HAIR.grey, hairStyle: 'short', shirt: 0x7b6a9a, pants: 0x3b3531, accessory: 'glasses' },
  },
  {
    id: 'elena',
    name: 'Elena Soto',
    age: 24,
    occupation: 'Pintora',
    bio: 'Pinta el paisaje desde el parque. Ve magia en todo y confía en la gente con facilidad.',
    traits: ['soñadora', 'crédula', 'amable'],
    relationships: [
      { id: 'lucia', label: 'amiga cercana' },
      { id: 'mateo', label: 'la sigue a todos lados' },
      { id: 'hugo', label: 'le fascinan sus historias' },
    ],
    home: 'h8',
    routine: { park: 4, riverbank: 2, fountain: 2, bridge: 1, forest: 1, home: 1 },
    look: { skin: SKIN.light, hair: HAIR.red, hairStyle: 'long', shirt: 0xe8c170, pants: 0x6a8a7a },
  },
  {
    id: 'hugo',
    name: 'Hugo Castañeda',
    age: 63,
    occupation: 'Pescador',
    bio: 'Vive solo en una cabaña al otro lado del río. Supersticioso y de pocas palabras.',
    traits: ['solitario', 'supersticioso', 'independiente'],
    relationships: [
      { id: 'marta', label: 'la única en quien confía' },
      { id: 'andres', label: 'lo vigila demasiado' },
      { id: 'julian', label: 'compañero de silencios' },
    ],
    home: 'cabin',
    routine: { riverbank: 6, forest: 3, bridge: 1, home: 2 },
    look: { skin: SKIN.brown, hair: HAIR.grey, hairStyle: 'short', shirt: 0x5a7a8a, pants: 0x4a3f36, accessory: 'hat' },
  },
  {
    id: 'ines',
    name: 'Inés Del Río',
    age: 40,
    occupation: 'Secretaria del ayuntamiento',
    bio: 'Mano derecha del alcalde actual. Organizada, formal y leal a las instituciones.',
    traits: ['organizada', 'leal', 'formal'],
    relationships: [
      { id: 'ernesto', label: 'el exalcalde la critica' },
      { id: 'andres', label: 'colega' },
      { id: 'nicolas', label: 'le hace favores' },
    ],
    home: 'h9',
    routine: { townhall: 6, cafe: 1, plaza: 1, home: 2 },
    look: { skin: SKIN.tan, hair: HAIR.black, hairStyle: 'bun', shirt: 0x3f5a7a, pants: 0x2e2a26, accessory: 'bag' },
  },
  {
    id: 'pablo',
    name: 'Pablo Núñez',
    age: 26,
    occupation: 'Cartero',
    bio: 'Recorre el pueblo entero cada día. Hablador incansable, es la red social del pueblo.',
    traits: ['hablador', 'rápido', 'conoce a todos'],
    relationships: [
      { id: 'mateo', label: 'mejor amigo' },
      { id: 'tomas', label: 'amigo de la infancia' },
      { id: 'rosa', label: 'intercambian chismes' },
    ],
    home: 'h10',
    routine: { visit: 5, street: 3, plaza: 2, cafe: 1, townhall: 1, home: 1 },
    look: { skin: SKIN.deep, hair: HAIR.black, hairStyle: 'short', shirt: 0x5b8fb9, pants: 0x3c4f6b, accessory: 'bag' },
  },
  {
    id: 'marta',
    name: 'Marta Quiroga',
    age: 81,
    occupation: 'Abuela del pueblo',
    bio: 'La persona más anciana del pueblo. Ha visto de todo y no se deja engañar por desconocidos.',
    traits: ['sabia', 'paciente', 'desconfiada de forasteros'],
    relationships: [
      { id: 'rosa', label: 'mejor amiga' },
      { id: 'valeria', label: 'su enfermera' },
      { id: 'hugo', label: 'lo conoce desde niño' },
    ],
    home: 'h11',
    routine: { benches: 5, fountain: 2, home: 3 },
    look: { skin: SKIN.fair, hair: HAIR.white, hairStyle: 'bun', shirt: 0x9a7aa0, pants: 0x5a4a5a, accessory: 'cane' },
  },
]
