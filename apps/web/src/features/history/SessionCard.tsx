import type { Session } from '@atlaslog/shared'
import { getExercise } from '../../lib/utils.js'

export function SessionCard({ h, onOpen }: { h: Session; onOpen?: () => void }) {
  const doneSets = (h.exercises ?? []).flatMap(e =>
    e.sets.filter(s => s.done).map(s => ({ exerciseId: e.exerciseId, isMain: e.isMain, w: s.w, r: s.r }))
  )

  // Group by exerciseId preserving order
  const exerciseOrder: string[] = []
  const byExercise: Record<string, { w: number; r: number }[]> = {}
  doneSets.forEach(s => {
    if (!byExercise[s.exerciseId]) {
      exerciseOrder.push(s.exerciseId)
      byExercise[s.exerciseId] = []
    }
    byExercise[s.exerciseId].push({ w: s.w, r: s.r })
  })

  const card = (
    <div className="card card-tight">
      {/* Session header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: exerciseOrder.length > 0 ? 12 : 0 }}>
        <div style={{
          width: 48, flexShrink: 0,
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 10, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: '8px 0',
        }}>
          <div className="t-display tnum" style={{ fontSize: 18, lineHeight: 1 }}>
            {new Date(h.date).getDate()}
          </div>
          <div className="t-mono" style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>
            {new Date(h.date).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, marginBottom: 4 }}>
            {h.name}
          </div>
          <div className="t-mono" style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 10 }}>
            <span>{h.duration}m</span>
            <span>·</span>
            <span>{h.setCount} sets</span>
            <span>·</span>
            <span className="tnum">{(h.volume / 1000).toFixed(1)}k kg</span>
          </div>
        </div>
      </div>

      {/* Exercise details — every recorded set, heaviest marked TOP */}
      {exerciseOrder.length > 0 && (
        <div style={{
          borderTop: '1px solid var(--border)',
          paddingTop: 10,
          display: 'flex', flexDirection: 'column', gap: 9,
        }}>
          {exerciseOrder.map(exId => {
            const meta = getExercise(exId)
            const sets = byExercise[exId]
            const topIdx = sets.reduce((bi, s, i) =>
              s.w > sets[bi].w || (s.w === sets[bi].w && s.r > sets[bi].r) ? i : bi
            , 0)
            return (
              <div key={exId} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <div style={{
                  fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12,
                  color: 'var(--text-2)', flexShrink: 0, minWidth: 80,
                }}>
                  {meta.name}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 8px', minWidth: 0 }}>
                  {sets.map((s, i) => (
                    <span key={i} className="t-mono tnum" style={{ fontSize: 11, color: 'var(--muted)' }}>
                      <span style={{ color: i === topIdx ? 'var(--text)' : 'var(--text-2)', fontWeight: i === topIdx ? 700 : 500 }}>{s.w}</span>
                      <span style={{ fontSize: 9, marginLeft: 1 }}>kg</span>
                      <span style={{ color: 'var(--muted)', margin: '0 2px' }}>×</span>
                      <span style={{ color: i === topIdx ? 'var(--text)' : 'var(--text-2)' }}>{s.r}</span>
                      {i === topIdx && (
                        <span className="t-eyebrow" style={{ fontSize: 8, marginLeft: 5, color: 'var(--accent)' }}>
                          TOP
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  // Safe to wrap the whole card: it holds no buttons of its own.
  if (!onOpen) return card
  return (
    <button onClick={onOpen} style={{ all: 'unset', cursor: 'pointer', boxSizing: 'border-box', display: 'block', width: '100%' }}>
      {card}
    </button>
  )
}
