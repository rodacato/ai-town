const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export function formatClock(minutes: number) {
  const day = DAYS[(1 + Math.floor(minutes / 1440)) % 7]
  const m = Math.floor(minutes) % 1440
  const hh = String(Math.floor(m / 60)).padStart(2, '0')
  const mm = String(m % 60).padStart(2, '0')
  return { day, time: `${hh}:${mm}` }
}
