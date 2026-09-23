import { town } from '../../town'
import { Focus, Minus, Plus } from '../../shared/icons'

export function MapControls() {
  const zoom = (f: number) => town.zoomBy(f)
  return (
    <div className="map-controls panel" role="toolbar" aria-label="Controles del mapa">
      <button className="icon-btn" onClick={() => zoom(1.3)} aria-label="Acercar" data-tip="Acercar  +">
        <Plus />
      </button>
      <button className="icon-btn" onClick={() => zoom(1 / 1.3)} aria-label="Alejar" data-tip="Alejar  −">
        <Minus />
      </button>
      <div className="divider" />
      <button className="icon-btn" onClick={() => town.fit()} aria-label="Recentrar" data-tip="Ver todo el pueblo  0">
        <Focus />
      </button>
    </div>
  )
}
