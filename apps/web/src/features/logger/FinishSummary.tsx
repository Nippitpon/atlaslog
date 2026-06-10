import type { Session } from '@atlaslog/shared'
import { IconCheck } from '../../components/icons/index.js'
import { getExercise } from '../../lib/utils.js'

interface FinishSummaryProps {
  session: Session
  onDone: () => void
}

export function FinishSummary({ session, onDone }: FinishSummaryProps) {
  // Top set per exercise
  const exerciseOrder: string[] = []
  const byExercise: Record<string, { w: number; r: number }[]> = {}
  session.exercises?.forEach(e => {
    e.sets.filter(s => s.done).forEach(s => {
      if (!byExercise[e.exerciseId]) {
        exerciseOrder.push(e.exerciseId)
        byExercise[e.exerciseId] = []
      }
      byExercise[e.exerciseId].push({ w: s.w, r: s.r })
    })
  })

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
            WORKOUT COMPLETE
          </div>
          <h2 className="t-display" style={{ fontSize: 24, margin: '6px 0 0', letterSpacing: '-0.02em' }}>
            {session.name}
          </h2>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
          {[
            { value: String(session.duration), unit: 'min' },
            { value: `${(session.volume / 1000).toFixed(1)}k`, unit: 'kg' },
            { value: String(session.setCount), unit: 'sets' },
          ].map((item, i) => (
            <div key={i} style={{ textAlign: 'center', padding: '12px 8px', background: 'var(--surface-2)', borderRadius: 12 }}>
              <div className="stat-big tnum" style={{ fontSize: 22 }}>{item.value}</div>
              <div className="t-eyebrow" style={{ fontSize: 8, marginTop: 4, color: 'var(--muted)' }}>{item.unit}</div>
            </div>
          ))}
        </div>

        {/* Top sets */}
        {exerciseOrder.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 10 }}>TOP SETS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
              {exerciseOrder.map((exId, i) => {
                const meta = getExercise(exId)
                const sets = byExercise[exId]
                const top = sets.reduce((best, s) =>
                  s.w > best.w || (s.w === best.w && s.r > best.r) ? s : best
                , sets[0])
                return (
                  <div key={exId} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: i % 2 === 0 ? 'var(--surface-2)' : 'var(--surface-1)',
                  }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13 }}>
                      {meta.name}
                    </span>
                    <div className="t-mono tnum" style={{ fontSize: 12 }}>
                      <span style={{ fontWeight: 700 }}>{top.w}</span>
                      <span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 1 }}>kg</span>
                      <span style={{ color: 'var(--muted)', margin: '0 4px' }}>×</span>
                      <span>{top.r}</span>
                      <span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 1 }}>reps</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <button className="btn btn-primary" style={{ width: '100%', height: 52 }} onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  )
}
