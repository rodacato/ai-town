import type { FateEvent } from './reign'

/** Today's blow of fate, once its hour has come and if it has not struck yet. */
export const dueFate = (calendar: FateEvent[], day: number, hour: number, lastDone: number) => calendar.find((f) => f.day === day && f.day > lastDone && hour >= f.hour)

/** Events whose time is up, and those still going on. */
export function splitDue<T extends { until: number }>(events: T[], minutes: number) {
  return { due: events.filter((x) => minutes >= x.until), going: events.filter((x) => minutes < x.until) }
}
