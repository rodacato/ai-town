import type { EconomyRules } from '../../core/economy/economy'

/**
 * Summer harvest (Godric, Ottokar, Kael, Elowen: 22 rations) barely feeds twenty mouths; autumn leaves a surplus
 * and winter yields a quarter, so the granary must be filled before the snow. The poorest live day to day.
 */
export const ECONOMY: EconomyRules = {
  jobs: {
    brunhilda: { income: 9 },
    finn: { income: 10 },
    mirabel: { income: 8 },
    aldric: { income: 6 },
    zafira: { income: 5 },
    clemencia: { income: 3 },
    pip: { income: 2 },
    grum: { income: 4 },
    elowen: { income: 2, food: 2 },
    bartolo: { income: 12 },
    rowan: { income: 3 },
    agnes: { income: 4 },
    godric: { income: 5, food: 9 },
    ottokar: { income: 5, food: 8 },
    kael: { income: 3, food: 3 },
    rosalinda: { income: 2 },
    lucio: { income: 5 },
    fizzwick: { income: 4 },
    ysolde: { income: 4 },
    mortimer: { income: 3 },
  },
  startTreasury: 120,
  startGranary: 60,
  startPurse: 10,
  foodPrice: 2,
  taxRate: 0.2,
  guardWage: 3,
  guards: 4,
}
