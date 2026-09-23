import { useEffect, useRef, useState } from 'react'
import { PRESETS, type Connection, type LlmSettings, type ProviderKind } from '../../../providers/llm/config'
import { streamChat } from '../../../providers/llm/provider'
import { useTown } from '../../store'
import { town } from '../../town'
import { Alert, Check, Close, Eye, EyeOff, Refresh } from '../../shared/icons'

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
  const dialog = useRef<HTMLDivElement>(null)
  const kind = draft.active
  const conn = kind === 'mock' ? null : draft.connections[kind]

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
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
      const res = await fetch('/api/llm/models', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ connection: conn }) })
      const json = (await res.json()) as { models?: string[]; error?: string }
      if (!res.ok || json.error) throw new Error(json.error ?? `Error ${res.status}`)
      setModels({ status: 'ok', models: json.models ?? [] })
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
      for await (const delta of streamChat(conn, 'Responde únicamente con la palabra: listo', 'Prueba de conexión.', signal, 1024)) reply += delta
      setTest({ status: 'ok', ms: performance.now() - t0, reply: reply.trim().slice(0, 40) })
    } catch (err) {
      setTest({ status: 'error', message: err instanceof Error ? err.message : 'Falló la conexión.' })
    }
  }

  const save = () => {
    town.applySettings(draft)
    const label = draft.active === 'mock' ? 'el modo simulado' : `${PRESETS[draft.active].label}${conn?.model ? ` (${conn.model})` : ''}`
    toast(announcement ? `Listo: las próximas decisiones las toma ${label}.` : `Listo: ahora decide ${label}.`)
    onClose()
  }

  const canSave = kind === 'mock' || (!!conn?.host.trim() && !!conn.model.trim())
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
                    placeholder={`Vacía = usa ${PRESETS[kind].envKey} del archivo .env`}
                    onChange={(e) => update({ apiKey: e.target.value })}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button className="icon-btn" onClick={() => setShowKey((v) => !v)} aria-label={showKey ? 'Ocultar key' : 'Mostrar key'}>
                    {showKey ? <EyeOff /> : <Eye />}
                  </button>
                </div>
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
                <input type="range" min={1} max={8} value={conn.concurrency} onChange={(e) => update({ concurrency: Number(e.target.value) })} className="range" />
                <span className="field-hint">Más rápido con valores altos, pero el proveedor puede limitarte.</span>
              </div>

              {kind === 'shellm' && (
                <div className="notice">
                  <Alert width={16} height={16} />
                  <p>
                    SheLLM corre el CLI oficial y por defecto atiende <b>2 procesos a la vez</b> (Codex, uno). Con 16 residentes cada anuncio tarda más, y su propio aviso menciona que en Codex los filtros anti-abuso pueden suspender la cuenta. Mantén la concurrencia baja. Para usar Codex, pon un modelo <span className="mono">codex</span> o <span className="mono">codex-…</span>.
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
          <p className="privacy">La configuración y las keys se guardan solo en este navegador. Las peticiones pasan por el servidor local de Vite.</p>
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
