import { useState } from 'react'
import { useTown } from '../../store'
import type { Letter } from '../../store/reign'
import { Close, Download } from '../../shared/icons'
import { useDialog } from '../../shared/useDialog'
import { town } from '../../town'
import { download, stamp } from '../experiment/export'
import { letterKey, lettersMarkdown } from '../../ideas'
import { RULER } from '../../ruler'
import { viaLabel } from '../../via'
import './mailbox.css'

type Tab = 'game' | 'ideas'

export function MailboxModal() {
  const open = useTown((s) => s.mailboxOpen)
  return open ? <Mailbox /> : null
}

const close = () => {
  town.throne.markLettersSeen()
  useTown.setState({ mailboxOpen: false })
}

/** Every letter the Baroness wrote to the creator: answer them, keep the good ones as ideas, take them elsewhere. */
function Mailbox() {
  const mailbox = useTown((s) => s.mailbox)
  const ideas = useTown((s) => s.ideas)
  const [tab, setTab] = useState<Tab>(mailbox.length || !ideas.length ? 'game' : 'ideas')
  const dialog = useDialog<HTMLDivElement>(close)
  const letters = tab === 'game' ? [...mailbox].reverse() : [...ideas].reverse()
  const save = () => download(`letters-${tab === 'game' ? 'game' : 'ideas'}-${stamp()}.md`, lettersMarkdown([...letters].reverse(), tab === 'game' ? `Cartas ${RULER.of} en esta partida` : `Ideas del buzón ${RULER.of}`), 'text/markdown')
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal panel mailbox" role="dialog" aria-modal="true" aria-labelledby="mailbox-title" ref={dialog}>
        <div className="modal-header">
          <div>
            <h2 id="mailbox-title">Buzón {RULER.of}</h2>
            <p>Lo que le pide a quien creó este mundo. Nada se aplica solo; si le contestas, lo lee en su próximo informe.</p>
          </div>
          <button className="icon-btn" onClick={close} aria-label="Cerrar">
            <Close />
          </button>
        </div>
        <div className="modal-body">
          <div className="mailbox-bar">
            <div className="segmented" role="tablist" aria-label="Qué cartas ver" style={{ ['--cols' as string]: 2, ['--active' as string]: tab === 'game' ? 0 : 1 }}>
              <span className="segmented-thumb" aria-hidden />
              <button role="tab" aria-selected={tab === 'game'} className={tab === 'game' ? 'is-active' : ''} onClick={() => setTab('game')}>
                Esta partida <span className="mono">{mailbox.length}</span>
              </button>
              <button role="tab" aria-selected={tab === 'ideas'} className={tab === 'ideas' ? 'is-active' : ''} onClick={() => setTab('ideas')}>
                💡 Ideas <span className="mono">{ideas.length}</span>
              </button>
            </div>
            <button className="btn-secondary compact" onClick={save} disabled={!letters.length}>
              <Download width={14} height={14} /> Descargar en Markdown
            </button>
          </div>
          {letters.length ? (
            <ul className="letters">
              {letters.map((l) => (
                <LetterItem key={letterKey(l)} letter={l} archived={tab === 'ideas'} />
              ))}
            </ul>
          ) : (
            <p className="field-hint mailbox-empty">
              {tab === 'game' ? `${RULER.Title} aún no ha escrito. Escribe cuando gobierna con un modelo y echa algo en falta.` : 'Marca como idea las cartas que valga la pena guardar: siguen aquí aunque empieces otra partida.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function LetterItem({ letter: l, archived }: { letter: Letter; archived: boolean }) {
  const key = letterKey(l)
  const [draft, setDraft] = useState(l.reply ?? '')
  const [writing, setWriting] = useState(false)
  return (
    <li className={`letter ${l.seen ? '' : 'is-new'}`}>
      <div className="letter-meta">
        <span className="mono">Día {l.day + 1}</span>
        {l.via && <span>{viaLabel(l.via)}</span>}
        {!l.seen && <span className="letter-new">Nueva</span>}
      </div>
      <p className="letter-text">{l.text}</p>
      {l.reply && !writing && (
        <p className="letter-reply">
          <b>Tu respuesta{archived ? '' : l.delivered ? ' (ya la leyó)' : ' (la leerá al amanecer)'}:</b> {l.reply}
        </p>
      )}
      {writing && (
        <div className="letter-compose">
          <textarea className="input" rows={3} value={draft} maxLength={400} onChange={(e) => setDraft(e.target.value)} placeholder="Qué le contestas…" aria-label="Tu respuesta" />
          <div className="letter-actions">
            <button
              className="btn-secondary compact"
              onClick={() => {
                town.throne.reply(key, draft)
                setWriting(false)
              }}
            >
              Enviar respuesta
            </button>
            <button className="btn-link" onClick={() => setWriting(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {!writing && (
        <div className="letter-actions">
          {!archived && (
            <button className="btn-link" onClick={() => setWriting(true)}>
              {l.reply ? 'Cambiar respuesta' : 'Contestar'}
            </button>
          )}
          {archived ? (
            <button className="btn-link" onClick={() => town.throne.forgetIdea(key)}>
              Quitar de ideas
            </button>
          ) : (
            <button className="btn-link" onClick={() => town.throne.toggleIdea(key)} aria-pressed={!!l.idea}>
              {l.idea ? '💡 Guardada como idea' : 'Guardar como idea'}
            </button>
          )}
        </div>
      )}
    </li>
  )
}
