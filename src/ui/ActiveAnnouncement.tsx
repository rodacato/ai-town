import { speakerName } from '../data/announcements'
import type { Announcement } from '../sim/announcement'
import { formatClock } from '../sim/clock'
import { useTown } from '../store'
import { Reset } from './icons'
import { PlaceChip } from './PlaceChip'
import { SpeakerBadge } from './SpeakerBadge'

export function ActiveAnnouncement({ announcement }: { announcement: Announcement }) {
  const total = useTown((s) => s.sim.residents.length)
  const resetTown = useTown((s) => s.resetTown)
  const { day, time } = formatClock(announcement.minutes)

  return (
    <div className="panel-view active-announcement">
      <div className="on-air">
        <span className="on-air-dot" />
        En el aire
        <span className="on-air-time mono">
          {day} · {time}
        </span>
      </div>

      <figure className="quote">
        <blockquote>“{announcement.text}”</blockquote>
        <figcaption>
          <SpeakerBadge speaker={announcement.speaker} size={32} />
          <span>{speakerName(announcement.speaker)}</span>
        </figcaption>
      </figure>
      <PlaceChip place={announcement.place} />

      <div className="progress-card">
        <div className="progress-head">
          <span className="section-label">Reacciones</span>
          <span className="mono progress-count">0 / {total}</span>
        </div>
        <div className="progress-track">
          <span className="progress-fill shimmer" style={{ width: '100%' }} />
        </div>
        <p className="progress-note">El pueblo está escuchando el anuncio…</p>
      </div>

      <button className="btn-secondary" onClick={resetTown}>
        <Reset width={15} height={15} />
        Reiniciar y probar otro anuncio
      </button>
    </div>
  )
}
