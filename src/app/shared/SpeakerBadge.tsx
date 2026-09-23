import { RESIDENTS } from '../../worlds/serena/residents'
import type { Speaker } from '../../core/reactions/announcement'
import { Avatar } from './Avatar'
import { Landmark, Stranger } from './icons'

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
