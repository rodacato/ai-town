import { missingKey, PRESETS, DEFAULT_SETTINGS } from '../../providers/llm/config'
import { useTown } from '../store'
import { useDialog } from '../shared/useDialog'
import { VaultUnlock } from '../shared/VaultUnlock'
import { town } from '../town'

const dismiss = () => useTown.setState({ keyGateDismissed: true })

/** On arrival, asks for what the chosen model needs: the passphrase of saved keys, or a key that was lost on reload. */
export function KeyGate() {
  const show = useTown((s) => s.keysChecked && !s.keyGateDismissed && !s.settingsOpen && (s.vaultLocked || missingKey(s.llm, s.envKeys)))
  return show ? <Gate /> : null
}

function Gate() {
  const { vaultLocked, llm } = useTown()
  const dialog = useDialog<HTMLDivElement>(dismiss, 'input, button')
  const label = llm.active === 'mock' ? '' : PRESETS[llm.active].label
  return (
    <div className="modal-backdrop">
      <div className="modal panel key-gate" role="dialog" aria-modal="true" aria-labelledby="key-gate-title" ref={dialog}>
        <header className="modal-header">
          <div>
            <h2 id="key-gate-title">{vaultLocked ? 'Tus keys están guardadas' : `Falta tu key de ${label}`}</h2>
            <p>
              {vaultLocked
                ? 'Están cifradas en este navegador; sin tu frase nadie puede leerlas, ni esta página.'
                : 'Una key que no guardas cifrada vive solo en la pestaña y se pierde al recargar. Sin ella, el modelo no puede responder.'}
            </p>
          </div>
        </header>
        <div className="modal-body">
          {vaultLocked ? (
            <VaultUnlock onUnlocked={dismiss} autoFocus />
          ) : (
            <p className="field-hint">Ponla de nuevo en Configuración y marca «Recordarlas cifradas» para que no vuelva a pasar.</p>
          )}
        </div>
        <footer className="modal-footer">
          <button className="btn-link small" onClick={dismiss}>
            Ahora no
          </button>
          <div className="modal-actions">
            <button
              className="btn-secondary compact"
              onClick={() => {
                town.applySettings({ ...llm, active: DEFAULT_SETTINGS.active })
                dismiss()
              }}
            >
              Usar el modo simulado
            </button>
            {!vaultLocked && (
              <button
                className="btn-primary compact"
                onClick={() => {
                  dismiss()
                  useTown.getState().setSettingsOpen(true)
                }}
              >
                Poner la key
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}
