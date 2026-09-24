import { useState } from 'react'
import { DIFFICULTIES, DIFFICULTY } from '../../core/realm/difficulty'
import { town } from '../town'
import { Reset } from './icons'

/** Starts the town over in a random season, Monday morning at double speed; asks first, and how hard it should be, since the whole game is lost. */
export function NewGame({ onDone }: { onDone?: () => void }) {
  const [sure, setSure] = useState(false)
  return sure ? (
    <div className="new-game" role="group" aria-label="Dificultad de la partida nueva">
      <span className="new-game-ask">¿Qué tan difícil? Se pierde la partida actual.</span>
      <div className="new-game-options">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            className={d === 'normal' ? 'btn-primary compact' : 'btn-secondary compact'}
            title={DIFFICULTY[d].hint}
            onClick={() => {
              town.reset(d)
              setSure(false)
              onDone?.()
            }}
          >
            {DIFFICULTY[d].label}
          </button>
        ))}
        <button className="btn-link small" onClick={() => setSure(false)}>
          Cancelar
        </button>
      </div>
    </div>
  ) : (
    <button className="btn-secondary compact new-game-start" onClick={() => setSure(true)} title="Estación al azar, lunes por la mañana, a ×2; eliges la dificultad">
      <Reset width={15} height={15} /> Nueva partida
    </button>
  )
}
