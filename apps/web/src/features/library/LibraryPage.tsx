import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Exercise } from '@atlaslog/shared'
import { EXERCISES, MUSCLE_GROUPS } from '../../lib/data.js'
import { muscleColor } from '../../lib/utils.js'
import { useAppStore } from '../../store/useAppStore.js'
import { IconSearch, IconX, IconDumbbell, IconChevronRight, IconPlus } from '../../components/icons/index.js'

export function LibraryPage() {
  const navigate = useNavigate()
  const { workout, addExerciseToWorkout } = useAppStore()
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('All')
  const [selected, setSelected] = useState<Exercise | null>(null)
  const filtered = EXERCISES.filter(e => {
    const okG = group === 'All' || e.group === group
    const okQ = e.name.toLowerCase().includes(q.toLowerCase())
    return okG && okQ
  })

  const handleAddToWorkout = () => {
    if (!selected) return
    addExerciseToWorkout(selected.id)
    setSelected(null)
    navigate('/workout')
  }

  return (
    <div className="atlas-screen screen-enter">
      <div className="scr-header">
        <div>
          <div className="sub">{EXERCISES.length} EXERCISES</div>
          <h1>Library</h1>
        </div>
      </div>

      <div style={{ padding: '0 20px 14px' }}>
        <div className="search-bar">
          <IconSearch size={18} style={{ color: 'var(--muted)' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search exercises…" />
          {q && (
            <button onClick={() => setQ('')} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4 }}>
              <IconX size={16} />
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '0 20px 16px', overflowX: 'auto' }}>
        {MUSCLE_GROUPS.map(g => (
          <button key={g} onClick={() => setGroup(g)} className={`pill ${group === g ? 'pill-active' : ''}`} style={{ flexShrink: 0 }}>
            {g}
          </button>
        ))}
      </div>

      <div style={{ padding: '0 20px' }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>No matches.</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(ex => (
            <button key={ex.id} onClick={() => setSelected(ex)} style={{
              all: 'unset', cursor: 'pointer', boxSizing: 'border-box',
              display: 'flex', alignItems: 'center', gap: 14,
              padding: 12, background: 'var(--surface-1)',
              border: '1px solid var(--border)', borderRadius: 14,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: `${muscleColor(ex.group)}18`,
                border: `1px solid ${muscleColor(ex.group)}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: muscleColor(ex.group), flexShrink: 0,
              }}>
                <IconDumbbell size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>
                  {ex.name}
                </div>
                <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {ex.group} · {ex.equipment}
                </div>
              </div>
              <IconChevronRight size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            </button>
          ))}
        </div>
      </div>

      {/* Exercise action sheet */}
      {selected && (
        <div className="sheet-backdrop" onClick={() => setSelected(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: `${muscleColor(selected.group)}18`,
                border: `1px solid ${muscleColor(selected.group)}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: muscleColor(selected.group), flexShrink: 0,
              }}>
                <IconDumbbell size={22} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>{selected.name}</div>
                <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, textTransform: 'uppercase' }}>
                  {selected.group} · {selected.equipment}
                </div>
              </div>
            </div>

            {workout ? (
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleAddToWorkout}>
                <IconPlus size={18} stroke={2.5} /> Add to current workout
              </button>
            ) : (
              <>
                <p style={{ margin: '0 0 12px', color: 'var(--text-2)', fontSize: 13, lineHeight: 1.5 }}>
                  เริ่มซ้อมก่อนเพื่อเพิ่มท่านี้เข้าเซสชัน (จะถูกบันทึกใน History) หรือเพิ่มล่วงหน้าในวันซ้อมผ่านหน้า Programs
                </p>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => { setSelected(null); navigate('/programs') }}>
                  Go to Programs
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
