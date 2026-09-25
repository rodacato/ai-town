import type { EconomyRules } from '../economy/economy'

export type Difficulty = 'normal' | 'hard' | 'cruel'

export const DIFFICULTIES: Difficulty[] = ['normal', 'hard', 'cruel']

/** Games saved before the code went English called the middle one «dura». */
export const asDifficulty = (value: unknown): Difficulty => (value === 'dura' ? 'hard' : DIFFICULTIES.includes(value as Difficulty) ? (value as Difficulty) : 'normal')

export interface DifficultyRules {
  label: string
  hint: string
  /** Days between blows of fate, the shortest and the longest wait. */
  gap: [number, number]
  /** Share of the blows that are good news (caravans, treasure); null keeps the plain draw. */
  boons: number | null
  /** What the treasury and the granary start with, against the world's own numbers. */
  reserves: number
  /** The whole year's harvest against the world's own. */
  harvest: number
  /** How hard every blow of fate hits, against a normal game. */
  harm: number
  /** Coins merchants ask per ration of grain. */
  rationCost: number
}

export const DIFFICULTY: Record<Difficulty, DifficultyRules> = {
  normal: { label: 'Normal', hint: 'Un golpe cada 2 a 4 días y reservas completas.', gap: [2, 4], boons: null, reserves: 1, harvest: 1, harm: 1, rationCost: 3 },
  hard: { label: 'Dura', hint: 'Golpes más seguidos y más duros, reservas al 70%, peor cosecha y grano más caro.', gap: [1, 3], boons: 0.15, reserves: 0.7, harvest: 0.85, harm: 1.25, rationCost: 4 },
  cruel: { label: 'Cruel', hint: 'Casi un golpe al día y la mitad más dañinos, pocas buenas noticias, media reserva, cosechas pobres y grano caro.', gap: [1, 2], boons: 0.08, reserves: 0.5, harvest: 0.7, harm: 1.5, rationCost: 5 },
}

/** The world's economy made harder: smaller reserves to start and a poorer harvest all year. */
export function withDifficulty(rules: EconomyRules, d: Difficulty): EconomyRules {
  const k = DIFFICULTY[d]
  return { ...rules, startTreasury: Math.round(rules.startTreasury * k.reserves), startGranary: Math.round(rules.startGranary * k.reserves), harvestFactor: k.harvest, harm: k.harm, rationCost: k.rationCost }
}
