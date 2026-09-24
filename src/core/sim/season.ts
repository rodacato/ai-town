export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter']

export const SEASON_TEXT: Record<Season, { label: string; sentence: string }> = {
  spring: { label: 'Primavera', sentence: 'Es primavera.' },
  summer: { label: 'Verano', sentence: 'Es verano.' },
  autumn: { label: 'Otoño', sentence: 'Es otoño.' },
  winter: { label: 'Invierno', sentence: 'Es invierno.' },
}
