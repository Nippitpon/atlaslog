import type { Workout } from '@atlaslog/shared'
import { IconCheck } from '../../components/icons/index.js'
import { getExercise } from '../../lib/utils.js'
import { useAppStore } from '../../store/useAppStore.js'
import { sessionCalories, latestWeightKg } from '../../lib/calories.js'

interface FinishReviewProps {
  workout: Workout
  now: number
  onConfirm: () => void
  onCancel: () => void
}

export function FinishReview({ workout, now, onConfirm, onCancel }: FinishReviewProps) {
  const bodyMetrics = useAppStore(s => s.bodyMetrics)
  const duration = Math.max(1, Math.round((now - workout.startTime) / 60000))
  const volume = workout.exercises.reduce((s, e) =>
    s + e.sets.filter(x => x.done).reduce((ss, st) => ss + (st.w * st.r), 0), 0)
  const setCount = workout.exercises.reduce((s, e) => s + e.sets.filter(x => x.done).length, 0)
  const calories = sessionCalories({ exercises: workout.exercises, duration }, latestWeightKg(bodyMetrics))

  const done = workout.exercises
    .map((e, idx) => ({ key: `${e.exerciseId}-${idx}`, exerciseId: e.exerciseId, sets: e.sets.filter(s => s.done) }))
    .filter(e => e.sets.length > 0)

  return (
    <div className="sheet-backdrop" style={{ alignItems: 'flex-end', padding: 0 }}>
      <div style={{
        background: 'var(--surface-1)', border: '1px solid var(--border)',
        borderRadius: '24px 24px 0 0', padding: '24px 24px 32px', width: '100%',
        animation: 'slidein .3s cubic-bezier(.2,.7,.3,1) both',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 32, margin: '0 auto 14px',
            background: 'rgba(74,222,128,0.15)', border: '2px solid rgba(74,222,128,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <IconCheck size={30} stroke={2.5} style={{ color: '#4ade80' }} />
          </div>
          <div className="t-eyebrow" style={{ color: '#4ade80', letterSpacing: '0.12em', fontSize: 10 }}>
            REVIEW &amp; CONFIRM
          </div>
          <h2 className="t-display" style={{ fontSize: 24, margin: '6px 0 0', letterSpacing: '-0.02em' }}>
            {workout.name}
          </h2>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
          {[
            { value: String(duration), unit: 'min' },
            { value: `${(volume / 1000).toFixed(1)}k`, unit: 'kg' },
            { value: String(setCount), unit: 'sets' },
            { value: calories > 0 ? String(calories) : '—', unit: 'kcal' },
          ].map((item, i) => (
            <div key={i} style={{ textAlign: 'center', padding: '12px 4px', background: 'var(--surface-2)', borderRadius: 12 }}>
              <div className="stat-big tnum" style={{ fontSize: 18 }}>{item.value}</div>
              <div className="t-eyebrow" style={{ fontSize: 8, marginTop: 4, color: 'var(--muted)' }}>{item.unit}</div>
            </div>
          ))}
        </div>

        {/* Full per-set breakdown */}
        {done.length > 0 ? (
          <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {done.map(e => {
              const meta = getExercise(e.exerciseId)
              return (
                <div key={e.key}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8,
                  }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14 }}>
                      {meta.name}
                    </span>
                    <span className="t-eyebrow" style={{ fontSize: 9, color: 'var(--muted)' }}>
                      {e.sets.length} SET{e.sets.length !== 1 ? 'S' : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    {e.sets.map((s, i) => (
                      <div key={s.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '9px 14px',
                        background: i % 2 === 0 ? 'var(--surface-2)' : 'var(--surface-1)',
                      }}>
                        <span className="t-eyebrow" style={{ fontSize: 9, color: 'var(--muted)' }}>
                          SET {i + 1}
                        </span>
                        <div className="t-mono tnum" style={{ fontSize: 12 }}>
                          <span style={{ fontWeight: 700 }}>{s.w}</span>
                          <span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 1 }}>kg</span>
                          <span style={{ color: 'var(--muted)', margin: '0 4px' }}>×</span>
                          <span>{s.r}</span>
                          <span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 1 }}>reps</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, margin: '8px 0 20px' }}>
            No sets completed yet.
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" style={{ flex: 1, height: 52 }} onClick={onCancel}>
            Keep editing
          </button>
          <button className="btn btn-primary" style={{ flex: 1, height: 52 }} onClick={onConfirm}>
            Confirm &amp; Finish
          </button>
        </div>
      </div>
    </div>
  )
}
