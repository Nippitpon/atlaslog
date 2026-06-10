import { useMemo } from 'react'
import { useAppStore } from '../../store/useAppStore.js'
import { getExercise } from '../../lib/utils.js'
import type { Session } from '@atlaslog/shared'

function SessionCard({ h }: { h: Session }) {
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

  return (
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

      {/* Exercise details */}
      {exerciseOrder.length > 0 && (
        <div style={{
          borderTop: '1px solid var(--border)',
          paddingTop: 10,
          display: 'flex', flexDirection: 'column', gap: 7,
        }}>
          {exerciseOrder.map(exId => {
            const meta = getExercise(exId)
            const sets = byExercise[exId]
            const top = sets.reduce((best, s) =>
              s.w > best.w || (s.w === best.w && s.r > best.r) ? s : best
            , sets[0])
            return (
              <div key={exId} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <div style={{
                  fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12,
                  color: 'var(--text-2)', flexShrink: 0, minWidth: 80,
                }}>
                  {meta.name}
                </div>
                <div className="t-mono tnum" style={{ fontSize: 11, color: 'var(--muted)' }}>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>{top.w}</span>
                  <span style={{ fontSize: 9, marginLeft: 1 }}>kg</span>
                  <span style={{ color: 'var(--muted)', margin: '0 3px' }}>×</span>
                  <span>{top.r}</span>
                  <span style={{ fontSize: 9, marginLeft: 1 }}>reps</span>
                  <span className="t-eyebrow" style={{ fontSize: 8, marginLeft: 6, color: 'var(--muted)' }}>
                    TOP SET
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function HistoryPage() {
  const { history } = useAppStore()

  const groups = useMemo(() => {
    const g: Record<string, typeof history> = {}
    history.forEach(h => {
      const d = new Date(h.date)
      const key = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()
      if (!g[key]) g[key] = []
      g[key].push(h)
    })
    return Object.entries(g)
  }, [history])

  return (
    <div className="atlas-screen screen-enter">
      <div className="scr-header">
        <div>
          <div className="sub">ALL SESSIONS</div>
          <h1>History</h1>
        </div>
      </div>

      {history.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)' }}>
          <p>No workouts logged yet.</p>
        </div>
      ) : groups.map(([month, items]) => (
        <div key={month} style={{ marginBottom: 28 }}>
          <div style={{ padding: '0 20px 12px' }}>
            <div className="t-eyebrow">{month}</div>
          </div>
          <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map(h => <SessionCard key={h.id} h={h} />)}
          </div>
        </div>
      ))}
    </div>
  )
}
