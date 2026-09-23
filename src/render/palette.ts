/** Colors every world shares: ink, shadows and the reaction accents. */
export const PAL = {
  ink: 0x2e2a26,
  shadow: 0x3b3024,
  accent: 0xe07a5f,
  think: 0x6fa8c7,
  waterGlint: 0xf2fafc,
} as const

export const shade = (color: number, amount: number) => {
  const r = (color >> 16) & 255
  const g = (color >> 8) & 255
  const b = color & 255
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)))
  return (f(r) << 16) | (f(g) << 8) | f(b)
}
