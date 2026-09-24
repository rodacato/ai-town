import { SCALES, type Personality } from '../../../core/world/content'
import { levelOf, SCALE_LABEL } from '../../../core/world/personality'

/** The same profile the model and the rules mode decide from, laid out for people. */
export function PersonalityCard({ personality, name }: { personality: Personality; name: string }) {
  return (
    <section className="personality">
      <h3 className="section-label">Personalidad</h3>
      <p className="voice">«{personality.voice}»</p>
      <dl className="scales">
        {SCALES.map((k) => {
          const v = personality.scales[k]
          return (
            <div key={k} title={SCALE_LABEL[k].hint}>
              <dt>{SCALE_LABEL[k].name}</dt>
              <dd>
                <span className="scale-track" role="meter" aria-valuemin={0} aria-valuemax={1} aria-valuenow={v} aria-valuetext={`${levelOf(v)} (${v.toFixed(2)})`} aria-label={SCALE_LABEL[k].name}>
                  <span className="scale-fill" style={{ width: `${v * 100}%` }} />
                </span>
                <span className="scale-level">{levelOf(v)}</span>
              </dd>
            </div>
          )
        })}
      </dl>
      <div className="drives">
        <div>
          <span className="drive-label">Le importa</span>
          <div className="chips">
            {personality.values.map((v) => (
              <span key={v} className="chip">
                {v}
              </span>
            ))}
          </div>
        </div>
        <div>
          <span className="drive-label">Le da miedo</span>
          <div className="chips">
            {personality.fears.map((f) => (
              <span key={f} className="chip is-fear">
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>
      <details className="secret">
        <summary>Ver el secreto de {name}</summary>
        <p>{personality.secret}</p>
      </details>
    </section>
  )
}
