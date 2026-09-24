import type { PersonalityScales } from './content'

export const SCALE_LABEL: Record<keyof PersonalityScales, { name: string; hint: string }> = {
  credulity: { name: 'Credulidad', hint: 'cuánto se cree lo que oye' },
  bravery: { name: 'Valentía', hint: 'si va hacia el peligro o se aleja' },
  sociability: { name: 'Sociabilidad', hint: 'cuánto busca compañía y corre la voz' },
  authority: { name: 'Respeto a la autoridad', hint: 'cuánto pesa una orden oficial' },
  greed: { name: 'Codicia', hint: 'cuánto le tira el beneficio propio' },
}

export function levelOf(v: number) {
  return v < 0.2 ? 'muy baja' : v < 0.4 ? 'baja' : v < 0.6 ? 'media' : v < 0.8 ? 'alta' : 'muy alta'
}
