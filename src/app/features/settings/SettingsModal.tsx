import { useEffect, useState } from 'react'
import { EFFORT_LABEL, PRESETS, keyRing, withKeys, type Connection, type LlmSettings, type ProviderKind } from '../../../providers/llm/config'
import { REASONING_EFFORTS } from '../../../providers/llm/transport'
import { MAX_CONCURRENCY } from '../../../providers'
import { knownPrice, PRICES_AS_OF } from '../../../providers/llm/pricing'
import { fetchModels, streamChat, transportMode, type TransportMode } from '../../../providers/llm/client'
import { useTown } from '../../store'
import { town } from '../../town'
import { Alert, Check, Close, Eye, EyeOff, Refresh } from '../../shared/icons'
import { NewGame } from '../../shared/NewGame'
import { VaultUnlock } from '../../shared/VaultUnlock'
import { useDialog } from '../../shared/useDialog'
import { chooseWorld, WORLDS } from '../../../worlds'
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
  const [mode, setMode] = useState<TransportMode | null>(null)
  const [remember, setRemember] = useState(false)
  const [passphrase, setPassphrase] = useState('')
  const vaultLocked = useTown((s) => s.vaultLocked)
  const vaultOpen = useTown((s) => s.vaultOpen)

  useEffect(() => {
    void transportMode().then(setMode)
  }, [])
  const dialog = useDialog<HTMLDivElement>(onClose, '[aria-checked="true"]')
  const kind = draft.active
  const conn = kind === 'mock' ? null : draft.connections[kind]

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
    if (remember && !vaultOpen) {
      try {
        await town.rememberKeys(passphrase)
      } catch (err) {
        return toast(err instanceof Error ? err.message : 'No se pudieron guardar las keys.')
      }
    }
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
        <div className="modal-header">
          <div>
            <h2 id="settings-title">Modelo de decisiones</h2>
            <p>Elige quién piensa por los residentes de {town.content.name}.</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <Close />
          </button>
        </div>

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

              <KeyField
                conn={conn}
                placeholder={direct ? (PRESETS[kind].protocolLocked ? 'Necesaria en conexión directa' : 'Si tu host la pide') : `Vacía = usa ${PRESETS[kind].envKey} del archivo .env`}
                onChange={(apiKey) => update({ apiKey })}
                remember={remember}
                setRemember={setRemember}
                passphrase={passphrase}
                setPassphrase={setPassphrase}
              />

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

              {conn.protocol === 'openai' && (
                <label className="field">
                  <span className="field-label">Esfuerzo de razonamiento</span>
                  <select className="input" value={conn.reasoningEffort ?? ''} onChange={(e) => update({ reasoningEffort: (e.target.value || undefined) as Connection['reasoningEffort'] })}>
                    <option value="">Lo que diga el host</option>
                    {REASONING_EFFORTS.map((e) => (
                      <option key={e} value={e}>
                        {EFFORT_LABEL[e]}
                      </option>
                    ))}
                  </select>
                  <span className="field-hint">
                    Cuánto piensa el modelo antes de responder. Menos esfuerzo responde antes y gasta menos; más, puede decidir mejor.{kind === 'shellm' ? ' Si no se indica, SheLLM usa medio con Claude.' : ' Los modelos que no razonan lo ignoran o lo rechazan.'}
                  </span>
                </label>
              )}

              <PriceFields key={kind} conn={conn} onChange={update} />

              {kind === 'shellm' && (
                <div className="notice">
                  <Alert width={16} height={16} />
                  <p>
                    SheLLM atiende tantos procesos a la vez como diga su <span className="mono">MAX_CONCURRENT</span> (4 por defecto desde SheLLM 1.9). Si aquí pides más, el resto espera en la cola de SheLLM y lo verás como «Esperando al modelo». En Codex, su propio aviso advierte que los filtros anti-abuso pueden suspender la cuenta. Para usar Codex, pon un modelo <span className="mono">codex</span> o <span className="mono">codex-…</span>.
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
          <WorldPicker />
          <section className="game-reset">
            <div>
              <span className="field-label">Partida</span>
              <p className="field-hint">Empieza de cero: pueblo, memoria, crónica, trono y calendario del destino. Tus modelos y keys se quedan.</p>
            </div>
            <NewGame onDone={onClose} />
          </section>
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

/** The API key, and whether and how it is kept: encrypted with a passphrase, or only in this tab. */
function KeyField({ conn, placeholder, onChange, remember, setRemember, passphrase, setPassphrase }: { conn: Connection; placeholder: string; onChange: (key: string) => void; remember: boolean; setRemember: (v: boolean) => void; passphrase: string; setPassphrase: (v: string) => void }) {
  const [showKey, setShowKey] = useState(false)
  const vaultLocked = useTown((s) => s.vaultLocked)
  const vaultOpen = useTown((s) => s.vaultOpen)
  return (
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
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <button className="icon-btn" onClick={() => setShowKey((v) => !v)} aria-label={showKey ? 'Ocultar key' : 'Mostrar key'}>
          {showKey ? <EyeOff /> : <Eye />}
        </button>
      </div>
      {vaultOpen ? (
        <p className="field-hint is-safe">🔒 Tus keys se guardan cifradas en este navegador; cada cambio se vuelve a cifrar al guardar.</p>
      ) : vaultLocked ? (
        <p className="field-hint is-warning">Desbloquea arriba tus keys guardadas antes de cambiarlas, o se perderán.</p>
      ) : (
        <label className="check">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Recordarlas cifradas en este navegador, con una frase (recomendado)
        </label>
      )}
      {remember && !vaultOpen && !vaultLocked && (
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
        {vaultOpen ? '' : 'Sin recordarla, la key vive solo en esta pestaña y se pierde al recargar o cerrarla. '}Usa keys dedicadas, con tope de gasto, y rótalas al terminar.
      </p>
    </div>
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
  const known = knownPrice(conn.model)
  const own = conn.priceModel === conn.model
  const set = (patch: Pick<Connection, 'priceIn'> | Pick<Connection, 'priceOut'>) => onChange({ ...(own ? {} : { priceIn: undefined, priceOut: undefined }), ...patch, priceModel: conn.model })
  return (
    <fieldset className="field price-fields">
      <legend className="field-label">Precio por millón de tokens (USD)</legend>
      <div className="price-inputs">
        <PriceInput key={`in-${conn.model}`} label="Entrada" value={own ? conn.priceIn : undefined} placeholder={known ? String(known.input) : '—'} onChange={(priceIn) => set({ priceIn })} />
        <PriceInput key={`out-${conn.model}`} label="Salida" value={own ? conn.priceOut : undefined} placeholder={known ? String(known.output) : '—'} onChange={(priceOut) => set({ priceOut })} />
      </div>
      <span className="field-hint">
        {known
          ? `Vacío usa el precio de lista de este modelo (revisado el ${PRICES_AS_OF}). Vale solo para ${conn.model}. Sirve para estimar; tu factura manda.`
          : `Sin precio, el costo sale como «sin precio», no como gratis. Lo que escribas vale solo para ${conn.model || 'este modelo'}.`}
      </span>
    </fieldset>
  )
}

/** Switches to another world; each keeps its own game, memory and chronicle, and the switch reloads the page. */
function WorldPicker() {
  const [id, setId] = useState(town.content.id)
  if (WORLDS.length < 2) return null
  const picked = WORLDS.find((w) => w.content.id === id)!.content
  return (
    <section className="game-reset">
      <div>
        <span className="field-label">Mundo</span>
        <p className="field-hint">{picked.tagline} Cada mundo guarda su propia partida.</p>
      </div>
      <div className="world-pick">
        <select className="input" value={id} onChange={(e) => setId(e.target.value)} aria-label="Mundo">
          {WORLDS.map((w) => (
            <option key={w.content.id} value={w.content.id}>
              {w.content.name}
            </option>
          ))}
        </select>
        <button
          className="btn-secondary compact"
          disabled={id === town.content.id}
          onClick={() => {
            town.save()
            chooseWorld(id)
            location.reload()
          }}
        >
          Ir a {picked.name}
        </button>
      </div>
    </section>
  )
}
