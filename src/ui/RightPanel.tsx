import { useTown } from '../store'
import { ActiveAnnouncement } from './ActiveAnnouncement'
import { Composer } from './Composer'
import { Inspector } from './Inspector'

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
