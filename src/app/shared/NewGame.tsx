import { useState } from 'react'
import { town } from '../town'
import { Reset } from './icons'

/** Starts the town over in a random season, Monday morning at double speed; asks twice, since the whole game is lost. */
export function NewGame({ onDone }: { onDone?: () => void }) {
  const [sure, setSure] = useState(false)
  return sure ? (
    <div className="new-game">
      <button className="btn-secondary compact" onClick={() => setSure(false)}>
        No
      </button>
      <button
        className="btn-primary compact"
        onClick={() => {
          town.reset()
          onDone?.()
        }}
      >
        Sí, empezar otra
      </button>
    </div>
  ) : (
    <button className="btn-secondary compact new-game-start" onClick={() => setSure(true)} title="Estación al azar, lunes por la mañana, a ×2">
      <Reset width={15} height={15} /> Nueva partida
    </button>
  )
}
