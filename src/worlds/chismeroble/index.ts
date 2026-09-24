import type { WorldContent } from '../../core/world/content'
import { CEMETERY, CRYPT, GATE, OAK, PLAZA, inForest, layout, riverX } from './layout'
import { RESIDENTS } from './residents'

const BARONESS = 'Baronesa Isolda'

export const chismeroble: WorldContent = {
  id: 'chismeroble',
  name: 'Chismeroble',
  tagline: 'Donde los rumores crecen más rápido que los robles.',
  layout,
  gatheringPlace: 'plaza',
  homeLabel: 'sus casas',
  homeKeywords: ['casa', 'hogar', 'refugi', 'encierr', 'atranquen'],
  places: [
    { id: 'plaza', name: 'la Plaza del Pregón', keywords: ['plaza', 'pregon'], spots: (q) => q.where((_, t) => t.kind === 'plaza' && !t.prop) },
    {
      id: 'oak',
      name: 'el Roble Chismoso',
      keywords: ['roble'],
      spots: (q) => q.inRect({ x0: OAK.x - 1, y0: OAK.y - 1, x1: OAK.x + OAK.size, y1: OAK.y + OAK.size }),
    },
    { id: 'benches', name: 'un banco', spots: (q) => q.where((_, t) => t.prop === 'bench') },
    { id: 'market', name: 'el mercado', keywords: ['mercado', 'puesto'], spots: (q) => q.inRect({ x0: PLAZA.x0, y0: PLAZA.y0, x1: PLAZA.x0 + 1, y1: PLAZA.y1 }) },
    { id: 'tavern', name: 'la taberna', keywords: ['taberna', 'jarra', 'grifo', 'posada'], spots: (q) => q.aroundDoor('tavern', 2) },
    { id: 'forge', name: 'la forja', keywords: ['forja', 'herreria', 'herrera'], spots: (q) => q.aroundDoor('forge', 2) },
    { id: 'potions', name: 'la tienda de pociones', keywords: ['pocion', 'pocima', 'alquimista'], spots: (q) => q.aroundDoor('potions', 2) },
    { id: 'temple', name: 'el templo', keywords: ['templo', 'capilla', 'altar'], spots: (q) => q.aroundDoor('temple', 2) },
    { id: 'tower', name: 'la torre del mago', keywords: ['torre', 'maga', 'mago'], spots: (q) => q.aroundDoor('tower', 2) },
    { id: 'keep', name: 'el torreón', keywords: ['torreon', 'castillo'], spots: (q) => q.aroundDoor('keep', 2) },
    { id: 'mill', name: 'el molino', keywords: ['molino', 'pan '], spots: (q) => q.aroundDoor('mill', 2) },
    { id: 'bridge', name: 'el puente de piedra', keywords: ['puente'], spots: (q) => q.where((_, t) => t.kind === 'bridge') },
    {
      id: 'riverbank',
      name: 'la orilla del río',
      keywords: ['rio', 'orilla'],
      spots: (q) => q.where((p, t) => t.kind === 'grass' && p.x === riverX(p.y) - 1 && p.y > 8 && p.y < 26),
    },
    {
      id: 'crypt',
      name: 'la Cripta de los Susurros',
      keywords: ['cripta', 'ruinas', 'catacumba'],
      spots: (q) => q.where((p) => Math.abs(p.x - (CRYPT.x + 1)) <= 3 && Math.abs(p.y - (CRYPT.y + 1)) <= 3),
    },
    {
      id: 'cemetery',
      name: 'el cementerio',
      keywords: ['cementerio', 'camposanto', 'tumba', 'sepultur'],
      spots: (q) => q.inRect({ x0: CEMETERY.x0 + 1, y0: CEMETERY.y0 + 1, x1: CEMETERY.x1 - 1, y1: CEMETERY.y1 - 1 }),
    },
    {
      id: 'gate',
      name: 'la puerta sur',
      keywords: ['puerta sur', 'empalizada', 'puesto de guardia', 'murall'],
      spots: (q) => q.where((p, t) => t.kind === 'path' && Math.abs(p.x - GATE.x) <= 2 && p.y >= GATE.y - 3 && p.y < GATE.y),
    },
    { id: 'forest', name: 'el Bosque Susurrante', keywords: ['bosque'], spots: (q) => q.where((p, t) => t.kind === 'grass' && inForest(p.x, p.y)) },
    { id: 'field', name: 'el huerto de calabazas', keywords: ['huerto', 'calabaza', 'granja', 'cosecha'], spots: (q) => q.where((_, t) => t.kind === 'field') },
    { id: 'street', name: 'el camino', spots: (q) => q.where((_, t) => t.kind === 'path') },
  ],
  residents: RESIDENTS,
  speakers: {
    authority: {
      label: 'Baronesa',
      name: `${BARONESS}, señora de Chismeroble`,
      hint: `Habla la ${BARONESS} por boca de su heraldo. Los legales obedecen; los caóticos, no tanto.`,
    },
    neighbor: { label: 'Vecino', name: 'Un vecino', hint: 'Lo pregona alguien de la aldea. Pesa quién es, su fama y qué relación tiene con cada uno.' },
    stranger: { label: 'Forastero', name: 'Un forastero encapuchado', hint: 'Alguien envuelto en una capa que nadie ha visto antes. Promete mucho y explica poco.' },
  },
  authorityOrigin: { building: 'keep' },
  strangerOrigin: { x: 14, y: PLAZA.y1 },
  examples: [
    {
      id: 'banquet',
      tone: 'confiable',
      speaker: { kind: 'authority' },
      text: '¡Por orden de la Baronesa! Esta tarde hay banquete gratis en la Plaza del Pregón: jabalí asado y aguamiel para todos.',
    },
    {
      id: 'troll',
      tone: 'urgente',
      speaker: { kind: 'neighbor', residentId: 'kael' },
      text: 'Cuidado: vi huellas de troll junto al puente de piedra. Que nadie lo cruce hasta que la guardia lo revise.',
    },
    {
      id: 'crypt',
      tone: 'sospechoso',
      speaker: { kind: 'stranger' },
      text: 'Pago cien monedas de oro a quien baje conmigo a la cripta a medianoche. Vengan solos y no se lo cuenten a nadie.',
    },
    {
      id: 'dragon',
      tone: 'emergencia',
      speaker: { kind: 'authority' },
      text: '¡Alerta! Refúgiense en sus casas y apaguen los fuegos: un dragón rojo sobrevuela el Bosque Susurrante.',
    },
  ],
  vocabulary: {
    opportunity: ['gratis', 'banquete', 'oro', 'moneda', 'tesoro', 'recompensa', 'aguamiel', 'regalo', 'fiesta', 'festin', 'pocion', 'premio', 'invitad'],
    danger: ['cuidado', 'peligro', 'alerta', 'dragon', 'troll', 'orco', 'lobo', 'bandido', 'peste', 'plaga', 'maldicion', 'ataque', 'no lo cruce', 'no crucen', 'refugi', 'incendio', 'no salgan'],
    cues: [
      ['solos', 'vengan solos'],
      ['no se lo cuenten', 'no contárselo a nadie'],
      ['no se lo digan', 'no contárselo a nadie'],
      ['secreto', 'guardar el secreto'],
      ['medianoche', 'a medianoche'],
      ['cripta', 'bajar a una cripta'],
      ['pacto', 'hacer un pacto'],
      ['sangre', 'firmar con sangre'],
    ],
  },
  outcomes: [
    { keywords: ['dragon', 'incendio', 'fuego'], visual: 'fire', label: 'el dragón incendió' },
    { keywords: ['troll', 'orco', 'ogro', 'lobo', 'bandido'], visual: 'monster', label: 'apareció una bestia en' },
    { keywords: ['banquete', 'festin', 'fiesta', 'aguamiel', 'comida'], visual: 'feast', label: 'hubo festín en' },
    { keywords: ['oro', 'moneda', 'tesoro', 'recompensa'], visual: 'treasure', label: 'el oro era real en' },
  ],
  promptSetting:
    'Chismeroble es una aldea de fantasía al estilo de Dragones y Mazmorras, gobernada por la Baronesa Isolda desde su torreón. En ella conviven humanos, elfos, enanos, medianos, gnomos, semiorcos y tiflins. La magia es real, los dragones y los trolls existen, en el Bosque Susurrante hay una cripta antigua, al sur está el cementerio y una empalizada con un puesto de guardia vigila la entrada del camino. Todos se conocen, el Roble Chismoso de la plaza es el centro de todos los rumores, y los chismes corren más rápido que los caballos.',
  copy: {
    composerTitle: 'Nuevo pregón',
    composerSubtitle: 'Lo que pregones se oirá en toda la aldea.',
    broadcast: 'Pregonar',
    onAir: 'Pregonando',
    noun: 'pregón',
    emptyHint: 'Haz un pregón para ver cómo decide cada residente.',
  },
}
