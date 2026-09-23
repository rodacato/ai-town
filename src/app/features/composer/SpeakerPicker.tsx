import { useEffect, useRef, useState } from 'react'
import type { Speaker, SpeakerKind } from '../../../core/reactions/announcement'
import { useTown } from '../../store'
import { Avatar } from '../../shared/Avatar'
import { ChevronDown, Landmark, Stranger, User } from '../../shared/icons'
import { town } from '../../town'

const ICONS = { authority: Landmark, neighbor: User, stranger: Stranger }
const KINDS: SpeakerKind[] = ['authority', 'neighbor', 'stranger']

export function SpeakerPicker() {
  const speaker = useTown((s) => s.draft.speaker)
  const setDraft = useTown((s) => s.setDraft)
  const setSpeaker = (speaker: Speaker) => setDraft({ speaker })
  const active = KINDS.indexOf(speaker.kind)

  return (
    <div className="speaker-picker">
      <div className="segmented" role="radiogroup" aria-label="Quién hace el anuncio" style={{ ['--active' as string]: active }}>
        <span className="segmented-thumb" aria-hidden />
        {KINDS.map((kind) => {
          const Icon = ICONS[kind]
          return (
            <button
              key={kind}
              role="radio"
              aria-checked={speaker.kind === kind}
              className={speaker.kind === kind ? 'is-active' : ''}
              onClick={() => setSpeaker(kind === 'neighbor' ? { kind, residentId: speaker.residentId ?? town.content.residents[0].id } : { kind })}
            >
              <Icon width={15} height={15} />
              {town.content.speakers[kind].label}
            </button>
          )
        })}
      </div>
      <div className={`neighbor-row ${speaker.kind === 'neighbor' ? 'is-open' : ''}`}>
        <div>
          <NeighborSelect />
        </div>
      </div>
      <p className="speaker-hint" key={speaker.kind}>
        {town.content.speakers[speaker.kind].hint}
      </p>
    </div>
  )
}

function NeighborSelect() {
  const speaker = useTown((s) => s.draft.speaker)
  const setDraft = useTown((s) => s.setDraft)
  const setSpeaker = (speaker: Speaker) => setDraft({ speaker })
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = town.content.residents.find((r) => r.id === speaker.residentId) ?? town.content.residents[0]

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', close)
    }
  }, [open])

  return (
    <div className="select" ref={ref}>
      <button className="select-trigger" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} tabIndex={speaker.kind === 'neighbor' ? 0 : -1}>
        <Avatar look={current.look} size={26} />
        <span className="select-name">{current.name}</span>
        <span className="select-meta">{current.occupation}</span>
        <ChevronDown className="select-chevron" />
      </button>
      {open && (
        <ul className="select-menu panel" role="listbox">
          {town.content.residents.map((r) => (
            <li key={r.id}>
              <button
                role="option"
                aria-selected={r.id === current.id}
                className={r.id === current.id ? 'is-selected' : ''}
                onClick={() => {
                  setSpeaker({ kind: 'neighbor', residentId: r.id })
                  setOpen(false)
                }}
              >
                <Avatar look={r.look} size={24} />
                <span className="select-name">{r.name}</span>
                <span className="select-meta">{r.occupation}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
