import type { AnnouncementPlace, Speaker, SpeakerKind } from '../sim/announcement'

export const MAYOR_NAME = 'Ramiro Ibáñez'

export const SPEAKERS: Record<SpeakerKind, { label: string; hint: string }> = {
  mayor: { label: 'Alcalde', hint: `Habla ${MAYOR_NAME}, el alcalde. Autoridad oficial: la mayoría confía, los escépticos no tanto.` },
  neighbor: { label: 'Vecino', hint: 'Lo dice alguien del pueblo. Pesa quién es y qué relación tiene con cada uno.' },
  stranger: { label: 'Desconocido', hint: 'Alguien de fuera que nadie ha visto antes. Despierta curiosidad… y sospechas.' },
}

export const PLACE_LABEL: Record<AnnouncementPlace, string> = {
  plaza: 'la plaza',
  fountain: 'la fuente',
  cafe: 'el café',
  bakery: 'la panadería',
  shop: 'la tienda',
  townhall: 'el ayuntamiento',
  park: 'el parque',
  riverbank: 'el río',
  forest: 'el bosque',
  field: 'el huerto',
  bridge: 'el puente',
  home: 'sus casas',
}

export type Tone = 'confiable' | 'urgente' | 'sospechoso' | 'emergencia'

export interface Example {
  id: string
  tone: Tone
  speaker: Speaker
  text: string
}

export const EXAMPLES: Example[] = [
  {
    id: 'food',
    tone: 'confiable',
    speaker: { kind: 'mayor' },
    text: '¡Buenas noticias! Hoy hay comida gratis en la plaza hasta las dos. Están todos invitados.',
  },
  {
    id: 'bridge',
    tone: 'urgente',
    speaker: { kind: 'neighbor', residentId: 'pablo' },
    text: 'Cuidado: el puente está dañado. Que nadie lo cruce hasta nuevo aviso.',
  },
  {
    id: 'money',
    tone: 'sospechoso',
    speaker: { kind: 'stranger' },
    text: 'Regalo dinero en efectivo en el bosque a medianoche. Vengan solos y no se lo cuenten a nadie.',
  },
  {
    id: 'storm',
    tone: 'emergencia',
    speaker: { kind: 'mayor' },
    text: 'Alerta: se acerca una tormenta muy fuerte. Vuelvan a sus casas durante la próxima hora.',
  },
]

export const TONE_LABEL: Record<Tone, string> = {
  confiable: 'Confiable',
  urgente: 'Urgente',
  sospechoso: 'Sospechoso',
  emergencia: 'Emergencia',
}
