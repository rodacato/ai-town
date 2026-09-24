const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

/** Hour of the day, 0 to 24 with fractions; safe for any minute count, even negative. */
export const hourOf = (minutes: number) => (((minutes % 1440) + 1440) % 1440) / 60

export function formatClock(minutes: number) {
  const day = DAYS[Math.floor(minutes / 1440) % 7]
  const m = Math.floor(minutes) % 1440
  const hh = String(Math.floor(m / 60)).padStart(2, '0')
  const mm = String(m % 60).padStart(2, '0')
  return { day, time: `${hh}:${mm}` }
}
