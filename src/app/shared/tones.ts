import type { Example } from '../../core/world/content'

/** How the interface names each tone of announcement. */
export const TONE_LABEL: Record<Example['tone'], string> = { trusted: 'Confiable', urgent: 'Urgente', suspicious: 'Sospechoso', emergency: 'Emergencia' }
