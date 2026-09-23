import { useTown } from '../store'
import { ActiveAnnouncement } from '../features/experiment/ActiveAnnouncement'
import { Composer } from '../features/composer/Composer'
import { Inspector } from '../features/inspector/Inspector'

export function RightPanel() {
  const selectedId = useTown((s) => s.selectedId)
  const announcement = useTown((s) => s.announcement)
  const view = selectedId ? `inspector-${selectedId}` : announcement ? `active-${announcement.id}` : 'composer'

  return (
    <aside className="right-panel panel" aria-label="Panel lateral">
      <div className="panel-scroll" key={view}>
        {selectedId ? (
          <Inspector id={selectedId} />
        ) : announcement ? (
          <ActiveAnnouncement announcement={announcement} />
        ) : (
          <Composer />
        )}
      </div>
    </aside>
  )
}
