import type { Speaker } from '../../core/reactions/announcement'
import { useTown } from '../store'
import { town } from '../town'

/** How much the town believes a speaker, from their past announcements and, for the Baroness, how her guard did. */
export function TrustMeter({ speaker, label = 'Confianza del pueblo' }: { speaker: Speaker; label?: string }) {
  useTown((s) => s.memoryEntries)
  const rep = town.memory.reputation(speaker)
  const judged = rep.truths + rep.lies + rep.good + rep.bad
  const said = `${rep.truths} ${rep.truths === 1 ? 'verdad' : 'verdades'} · ${rep.lies} ${rep.lies === 1 ? 'mentira' : 'mentiras'}`
  const deeds = rep.good + rep.bad ? ` · guardia: ${rep.good} bien, ${rep.bad} mal` : ''
  const pct = Math.round(rep.trust * 100)
  const tone = !judged ? 'is-new' : rep.trust >= 0.6 ? 'is-high' : rep.trust < 0.4 ? 'is-low' : ''
  return (
    <div className={`trust-meter ${tone}`}>
      <span className="trust-label">{label}</span>
      <span className="trust-track" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
        <span className="trust-fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="mono trust-value">{judged ? `${pct}%` : '—'}</span>
      <span className="trust-detail">
        {judged ? said + deeds : 'Sin historial todavía'}
      </span>
    </div>
  )
}
