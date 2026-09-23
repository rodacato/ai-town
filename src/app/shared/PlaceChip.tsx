import { PLACE_LABEL } from '../../worlds/serena/announcements'
import type { AnnouncementPlace } from '../../core/reactions/announcement'
import { MapPin } from './icons'

export function PlaceChip({ place }: { place: AnnouncementPlace | null }) {
  return (
    <span className={`place-chip ${place ? 'has-place' : ''}`} key={place ?? 'none'}>
      <MapPin width={13} height={13} />
      {place ? `Menciona ${PLACE_LABEL[place]}` : 'Sin lugar concreto'}
    </span>
  )
}
