import { useState } from 'react'
import { useTown } from '../store'
import { town } from '../town'

/** Opens the keys saved encrypted in this browser; forgetting them asks first, since it cannot be undone. */
export function VaultUnlock({ onUnlocked, autoFocus = false }: { onUnlocked?: () => void; autoFocus?: boolean }) {
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [forgetting, setForgetting] = useState(false)
  const unlock = async () => {
    setBusy(true)
    setError('')
    try {
      await town.unlockKeys(pass)
      onUnlocked?.()
      useTown.getState().toast('Keys desbloqueadas: se usan en esta pestaña y cada cambio se vuelve a guardar cifrado.')
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
      <p>Tienes keys guardadas y cifradas en este navegador. Escribe tu frase para usarlas.</p>
      <div className="input-group">
        <input className="input" type="password" value={pass} placeholder="Tu frase secreta" onChange={(e) => setPass(e.target.value)} aria-label="Frase secreta" autoComplete="current-password" autoFocus={autoFocus} />
        <button className="btn-secondary compact" type="submit" disabled={!pass || busy}>
          {busy ? 'Abriendo…' : 'Desbloquear'}
        </button>
      </div>
      {error && <p className="field-error">{error}</p>}
      {forgetting ? (
        <div className="vault-unlock-actions">
          <span>¿Borrar las keys guardadas? No se pueden recuperar.</span>
          <button type="button" className="btn-link small" onClick={() => setForgetting(false)}>
            No
          </button>
          <button
            type="button"
            className="btn-link small"
            onClick={() => {
              town.forgetRememberedKeys()
              useTown.getState().toast('Keys guardadas borradas de este navegador.')
            }}
          >
            Sí, borrarlas
          </button>
        </div>
      ) : (
        <button type="button" className="btn-link small" onClick={() => setForgetting(true)}>
          Olvidé la frase: borrar las keys guardadas
        </button>
      )}
    </form>
  )
}
