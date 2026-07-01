import { useState } from 'react'
import type { StructuredExercise } from '@atlaslog/shared'
import { allExercises } from '../../lib/data.js'
import { IconX, IconPlus, IconCheck } from '../../components/icons/index.js'

interface Props {
  programId: string
  weekId: string
  dayId: string
  accessories: StructuredExercise[]
  onSave: (exercises: StructuredExercise[]) => void
  onClose: () => void
}

export function AccessoryEditSheet({ accessories, onSave, onClose }: Props) {
  const [list, setList] = useState<StructuredExercise[]>(accessories)
  const [showPicker, setShowPicker] = useState(false)
  const [pickingSets, setPickingSets] = useState('3')
  const [pickingReps, setPickingReps] = useState('10')
  const [pickedId, setPickedId] = useState('')
  const [search, setSearch] = useState('')

  const remove = (idx: number) => setList(l => l.filter((_, i) => i !== idx))

  const addExercise = () => {
    if (!pickedId) return
    const ex = allExercises().find(e => e.id === pickedId)
    if (!ex) return
    const newEx: StructuredExercise = {
      id: `ax${Date.now()}`,
      exerciseId: ex.id,
      name: ex.name,
      type: 'accessory',
      sets: Number(pickingSets) || 3,
      reps: Number(pickingReps) || 10,
    }
    setList(l => [...l, newEx])
    setShowPicker(false)
    setPickedId('')
    setSearch('')
  }

  const CAP = 80
  const matches = allExercises().filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.group.toLowerCase().includes(search.toLowerCase())
  )
  const filtered = matches.slice(0, CAP)

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div className="sheet-handle" />

        {!showPicker ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <h3 className="t-display" style={{ margin: 0, fontSize: 20 }}>Accessories</h3>
              <button className="btn-icon" onClick={onClose}><IconX size={18} /></button>
            </div>
            <p style={{ margin: '0 0 16px', color: 'var(--text-2)', fontSize: 12 }}>
              เพิ่ม/ลบท่า accessory สำหรับวันนี้
            </p>

            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
              {list.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '20px 0' }}>
                  ยังไม่มีท่า accessory
                </div>
              )}
              {list.map((ex, i) => (
                <div key={ex.id ?? i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>{ex.name}</div>
                    <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                      {ex.sets}×{ex.reps}
                    </div>
                  </div>
                  <button
                    onClick={() => remove(i)}
                    style={{
                      background: 'transparent', border: '1px solid var(--border)',
                      borderRadius: 8, width: 32, height: 32, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--danger)',
                    }}
                  >
                    <IconX size={14} />
                  </button>
                </div>
              ))}
            </div>

            <button
              className="btn btn-secondary"
              style={{ width: '100%', marginBottom: 10 }}
              onClick={() => setShowPicker(true)}
            >
              <IconPlus size={16} /> Add Exercise
            </button>
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={() => { onSave(list); onClose() }}
            >
              <IconCheck size={16} stroke={3} /> Save
            </button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <button className="btn-icon" onClick={() => setShowPicker(false)}><IconX size={18} /></button>
              <h3 className="t-display" style={{ margin: 0, fontSize: 20 }}>Add Exercise</h3>
            </div>

            <input
              type="text"
              placeholder="Search exercises..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', height: 44, background: 'var(--surface-2)',
                border: '1px solid var(--border)', borderRadius: 10,
                color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 13,
                padding: '0 14px', outline: 'none', boxSizing: 'border-box', marginBottom: 12,
              }}
            />

            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12 }}>
              {filtered.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => setPickedId(ex.id)}
                  style={{
                    all: 'unset', display: 'flex', alignItems: 'center', gap: 12,
                    width: '100%', padding: '10px 4px', cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                    background: pickedId === ex.id ? 'rgba(212,255,58,0.08)' : 'transparent',
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14 }}>{ex.name}</div>
                    <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>{ex.group} · {ex.equipment}</div>
                  </div>
                  {pickedId === ex.id && <IconCheck size={16} style={{ color: 'var(--accent)' }} />}
                </button>
              ))}
              {matches.length > CAP && (
                <div style={{ textAlign: 'center', padding: '12px 4px', color: 'var(--muted)', fontSize: 11 }}>
                  +{matches.length - CAP} more — refine your search
                </div>
              )}
            </div>

            {pickedId && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>SETS</div>
                  <input
                    type="number" inputMode="numeric"
                    value={pickingSets} onChange={e => setPickingSets(e.target.value)}
                    onFocus={e => e.target.select()}
                    style={{
                      width: '100%', height: 44, background: 'var(--surface-2)',
                      border: '1px solid var(--accent)', borderRadius: 10,
                      color: 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 700,
                      fontSize: 18, textAlign: 'center', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>REPS</div>
                  <input
                    type="number" inputMode="numeric"
                    value={pickingReps} onChange={e => setPickingReps(e.target.value)}
                    onFocus={e => e.target.select()}
                    style={{
                      width: '100%', height: 44, background: 'var(--surface-2)',
                      border: '1px solid var(--accent)', borderRadius: 10,
                      color: 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 700,
                      fontSize: 18, textAlign: 'center', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            )}

            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={addExercise}
              disabled={!pickedId}
            >
              <IconPlus size={16} /> Add to Day
            </button>
          </>
        )}
      </div>
    </div>
  )
}
