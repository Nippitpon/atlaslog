import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Exercise } from '@atlaslog/shared'
import { EXERCISES, MUSCLE_GROUPS, EXERCISE_GROUPS, EQUIPMENT_OPTIONS, makeExerciseId } from '../../lib/data.js'
import { muscleColor } from '../../lib/utils.js'
import { useAppStore } from '../../store/useAppStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { IconSearch, IconX, IconDumbbell, IconChevronRight, IconPlus, IconTrash, IconCheck } from '../../components/icons/index.js'

const BUILTIN_IDS = new Set(EXERCISES.map(e => e.id))

export function LibraryPage() {
  const navigate = useNavigate()
  const { workout, addExerciseToWorkout, customExercises, addCustomExercise, removeCustomExercise } = useAppStore()
  const { isCoach, isAdmin } = useAuthStore()
  const canManage = isCoach || isAdmin

  const [q, setQ] = useState('')
  const [group, setGroup] = useState('All')
  const [selected, setSelected] = useState<Exercise | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const allExercises = useMemo(() => [...EXERCISES, ...customExercises], [customExercises])
  const filtered = allExercises.filter(e => {
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

  const handleDelete = (ex: Exercise) => {
    if (window.confirm(`Delete "${ex.name}" from the library?`)) removeCustomExercise(ex.id)
  }

  return (
    <div className="atlas-screen screen-enter">
      <div className="scr-header">
        <div>
          <div className="sub">{allExercises.length} EXERCISES</div>
          <h1>Library</h1>
        </div>
        {canManage && (
          <button className="btn-icon" onClick={() => setShowCreate(true)} aria-label="Add exercise">
            <IconPlus size={18} />
          </button>
        )}
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
          {filtered.map(ex => {
            const custom = !BUILTIN_IDS.has(ex.id)
            return (
              <div key={ex.id} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: 12, background: 'var(--surface-1)',
                border: '1px solid var(--border)', borderRadius: 14,
              }}>
                <button onClick={() => setSelected(ex)} style={{
                  all: 'unset', cursor: 'pointer', flex: 1, minWidth: 0,
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: `${muscleColor(ex.group)}18`,
                    border: `1px solid ${muscleColor(ex.group)}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: muscleColor(ex.group),
                  }}>
                    <IconDumbbell size={20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>{ex.name}</span>
                      {custom && <span className="pill" style={{ fontSize: 8, background: 'rgba(167,139,250,0.15)', borderColor: 'rgba(167,139,250,0.4)', color: '#a78bfa' }}>CUSTOM</span>}
                    </div>
                    <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {ex.group}{ex.equipment ? ` · ${ex.equipment}` : ''}
                    </div>
                  </div>
                </button>
                {custom && canManage ? (
                  <button onClick={() => handleDelete(ex)} aria-label="Delete exercise"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, flexShrink: 0 }}>
                    <IconTrash size={15} />
                  </button>
                ) : (
                  <IconChevronRight size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                )}
              </div>
            )
          })}
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
                  {selected.group}{selected.equipment ? ` · ${selected.equipment}` : ''}
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

      {showCreate && <CreateExerciseSheet
        takenIds={new Set(allExercises.map(e => e.id))}
        onCreate={ex => { addCustomExercise(ex); setShowCreate(false) }}
        onClose={() => setShowCreate(false)}
      />}
    </div>
  )
}

function CreateExerciseSheet({ takenIds, onCreate, onClose }: {
  takenIds: Set<string>
  onCreate: (ex: Exercise) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [group, setGroup] = useState('')
  const [equipment, setEquipment] = useState('')

  const canCreate = name.trim().length > 0 && group.length > 0

  const create = () => {
    if (!canCreate) return
    onCreate({
      id: makeExerciseId(name, takenIds),
      name: name.trim(),
      group,
      equipment: equipment.trim(),
    })
  }

  return (
    <div className="sheet-backdrop" onClick={onClose} style={{ zIndex: 100 }}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 className="t-display" style={{ margin: 0, fontSize: 20 }}>New Exercise</h3>
          <button className="btn-icon" onClick={onClose}><IconX size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>NAME *</div>
            <input className="input-num" type="text" value={name} placeholder="e.g. Hack Squat"
              onChange={e => setName(e.target.value)}
              style={{ width: '100%', textAlign: 'left', fontFamily: 'var(--font-display)', textTransform: 'none', fontSize: 15 }} />
          </div>

          <div>
            <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>MUSCLE GROUP *</div>
            <select value={group} onChange={e => setGroup(e.target.value)}
              style={{
                width: '100%', height: 48, background: 'var(--surface-2)', border: `1px solid ${group ? 'var(--border)' : 'var(--border)'}`,
                borderRadius: 12, color: group ? 'var(--text)' : 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 14, padding: '0 12px',
              }}>
              <option value="" disabled>Select group…</option>
              {EXERCISE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div>
            <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>EQUIPMENT (optional)</div>
            <input className="input-num" type="text" list="equipment-options" value={equipment}
              placeholder="Choose or type…" onChange={e => setEquipment(e.target.value)}
              style={{ width: '100%', textAlign: 'left', fontFamily: 'var(--font-mono)', textTransform: 'none', fontSize: 14 }} />
            <datalist id="equipment-options">
              {EQUIPMENT_OPTIONS.map(o => <option key={o} value={o} />)}
            </datalist>
          </div>
        </div>

        <button className="btn btn-primary" style={{ width: '100%', marginTop: 18, opacity: canCreate ? 1 : 0.4 }}
          disabled={!canCreate} onClick={create}>
          <IconCheck size={18} stroke={3} /> Add to Library
        </button>
      </div>
    </div>
  )
}
