import type { WorldContent } from '../../core/world/content'
import { PARK, PLAZA, layout, riverX } from './layout'
import { RESIDENTS } from './residents'

const MAYOR = 'Ramiro Ibáñez'

export const serena: WorldContent = {
  id: 'serena',
  name: 'Villa Serena',
  tagline: 'Un pueblo tranquilo donde todo se sabe.',
  layout,
  gatheringPlace: 'plaza',
  homeLabel: 'sus casas',
  homeKeywords: ['casa', 'hogar', 'refugi', 'encierr'],
  places: [
    { id: 'plaza', name: 'la plaza', keywords: ['plaza', 'centro del pueblo'], spots: (q) => q.where((_, t) => t.kind === 'plaza' && !t.prop) },
    {
      id: 'fountain',
      name: 'la fuente',
      keywords: ['fuente'],
      spots: (q) => q.inRect({ x0: 11, y0: 13, x1: 15, y1: 17 }),
    },
    { id: 'benches', name: 'un banco', spots: (q) => q.where((_, t) => t.prop === 'bench') },
    { id: 'cafe', name: 'el café', keywords: ['cafe', 'cafeteria', 'glorieta'], spots: (q) => q.aroundDoor('cafe', 2) },
    { id: 'bakery', name: 'la panadería', keywords: ['panaderia', 'pan '], spots: (q) => q.aroundDoor('bakery', 2) },
    { id: 'shop', name: 'la tienda', keywords: ['tienda', 'ferrer'], spots: (q) => q.aroundDoor('shop', 2) },
    { id: 'townhall', name: 'el ayuntamiento', keywords: ['ayuntamiento', 'alcaldia'], spots: (q) => q.aroundDoor('townhall', 2) },
    { id: 'park', name: 'el parque', keywords: ['parque'], spots: (q) => q.where((p, t) => t.kind === 'grass' && p.x >= PARK.x0 && p.x <= PARK.x1 && p.y >= PARK.y0 && p.y <= PARK.y1) },
    { id: 'bridge', name: 'el puente', keywords: ['puente'], spots: (q) => q.where((_, t) => t.kind === 'bridge') },
    {
      id: 'riverbank',
      name: 'el río',
      keywords: ['rio', 'orilla'],
      spots: (q) => q.where((p, t) => t.kind === 'grass' && p.x === riverX(p.y) - 1 && p.y > 8 && p.y < 24),
    },
    { id: 'forest', name: 'el bosque', keywords: ['bosque'], spots: (q) => q.where((p, t) => t.kind === 'grass' && p.x > riverX(p.y) + 2) },
    { id: 'field', name: 'el huerto', keywords: ['huerto', 'granja', 'cosecha'], spots: (q) => q.where((_, t) => t.kind === 'field') },
    { id: 'street', name: 'la calle', spots: (q) => q.where((_, t) => t.kind === 'path') },
  ],
  residents: RESIDENTS,
  speakers: {
    authority: { label: 'Alcalde', name: `${MAYOR}, alcalde`, hint: `Habla ${MAYOR}, el alcalde. Autoridad oficial: la mayoría confía, los escépticos no tanto.` },
    neighbor: { label: 'Vecino', name: 'Un vecino', hint: 'Lo dice alguien del pueblo. Pesa quién es y qué relación tiene con cada uno.' },
    stranger: { label: 'Desconocido', name: 'Un desconocido', hint: 'Alguien de fuera que nadie ha visto antes. Despierta curiosidad… y sospechas.' },
  },
  authorityOrigin: { building: 'townhall' },
  strangerOrigin: { x: 13, y: PLAZA.y1 },
  examples: [
    { id: 'food', tone: 'confiable', speaker: { kind: 'authority' }, text: '¡Buenas noticias! Hoy hay comida gratis en la plaza hasta las dos. Están todos invitados.' },
    { id: 'bridge', tone: 'urgente', speaker: { kind: 'neighbor', residentId: 'pablo' }, text: 'Cuidado: el puente está dañado. Que nadie lo cruce hasta nuevo aviso.' },
    { id: 'money', tone: 'sospechoso', speaker: { kind: 'stranger' }, text: 'Regalo dinero en efectivo en el bosque a medianoche. Vengan solos y no se lo cuenten a nadie.' },
    { id: 'storm', tone: 'emergencia', speaker: { kind: 'authority' }, text: 'Alerta: se acerca una tormenta muy fuerte. Vuelvan a sus casas durante la próxima hora.' },
  ],
  vocabulary: {
    opportunity: ['gratis', 'regalo', 'regal', 'dinero', 'comida', 'fiesta', 'musica', 'premio', 'descuento', 'invitad', 'celebra'],
    danger: ['cuidado', 'peligro', 'danad', 'roto', 'tormenta', 'alerta', 'incendio', 'evacu', 'no lo cruce', 'no crucen', 'emergencia', 'inundac'],
    cues: [
      ['solos', 'vengan solos'],
      ['no se lo cuenten', 'no contárselo a nadie'],
      ['no se lo digan', 'no contárselo a nadie'],
      ['secreto', 'guardar el secreto'],
      ['medianoche', 'a medianoche'],
      ['efectivo', 'dinero en efectivo'],
    ],
  },
  copy: { composerTitle: 'Nuevo anuncio', composerSubtitle: 'Lo que digas se escuchará en todo el pueblo.', broadcast: 'Transmitir anuncio', onAir: 'En el aire' },
  promptSetting: 'Villa Serena es un pueblo pequeño y tranquilo de unos pocos cientos de habitantes, con una plaza con fuente, un río, un bosque y comercios familiares. Todos se conocen y los chismes corren rápido.',
}
