import type { EconomyRules } from '../../core/economy/economy'

/** Nerea's catch and Olmo's rice (with a little from Dalia and Yara) feed thirteen with nothing to spare; winter tests the granary. */
export const ECONOMY: EconomyRules = {
  jobs: {
    nerea: { income: 6, food: 5 },
    ines: { income: 1 },
    tobias: { income: 12 },
    marisol: { income: 10 },
    fermin: { income: 4 },
    lucia: { income: 3 },
    bruno: { income: 6 },
    olmo: { income: 5, food: 7 },
    dalia: { income: 4, food: 1 },
    gaspar: { income: 6 },
    rita: { income: 4 },
    anselmo: { income: 3 },
    yara: { income: 2, food: 1 },
  },
  startTreasury: 80,
  startGranary: 40,
  startPurse: 10,
  foodPrice: 2,
  taxRate: 0.2,
  guardWage: 3,
  guards: 4,
}
