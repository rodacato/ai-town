import type { Speaker } from '../../core/reactions/announcement'
import { town } from '../town'
import { Avatar } from './Avatar'
import { Landmark, Stranger } from './icons'

export function SpeakerBadge({ speaker, size = 40 }: { speaker: Speaker; size?: number }) {
  if (speaker.kind === 'neighbor') {
    const r = town.content.residents.find((p) => p.id === speaker.residentId)
    if (r) return <Avatar look={r.look} size={size} />
  }
  const Icon = speaker.kind === 'authority' ? Landmark : Stranger
  return (
    <span className={`speaker-badge ${speaker.kind}`} style={{ width: size, height: size }}>
      <Icon width={size * 0.48} height={size * 0.48} />
    </span>
  )
}
