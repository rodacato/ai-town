import { useEffect } from 'react'
import { useTown } from '../store'
import { ActiveAnnouncement } from '../features/experiment/ActiveAnnouncement'
import { Composer } from '../features/composer/Composer'
import { Inspector } from '../features/inspector/Inspector'
import { ChevronDown, Megaphone } from '../shared/icons'
import { town } from '../town'

export function RightPanel() {
  const selectedId = useTown((s) => s.selectedId)
  const announcement = useTown((s) => s.announcement)
  const open = useTown((s) => s.panelOpen)
  const setOpen = useTown((s) => s.setPanelOpen)
  const view = selectedId ? `inspector-${selectedId}` : announcement ? `active-${announcement.id}` : 'composer'

  // Picking a resident on the map is asking to see them.
  useEffect(() => {
    if (selectedId) useTown.getState().setPanelOpen(true)
  }, [selectedId])

  const title = selectedId ? (town.content.residents.find((r) => r.id === selectedId)?.name ?? 'Residente') : announcement ? 'Pregón en curso' : town.content.copy.composerTitle

  return (
    <aside className={`right-panel panel ${open ? 'is-open' : 'is-folded'}`} aria-label="Panel lateral">
      {!(open && selectedId) && (
        <button className="panel-fold" onClick={() => setOpen(!open)} aria-expanded={open} title={open ? 'Plegar' : 'Desplegar (cierra Dios y Trono)'}>
          {!open && <Megaphone width={16} height={16} />}
          {!open && <span className="panel-fold-title">{title}</span>}
          <ChevronDown className="panel-fold-chevron" width={16} height={16} />
        </button>
      )}
      {open && (
        <div className="panel-scroll" key={view}>
          {selectedId ? <Inspector id={selectedId} /> : announcement ? <ActiveAnnouncement announcement={announcement} /> : <Composer />}
        </div>
      )}
    </aside>
  )
}
