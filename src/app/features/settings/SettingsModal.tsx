import { useEffect, useRef, useState } from 'react'
import { PRESETS, keyRing, withKeys, type Connection, type LlmSettings, type ProviderKind } from '../../../providers/llm/config'
import { MAX_CONCURRENCY } from '../../../providers'
import { knownPrice } from '../../../providers/llm/pricing'
import { fetchModels, streamChat, transportMode, type TransportMode } from '../../../providers/llm/client'
import { useTown } from '../../store'
import { town } from '../../town'
import { Alert, Check, Close, Eye, EyeOff, Refresh } from '../../shared/icons'
import './settings.css'

const KINDS: ProviderKind[] = ['mock', 'anthropic', 'openai', 'shellm', 'custom']

type TestState = { status: 'idle' } | { status: 'running' } | { status: 'ok'; ms: number; reply: string } | { status: 'error'; message: string }
type ModelsState = { status: 'idle' | 'loading' } | { status: 'ok'; models: string[] } | { status: 'error'; message: string }

export function SettingsModal() {
  const open = useTown((s) => s.settingsOpen)
  const setOpen = useTown((s) => s.setSettingsOpen)
  if (!open) return null
  return <Dialog onClose={() => setOpen(false)} />
}

function Dialog({ onClose }: { onClose: () => void }) {
  const saved = useTown((s) => s.llm)
  const announcement = useTown((s) => s.announcement)
  const toast = useTown((s) => s.toast)
  const [draft, setDraft] = useState<LlmSettings>(saved)
  const [test, setTest] = useState<TestState>({ status: 'idle' })
  const [models, setModels] = useState<ModelsState>({ status: 'idle' })
  const [showKey, setShowKey] = useState(false)
  const [mode, setMode] = useState<TransportMode | null>(null)
  const [remember, setRemember] = useState(false)
  const [passphrase, setPassphrase] = useState('')
  const vaultLocked = useTown((s) => s.vaultLocked)

  useEffect(() => {
    void transportMode().then(setMode)
  }, [])
  const dialog = useRef<HTMLDivElement>(null)
  const kind = draft.active
  const conn = kind === 'mock' ? null : draft.connections[kind]

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose()
      if (e.key !== 'Tab' || !dialog.current) return
      const focusable = [...dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]), input, [tabindex]:not([tabindex="-1"])')]
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [onClose])

  useEffect(() => {
    setTest({ status: 'idle' })
    setModels({ status: 'idle' })
  }, [kind])

  const update = (patch: Partial<Connection>) => {
    if (kind === 'mock') return
    setDraft((d) => ({ ...d, connections: { ...d.connections, [kind]: { ...d.connections[kind], ...patch } } }))
    setTest({ status: 'idle' })
  }

  const loadModels = async () => {
    if (!conn) return
    setModels({ status: 'loading' })
    try {
      setModels({ status: 'ok', models: await fetchModels(conn) })
    } catch (err) {
      setModels({ status: 'error', message: err instanceof Error ? err.message : 'No se pudo cargar la lista.' })
    }
  }

  const runTest = async () => {
    if (!conn) return
    setTest({ status: 'running' })
    const t0 = performance.now()
    try {
      let reply = ''
      const signal = AbortSignal.timeout(60000)
      for await (const event of streamChat(conn, 'Responde únicamente con la palabra: listo', 'Prueba de conexión.', signal, { maxTokens: 1024, timeoutMs: 20_000 }))
        if (event.type === 'delta') reply += event.text
      setTest({ status: 'ok', ms: performance.now() - t0, reply: reply.trim().slice(0, 40) })
    } catch (err) {
      setTest({ status: 'error', message: err instanceof Error ? err.message : 'Falló la conexión.' })
    }
  }

  const save = async () => {
    town.applySettings(draft)
    if (remember) await town.rememberKeys(passphrase)
    const label = draft.active === 'mock' ? 'el modo simulado' : `${PRESETS[draft.active].label}${conn?.model ? ` (${conn.model})` : ''}`
    toast(announcement ? `Listo: las próximas decisiones las toma ${label}.` : `Listo: ahora decide ${label}.`)
    onClose()
  }

  const canSave = (kind === 'mock' || (!!conn?.host.trim() && !!conn.model.trim())) && (!remember || passphrase.length >= 8)
  const direct = mode === 'direct'
  const suggestions = models.status === 'ok' ? models.models.filter((m) => !conn?.model || m.toLowerCase().includes(conn.model.toLowerCase())).slice(0, 14) : []

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal panel" role="dialog" aria-modal="true" aria-labelledby="settings-title" ref={dialog}>
        <header className="modal-header">
          <div>
            <h2 id="settings-title">Modelo de decisiones</h2>
            <p>Elige quién piensa por los residentes de {town.content.name}.</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <Close />
          </button>
        </header>

        <div className="modal-body">
          {mode && (
            <p className={`mode-note ${direct ? 'is-direct' : ''}`}>
              {direct
                ? 'Conexión directa: tu navegador habla con el proveedor sin pasar por ningún servidor. El host debe permitir CORS desde esta página.'
                : 'Vía servidor local: las peticiones salen desde el servidor de Vite en tu máquina, sin límite de conexiones del navegador.'}
            </p>
          )}
          {vaultLocked && <VaultUnlock onUnlocked={() => setDraft((d) => withKeys(d, keyRing(useTown.getState().llm)))} />}
          <div className="provider-grid" role="radiogroup" aria-label="Proveedor">
            {KINDS.map((k) => (
              <button
                key={k}
                role="radio"
                aria-checked={kind === k}
                aria-label={`${PRESETS[k].label}: ${PRESETS[k].description}`}
                className={`provider-card ${kind === k ? 'is-active' : ''}`}
                onClick={() => setDraft((d) => ({ ...d, active: k }))}
              >
                <span className="provider-name">
                  {PRESETS[k].label}
                  {saved.active === k && <span className="provider-current">En uso</span>}
                </span>
                <span className="provider-desc">{PRESETS[k].description}</span>
              </button>
            ))}
          </div>

          {conn ? (
            <div className="conn-form" key={kind}>
              {!PRESETS[kind].protocolLocked && (
                <div className="field">
                  <span className="field-label">Formato de la API</span>
                  <div className="segmented two" style={{ ['--active' as string]: conn.protocol === 'openai' ? 0 : 1 }}>
                    <span className="segmented-thumb" aria-hidden />
                    <button className={conn.protocol === 'openai' ? 'is-active' : ''} onClick={() => update({ protocol: 'openai' })}>
                      OpenAI · /v1/chat/completions
                    </button>
                    <button className={conn.protocol === 'anthropic' ? 'is-active' : ''} onClick={() => update({ protocol: 'anthropic' })}>
                      Anthropic · /v1/messages
                    </button>
                  </div>
                </div>
              )}

              <label className="field">
                <span className="field-label">Host</span>
                <input className="input mono" value={conn.host} placeholder={PRESETS[kind].hostHint} onChange={(e) => update({ host: e.target.value })} spellCheck={false} />
              </label>

              <div className="field">
                <label className="field-label" htmlFor="api-key">
                  API key
                </label>
                <div className="input-group">
                  <input
                    id="api-key"
                    className="input mono"
                    type={showKey ? 'text' : 'password'}
                    value={conn.apiKey}
                    placeholder={direct ? (PRESETS[kind].protocolLocked ? 'Necesaria en conexión directa' : 'Si tu host la pide') : `Vacía = usa ${PRESETS[kind].envKey} del archivo .env`}
                    onChange={(e) => update({ apiKey: e.target.value })}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button className="icon-btn" onClick={() => setShowKey((v) => !v)} aria-label={showKey ? 'Ocultar key' : 'Mostrar key'}>
                    {showKey ? <EyeOff /> : <Eye />}
                  </button>
                </div>
                <label className="check">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  Recordar mis keys en este navegador, cifradas con una frase
                </label>
                {remember && (
                  <input
                    className="input"
                    type="password"
                    value={passphrase}
                    placeholder="Frase secreta (8 caracteres o más); te la pediré al volver"
                    onChange={(e) => setPassphrase(e.target.value)}
                    autoComplete="new-password"
                    aria-label="Frase para cifrar las keys"
                  />
                )}
                <p className="field-hint">
                  Sin marcar, la key vive solo en esta pestaña y se borra al cerrarla. Usa keys dedicadas, con tope de gasto, y rótalas al terminar.
                </p>
              </div>

              <div className="field">
                <div className="field-row">
                  <label className="field-label" htmlFor="model">
                    Modelo
                  </label>
                  <button className="btn-link small" onClick={loadModels} disabled={models.status === 'loading'}>
                    <Refresh width={13} height={13} className={models.status === 'loading' ? 'spin' : ''} />
                    {models.status === 'ok' ? 'Recargar lista' : 'Cargar modelos del host'}
                  </button>
                </div>
                <input id="model" className="input mono" value={conn.model} placeholder={PRESETS[kind].modelHint} onChange={(e) => update({ model: e.target.value })} spellCheck={false} />
                {models.status === 'error' && <p className="field-error">{models.message}</p>}
                {models.status === 'ok' && (
                  <div className="model-chips">
                    {suggestions.length ? (
                      suggestions.map((m) => (
                        <button key={m} className={`model-chip mono ${m === conn.model ? 'is-active' : ''}`} onClick={() => update({ model: m })}>
                          {m}
                        </button>
                      ))
                    ) : (
                      <span className="field-hint">Ningún modelo coincide con «{conn.model}».</span>
                    )}
                  </div>
                )}
              </div>

              <div className="field">
                <div className="field-row">
                  <span className="field-label">Residentes pensando a la vez</span>
                  <span className="mono concurrency-value">{conn.concurrency}</span>
                </div>
                <input type="range" min={1} max={MAX_CONCURRENCY} value={conn.concurrency} onChange={(e) => update({ concurrency: Number(e.target.value) })} className="range" />
                {conn.concurrency > 8 ? (
                  <span className="field-hint is-warning">Prueba de carga: más de 8 a la vez puede saturar al proveedor, hacer que te limite o que rechace peticiones. El registro te mostrará dónde se atasca.</span>
                ) : (
                  <span className="field-hint">Más rápido con valores altos, pero el proveedor puede limitarte. Puedes cambiarlo a mitad de un pregón.</span>
                )}
              </div>

              <PriceFields key={kind} conn={conn} onChange={update} />

              {kind === 'shellm' && (
                <div className="notice">
                  <Alert width={16} height={16} />
                  <p>
                    SheLLM atiende tantos procesos a la vez como diga su <span className="mono">MAX_CONCURRENT</span> (2 por defecto; Codex, uno). Si aquí pides más, el resto espera en la cola de SheLLM y lo verás como «Esperando al modelo». En Codex, su propio aviso advierte que los filtros anti-abuso pueden suspender la cuenta. Para usar Codex, pon un modelo <span className="mono">codex</span> o <span className="mono">codex-…</span>.
                  </p>
                </div>
              )}

              <div className="test-row">
                <button className="btn-secondary compact" onClick={runTest} disabled={test.status === 'running' || !conn.model}>
                  {test.status === 'running' ? 'Probando…' : 'Probar conexión'}
                </button>
                {test.status === 'ok' && (
                  <span className="test-result ok">
                    <Check width={15} height={15} /> Respondió en {(test.ms / 1000).toFixed(1)} s{test.reply ? ` · «${test.reply}»` : ''}
                  </span>
                )}
                {test.status === 'error' && (
                  <span className="test-result error">
                    <Alert width={15} height={15} /> {test.message}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="mock-note">
              El modo simulado decide con reglas: confianza en quien habla, relaciones, rasgos y señales sospechosas del mensaje. Sirve para probar sin gastar nada.
            </div>
          )}
        </div>

        <footer className="modal-footer">
          <p className="privacy">
            Nada se envía a servidores de AI Town: no existen. {direct ? 'Tu navegador llama directo al proveedor.' : 'Las peticiones pasan por el servidor local de Vite.'}
          </p>
          <div className="modal-actions">
            <button className="btn-secondary compact" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn-primary compact" onClick={save} disabled={!canSave}>
              Guardar
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

function VaultUnlock({ onUnlocked }: { onUnlocked: () => void }) {
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const unlock = async () => {
    setBusy(true)
    setError('')
    try {
      await town.unlockKeys(pass)
      onUnlocked()
      useTown.getState().toast('Keys desbloqueadas para esta pestaña.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron abrir.')
    }
    setBusy(false)
  }
  return (
    <form
      className="vault-unlock"
      onSubmit={(e) => {
        e.preventDefault()
        void unlock()
      }}
    >
      <p>Tienes keys guardadas y cifradas en este navegador.</p>
      <div className="input-group">
        <input className="input" type="password" value={pass} placeholder="Tu frase secreta" onChange={(e) => setPass(e.target.value)} aria-label="Frase secreta" autoComplete="current-password" />
        <button className="btn-secondary compact" type="submit" disabled={!pass || busy}>
          {busy ? 'Abriendo…' : 'Desbloquear'}
        </button>
      </div>
      {error && <p className="field-error">{error}</p>}
      <button type="button" className="btn-link small" onClick={() => town.forgetRememberedKeys()}>
        Olvidar las keys guardadas
      </button>
    </form>
  )
}

/** Keeps the typed text so partial numbers like «0.» survive; the connection gets the parsed value. */
function PriceInput({ label, value, placeholder, onChange }: { label: string; value?: number; placeholder: string; onChange: (v: number | undefined) => void }) {
  const [text, setText] = useState(value === undefined ? '' : String(value))
  const set = (raw: string) => {
    setText(raw)
    const n = Number(raw.replace(',', '.'))
    if (raw.trim() === '') onChange(undefined)
    else if (Number.isFinite(n) && n >= 0) onChange(n)
  }
  return (
    <label>
      <span>{label}</span>
      <input className="input mono" inputMode="decimal" value={text} placeholder={placeholder} onChange={(e) => set(e.target.value)} />
    </label>
  )
}

/** Per-million-token prices for estimating cost when the host does not report it. */
function PriceFields({ conn, onChange }: { conn: Connection; onChange: (patch: Partial<Connection>) => void }) {
  const known = conn.kind === 'anthropic' ? knownPrice(conn.model) : null
  return (
    <fieldset className="field price-fields">
      <legend className="field-label">Precio por millón de tokens (USD)</legend>
      <div className="price-inputs">
        <PriceInput label="Entrada" value={conn.priceIn} placeholder={known ? String(known.input) : '—'} onChange={(priceIn) => onChange({ priceIn })} />
        <PriceInput label="Salida" value={conn.priceOut} placeholder={known ? String(known.output) : '—'} onChange={(priceOut) => onChange({ priceOut })} />
      </div>
      <span className="field-hint">
        {known
          ? 'Vacío usa el precio de lista de este modelo. Solo sirve para estimar; tu factura manda.'
          : 'Para estimar el costo de cada decisión cuando el host no lo reporta. Déjalo vacío para no estimar.'}
      </span>
    </fieldset>
  )
}
