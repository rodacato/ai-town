import { MAYOR_NAME } from '../data/announcements'
import { RESIDENTS } from '../data/residents'
import type { Speaker } from '../sim/announcement'
import { Avatar } from './Avatar'
import { Landmark, Stranger } from './icons'

export function speakerName(speaker: Speaker) {
  if (speaker.kind === 'mayor') return `${MAYOR_NAME}, alcalde`
  if (speaker.kind === 'stranger') return 'Un desconocido'
  const r = RESIDENTS.find((p) => p.id === speaker.residentId)
  return r ? `${r.name}, vecino` : 'Un vecino'
}

export function SpeakerBadge({ speaker, size = 40 }: { speaker: Speaker; size?: number }) {
  if (speaker.kind === 'neighbor') {
    const r = RESIDENTS.find((p) => p.id === speaker.residentId)
    if (r) return <Avatar look={r.look} size={size} />
  }
  const Icon = speaker.kind === 'mayor' ? Landmark : Stranger
  return (
    <span className={`speaker-badge ${speaker.kind}`} style={{ width: size, height: size }}>
      <Icon width={size * 0.48} height={size * 0.48} />
    </span>
  )
}
