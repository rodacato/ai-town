import { alive, type Economy, type Laws } from '../economy/economy'

/** What a ruler can do. The same list serves a person on the throne and a model governing. */
export type Decree =
  | { kind: 'tax'; rate: number }
  | { kind: 'price'; price: number }
  | { kind: 'handout' }
  | { kind: 'buyFood'; rations: number }
  | { kind: 'bonus'; coins: number }
  | { kind: 'law'; law: keyof Laws; on: boolean }
  | { kind: 'festival' }

export interface DecreeResult {
  ok: boolean
  /** Why it could not be done, in words for the ruler. */
  reason?: string
  /** What happened, for the chronicle. */
  summary: string
  /** The proclamation that tells the town, if it is worth announcing. */
  proclamation?: string
}

export const LIMITS = { maxTax: 0.6, maxPrice: 6, rationCost: 3, festivalGold: 40, festivalFood: 15, maxBuy: 120, maxBonus: 10 }

/** What merchants ask per ration in this game. */
export const rationCost = (e: Economy) => e.rationCost ?? LIMITS.rationCost

const LAW_TEXT: Record<keyof Laws, [on: string, off: string]> = {
  curfew: ['Toque de queda: nadie en la calle desde el atardecer hasta el alba.', 'Se levanta el toque de queda.'],
  rationing: ['Racionamiento: media ración por cabeza hasta nuevo aviso.', 'Se acaba el racionamiento: raciones completas otra vez.'],
  levy: ['Leva: dos vecinos más se unen a la guardia.', 'Se licencia a los guardias de la leva.'],
}

/** Checks and applies a decree to the economy. Invalid decrees change nothing and say why. */
export function enact(e: Economy, d: Decree): DecreeResult {
  const fail = (reason: string): DecreeResult => ({ ok: false, reason, summary: reason })
  const pct = (x: number) => `${Math.round(x * 100)}%`
  const living = Object.keys(e.needs).filter((id) => alive(e, id))
  switch (d.kind) {
    case 'tax': {
      if (!(d.rate >= 0 && d.rate <= LIMITS.maxTax)) return fail(`El impuesto debe estar entre 0% y ${pct(LIMITS.maxTax)}.`)
      const before = e.taxRate
      e.taxRate = Math.round(d.rate * 100) / 100
      if (e.taxRate === before) return fail(`El impuesto ya es del ${pct(before)}.`)
      return {
        ok: true,
        summary: `Impuesto del ${pct(before)} al ${pct(e.taxRate)}.`,
        proclamation: `Por orden de la Baronesa, el impuesto ${e.taxRate > before ? 'sube' : 'baja'} del ${pct(before)} al ${pct(e.taxRate)} de lo que gane cada cual.`,
      }
    }
    case 'price': {
      if (!(Number.isInteger(d.price) && d.price >= 0 && d.price <= LIMITS.maxPrice)) return fail(`El precio de la ración debe ser entre 0 y ${LIMITS.maxPrice} monedas.`)
      const before = e.foodPrice
      if (d.price === before) return fail(`La ración ya cuesta ${before} monedas.`)
      e.foodPrice = d.price
      return {
        ok: true,
        summary: `La ración pasa de ${before} a ${d.price} monedas.`,
        proclamation: d.price === 0 ? 'Por orden de la Baronesa, el granero real reparte las raciones gratis.' : `Por orden de la Baronesa, la ración del granero real pasa a costar ${d.price} monedas.`,
      }
    }
    case 'handout': {
      const hungry = living.filter((id) => e.needs[id].daysHungry > 0 || (e.purses[id] ?? 0) < e.foodPrice)
      if (!hungry.length) return fail('Nadie pasa hambre ahora mismo.')
      const fed = hungry.slice(0, Math.floor(e.granary))
      if (!fed.length) return fail('El granero está vacío.')
      for (const id of fed) {
        const n = e.needs[id]
        e.granary -= 1
        n.daysHungry = 0
        n.status = 'ok'
        n.mood = Math.min(1, n.mood + 0.08)
      }
      return {
        ok: true,
        summary: `Reparto de comida: ${fed.length} raciones para quien no podía comer${fed.length < hungry.length ? ` (${hungry.length - fed.length} se quedaron sin nada)` : ''}.`,
        proclamation: 'La Baronesa abre el granero: hoy nadie se queda sin comer.',
      }
    }
    case 'buyFood': {
      if (!(Number.isInteger(d.rations) && d.rations > 0 && d.rations <= LIMITS.maxBuy)) return fail(`Se pueden comprar entre 1 y ${LIMITS.maxBuy} raciones.`)
      const cost = d.rations * rationCost(e)
      if (cost > e.treasury) return fail(`No alcanza el tesoro: ${d.rations} raciones cuestan ${cost} monedas y hay ${e.treasury}.`)
      e.treasury -= cost
      e.granary += d.rations
      return { ok: true, summary: `Compra de ${d.rations} raciones a mercaderes por ${cost} monedas.` }
    }
    case 'bonus': {
      if (!(Number.isInteger(d.coins) && d.coins > 0 && d.coins <= LIMITS.maxBonus)) return fail(`La paga extra debe ser entre 1 y ${LIMITS.maxBonus} monedas por cabeza.`)
      const cost = d.coins * living.length
      if (cost > e.treasury) return fail(`No alcanza el tesoro: la paga cuesta ${cost} monedas y hay ${e.treasury}.`)
      e.treasury -= cost
      for (const id of living) {
        e.purses[id] = (e.purses[id] ?? 0) + d.coins
        e.needs[id].mood = Math.min(1, e.needs[id].mood + 0.03 * d.coins)
      }
      return {
        ok: true,
        summary: `Paga extra de ${d.coins} monedas por cabeza (${cost} en total).`,
        proclamation: `La Baronesa regala ${d.coins} monedas a cada vecino.`,
      }
    }
    case 'law': {
      if (!(d.law in LAW_TEXT)) return fail('Esa ley no existe.')
      if (e.laws[d.law] === d.on) return fail(d.on ? 'Esa ley ya está en vigor.' : 'Esa ley no estaba en vigor.')
      e.laws[d.law] = d.on
      const text = LAW_TEXT[d.law][d.on ? 0 : 1]
      return { ok: true, summary: text, proclamation: `Por orden de la Baronesa: ${text.charAt(0).toLowerCase()}${text.slice(1)}` }
    }
    case 'festival': {
      if (e.treasury < LIMITS.festivalGold) return fail(`Una fiesta cuesta ${LIMITS.festivalGold} monedas y hay ${e.treasury}.`)
      if (e.granary < LIMITS.festivalFood) return fail(`Una fiesta necesita ${LIMITS.festivalFood} raciones y hay ${Math.floor(e.granary)}.`)
      e.treasury -= LIMITS.festivalGold
      e.granary -= LIMITS.festivalFood
      return {
        ok: true,
        summary: `Fiesta en la plaza: ${LIMITS.festivalGold} monedas y ${LIMITS.festivalFood} raciones.`,
        proclamation: '¡Por orden de la Baronesa, esta tarde hay fiesta en la Plaza del Pregón, con banquete y aguamiel para todos!',
      }
    }
  }
}
