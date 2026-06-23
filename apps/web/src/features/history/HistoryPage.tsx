import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore.js'
import { getExercise, formatPace } from '../../lib/utils.js'
import { IconRun } from '../../components/icons/index.js'
import type { Session, RunEntry } from '@atlaslog/shared'

type TimelineItem =
  | { kind: 'session'; date: string; data: Session }
  | { kind: 'run'; date: string; data: RunEntry }

function RunCard({ r }: { r: RunEntry }) {
  return (
    <div className="card card-tight" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 48, flexShrink: 0,
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        borderRadius: 10, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '8px 0',
      }}>
        <div className="t-display tnum" style={{ fontSize: 18, lineHeight: 1 }}>
          {new Date(r.date).getDate()}
        </div>
        <div className="t-mono" style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>
          {new Date(r.date).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
          <IconRun size={15} style={{ color: 'var(--accent)' }} />
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16 }}>
            Run{r.note ? ` · ${r.note}` : ''}
          </div>
        </div>
        <div className="t-mono tnum" style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 10 }}>
          <span><span style={{ color: 'var(--text)', fontWeight: 600 }}>{r.distanceKm}</span>km</span>
          <span>·</span>
          <span>{Math.round(r.durationMin)}min</span>
          <span>·</span>
          <span>{formatPace(r.distanceKm, r.durationMin)}/km</span>
        </div>
      </div>
    </div>
  )
}

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
}

export function HistoryPage() {
  const navigate = useNavigate()
  const { history, runs } = useAppStore()

  const groups = useMemo(() => {
    const items: TimelineItem[] = [
      ...history.map((h): TimelineItem => ({ kind: 'session', date: h.date, data: h })),
      ...runs.map((r): TimelineItem => ({ kind: 'run', date: r.date, data: r })),
    ].sort((a, b) => b.date.localeCompare(a.date))

    const g: Record<string, TimelineItem[]> = {}
    items.forEach(it => {
      const key = new Date(it.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()
      if (!g[key]) g[key] = []
      g[key].push(it)
    })
    return Object.entries(g)
  }, [history, runs])

  const isEmpty = history.length === 0 && runs.length === 0

  return (
    <div className="atlas-screen screen-enter">
      <div className="scr-header">
        <div>
          <div className="sub">ALL SESSIONS</div>
          <h1>History</h1>
        </div>
      </div>

      {isEmpty ? (
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, marginBottom: 8 }}>
            No workouts yet
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 28, lineHeight: 1.5 }}>
            เริ่มบันทึกการซ้อมได้เลย<br />ทุก session จะถูกเก็บไว้ที่นี่
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/')} style={{ minWidth: 160 }}>
            Start a Workout
          </button>
        </div>
      ) : groups.map(([month, items]) => (
        <div key={month} style={{ marginBottom: 28 }}>
          <div style={{ padding: '0 20px 12px' }}>
            <div className="t-eyebrow">{month}</div>
          </div>
          <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map(it => it.kind === 'session'
              ? <SessionCard key={it.data.id} h={it.data} />
              : <RunCard key={it.data.id} r={it.data} />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
