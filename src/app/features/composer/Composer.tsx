import { useEffect, useRef } from 'react'
import { EXAMPLES, TONE_LABEL, speakerName } from '../../../worlds/serena/announcements'
import { detectPlace } from '../../../core/reactions/announcement'
import { MAX_ANNOUNCEMENT_LENGTH, useTown } from '../../store'
import { Megaphone } from '../../shared/icons'
import { PlaceChip } from '../../shared/PlaceChip'
import { SpeakerBadge } from '../../shared/SpeakerBadge'
import { SpeakerPicker } from './SpeakerPicker'

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)

export function Composer() {
  const text = useTown((s) => s.draft.text)
  const speaker = useTown((s) => s.draft.speaker)
  const { setDraftText, applyExample, transmit } = useTown.getState()
  const area = useRef<HTMLTextAreaElement>(null)
  const canSend = text.trim().length >= 3

  useEffect(() => {
    const el = area.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text])

  return (
    <div className="panel-view composer">
      <header className="panel-header">
        <h2>Nuevo anuncio</h2>
        <p>Lo que digas se escuchará en todo el pueblo.</p>
      </header>

      <div className="field">
        <span className="field-label">¿Quién lo anuncia?</span>
        <SpeakerPicker />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="announcement">
          Mensaje
        </label>
        <div className="textarea-wrap">
          <textarea
            id="announcement"
            ref={area}
            rows={3}
            value={text}
            placeholder="Ej. Esta tarde hay música en la plaza…"
            onChange={(e) => setDraftText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                transmit()
              }
            }}
          />
          <div className="textarea-foot">
            <PlaceChip place={detectPlace(text)} />
            <span className={`counter mono ${text.length > MAX_ANNOUNCEMENT_LENGTH * 0.9 ? 'is-near' : ''}`}>
              {text.length}/{MAX_ANNOUNCEMENT_LENGTH}
            </span>
          </div>
        </div>
      </div>

      <button className="btn-primary" disabled={!canSend} onClick={transmit}>
        <Megaphone width={17} height={17} />
        Transmitir anuncio
        <kbd>{isMac ? '⌘' : 'Ctrl'} ↵</kbd>
      </button>

      <div className="examples">
        <h3 className="section-label">Prueba con un ejemplo</h3>
        <ul>
          {EXAMPLES.map((ex) => {
            const active = ex.text === text && ex.speaker.kind === speaker.kind
            return (
              <li key={ex.id}>
                <button className={`example ${active ? 'is-active' : ''}`} onClick={() => applyExample(ex)}>
                  <div className="example-top">
                    <SpeakerBadge speaker={ex.speaker} size={22} />
                    <span className="example-speaker">{speakerName(ex.speaker)}</span>
                    <span className={`tone tone-${ex.tone}`}>{TONE_LABEL[ex.tone]}</span>
                  </div>
                  <p>{ex.text}</p>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
