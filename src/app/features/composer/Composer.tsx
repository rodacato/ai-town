import { useEffect, useRef } from 'react'
import { speakerName } from '../../../core/reactions/announcement'
import type { Example } from '../../../core/world/content'
import { useTown } from '../../store'
import { MAX_ANNOUNCEMENT_LENGTH, type TruthChoice } from '../../store/composer'
import { town } from '../../town'
import { Megaphone } from '../../shared/icons'
import { PlaceChip } from '../../shared/PlaceChip'
import { SpeakerBadge } from '../../shared/SpeakerBadge'
import { SpeakerPicker } from './SpeakerPicker'
import { TrustMeter } from '../../shared/TrustMeter'
import { TONE_LABEL } from '../../shared/tones'
import './composer.css'


const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)

export function Composer() {
  const text = useTown((s) => s.draft.text)
  const speaker = useTown((s) => s.draft.speaker)
  const setDraft = useTown((s) => s.setDraft)
  const setText = (value: string) => {
    setDraft({ text: value })
    town.previewPlace(value)
  }
  const applyExample = (ex: Example) => {
    setDraft({ text: ex.text, speaker: ex.speaker })
    town.previewPlace(ex.text)
  }
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
      <header className="panel-header" title={town.content.copy.composerSubtitle}>
        <h2>{town.content.copy.composerTitle}</h2>
      </header>

      <div className="field">
        <span className="field-label">¿Quién lo anuncia?</span>
        <SpeakerPicker />
        <TrustMeter speaker={speaker} />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="announcement">
          Mensaje
        </label>
        <div className="textarea-wrap">
          <textarea
            id="announcement"
            ref={area}
            rows={2}
            value={text}
            placeholder="Ej. Esta tarde hay música en la plaza…"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                town.transmit()
              }
            }}
          />
          <div className="textarea-foot">
            <PlaceChip place={town.detectPlace(text)} />
            <span className={`counter mono ${text.length > MAX_ANNOUNCEMENT_LENGTH * 0.9 ? 'is-near' : ''}`}>
              {text.length}/{MAX_ANNOUNCEMENT_LENGTH}
            </span>
          </div>
        </div>
      </div>

      <TruthPicker />

      <button className="btn-primary composer-send" disabled={!canSend} onClick={() => town.transmit()}>
        <Megaphone width={17} height={17} />
        {town.content.copy.broadcast}
        <kbd>{isMac ? '⌘' : 'Ctrl'} ↵</kbd>
      </button>

      <div className="examples">
        <h3 className="section-label">Prueba con un ejemplo</h3>
        <ul>
          {town.content.examples.map((ex) => {
            const active = ex.text === text && ex.speaker.kind === speaker.kind
            return (
              <li key={ex.id}>
                <button className={`example ${active ? 'is-active' : ''}`} onClick={() => applyExample(ex)}>
                  <div className="example-top">
                    <SpeakerBadge speaker={ex.speaker} size={22} />
                    <span className="example-speaker">{speakerName(town.content, ex.speaker)}</span>
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

const TRUTHS: [TruthChoice, string][] = [
  ['true', 'Verdad'],
  ['false', 'Mentira'],
  ['random', 'Al azar'],
]

/** Decides, out of the residents' sight, whether the announcement comes true. */
function TruthPicker() {
  const truth = useTown((s) => s.draft.truth)
  const setDraft = useTown((s) => s.setDraft)
  return (
    <div className="field">
      <span className="field-label">¿Es verdad?</span>
      <div className="segmented" role="radiogroup" aria-label="Si el anuncio resulta cierto" style={{ ['--active' as string]: TRUTHS.findIndex(([k]) => k === truth) }}>
        <span className="segmented-thumb" aria-hidden />
        {TRUTHS.map(([k, label]) => (
          <button key={k} role="radio" aria-checked={truth === k} className={truth === k ? 'is-active' : ''} onClick={() => setDraft({ truth: k })}>
            {label}
          </button>
        ))}
      </div>
      <span className="field-hint">Los residentes no lo saben: se revela en el mapa cuando todos hayan decidido.</span>
    </div>
  )
}
