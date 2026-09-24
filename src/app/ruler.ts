import { capital, ofThe, toThe } from '../core/realm/realmDef'
import { activeWorld } from '../worlds'

const r = activeWorld.content.realm?.ruler

/** How the interface names this world's ruler: bare for labels, with article inside a sentence, and at its start. */
export const RULER = {
  short: r?.short ?? 'Gobierno',
  title: r?.title ?? 'quien gobierna',
  Title: capital(r?.title ?? 'quien gobierna'),
  seat: r?.seat ?? 'el ayuntamiento',
  /** "de la Baronesa", "del Alcalde". */
  of: ofThe(r?.title ?? 'quien gobierna'),
  /** "a la Baronesa", "al Alcalde". */
  to: toThe(r?.title ?? 'quien gobierna'),
}
