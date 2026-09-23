import { placeLabel } from '../../core/reactions/announcement'
import { town } from '../town'
import { MapPin } from './icons'

export function PlaceChip({ place }: { place: string | null }) {
  const label = placeLabel(town.content, place)
  return (
    <span className={`place-chip ${label ? 'has-place' : ''}`} key={place ?? 'none'}>
      <MapPin width={13} height={13} />
      {label ? `Menciona ${label}` : 'Sin lugar concreto'}
    </span>
  )
}
