import { useState } from 'react'
import type { StructuredExercise } from '@atlaslog/shared'
import type { PublicProgram } from '../../lib/shareApi.js'
import { IconX } from '../../components/icons/index.js'

interface Props {
  item: PublicProgram
  busy: boolean
  onGet: () => void
  onClose: () => void
}

function prescription(ex: StructuredExercise): string {
  if (ex.type === 'running') {
    return [ex.distanceKm && `${ex.distanceKm}km`, ex.durationMin && `${ex.durationMin}min`].filter(Boolean).join(' · ')
  }
  return `${ex.sets}×${ex.reps}${ex.pct ? ` @${Math.round(ex.pct * 100)}%` : ex.rpe !== undefined ? ` @RPE${ex.rpe}` : ''}`
}

export function PublicProgramSheet({ item, busy, onGet, onClose }: Props) {
  const { program } = item
  const [openWeek, setOpenWeek] = useState<string | null>(program.weeks[0]?.id ?? null)

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="sheet-handle" />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 className="t-display" style={{ margin: 0, fontSize: 22 }}>Preview Program</h3>
          <button className="btn-icon" onClick={onClose}><IconX size={18} /></button>
        </div>

        <div style={{
          background: 'rgba(212,255,58,0.06)', border: '1px solid rgba(212,255,58,0.2)',
          borderRadius: 12, padding: 14, marginBottom: 16,
        }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, marginBottom: 4 }}>
            {item.name}
          </div>
          {program.description && (
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10 }}>{program.description}</div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[`${program.totalWeeks} WEEKS`, `${program.daysPerWeek} DAYS/WK`, program.focus].map(t => (
              <span key={t} className="pill" style={{ fontSize: 9 }}>{t}</span>
            ))}
          </div>
        </div>

        <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 8 }}>WEEKS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          {program.weeks.map(w => {
            const open = openWeek === w.id
            return (
              <div key={w.id} style={{ background: 'var(--surface-2)', borderRadius: 10 }}>
                <button onClick={() => setOpenWeek(open ? null : w.id)}
                  style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', width: 'calc(100% - 24px)' }}>
                  <div className="t-mono" style={{ fontSize: 11, fontWeight: 700, minWidth: 60 }}>Week {w.weekNumber}</div>
                  <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', flex: 1 }}>
                    {w.phase} · {w.days.length} days
                  </div>
                  <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>{open ? '▲' : '▼'}</div>
                </button>
                {open && (
                  <div style={{ padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {w.days.map(d => (
                      <div key={d.id}>
                        <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>
                          {d.dayOfWeek}{d.focus ? ` · ${d.focus}` : ''}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {d.exercises.map((ex, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <span style={{ fontSize: 12, fontWeight: 600 }}>{ex.name}</span>
                                {ex.label && (
                                  <div className="t-mono" style={{ fontSize: 9, color: 'var(--muted)' }}>{ex.label}</div>
                                )}
                              </div>
                              <span className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>
                                {prescription(ex)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>ปิด</button>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={onGet} disabled={busy}>
            {busy ? '...' : 'GET PROGRAM'}
          </button>
        </div>
      </div>
    </div>
  )
}
