import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { StructuredExercise, StructuredProgram, StructuredDay } from '@atlaslog/shared'
import { useProgramStore } from '../../store/useProgramStore.js'
import { allExercises } from '../../lib/data.js'
import { IconChevronLeft, IconPlus, IconX, IconCheck, IconSearch } from '../../components/icons/index.js'

type DayDraft = { dayOfWeek: StructuredDay['dayOfWeek']; focus: string; exercises: StructuredExercise[] }

const WEEKDAYS: StructuredDay['dayOfWeek'][] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function CreateProgramPage() {
  const navigate = useNavigate()
  const { addCustomProgram } = useProgramStore()

  const [name, setName] = useState('')
  const [focus, setFocus] = useState('')
  const [weeks, setWeeks] = useState('4')
  const [days, setDays] = useState<DayDraft[]>([])

  // exercise picker target: index of day we're adding to (null = closed)
  const [pickerDay, setPickerDay] = useState<number | null>(null)

  const addDay = () => {
    const used = new Set(days.map(d => d.dayOfWeek))
    const next = WEEKDAYS.find(d => !used.has(d)) ?? 'Mon'
    setDays(d => [...d, { dayOfWeek: next, focus: '', exercises: [] }])
  }
  const removeDay = (i: number) => setDays(d => d.filter((_, idx) => idx !== i))
  const setDayField = (i: number, patch: Partial<DayDraft>) =>
    setDays(d => d.map((day, idx) => idx === i ? { ...day, ...patch } : day))
  const removeExercise = (di: number, ei: number) =>
    setDayField(di, { exercises: days[di].exercises.filter((_, idx) => idx !== ei) })

  const addExerciseToDay = (di: number, ex: StructuredExercise) =>
    setDays(d => d.map((day, idx) => idx === di ? { ...day, exercises: [...day.exercises, ex] } : day))

  const weeksNum = Math.max(1, Math.min(52, Number(weeks) || 1))
  const canCreate = name.trim().length > 0 && days.length > 0

  const handleCreate = () => {
    if (!canCreate) return
    const program: StructuredProgram = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      description: '',
      totalWeeks: weeksNum,
      daysPerWeek: days.length,
      focus: focus.trim() || 'Custom',
      isCustom: true,
      source: 'manual',
      weeks: Array.from({ length: weeksNum }, (_, wi) => ({
        id: `week-${wi + 1}`,
        weekNumber: wi + 1,
        phase: 'Accumulation' as const,
        days: days.map((d, di) => ({
          id: `day-${di + 1}`,
          dayOfWeek: d.dayOfWeek,
          focus: d.focus.trim() || `${d.dayOfWeek} Training`,
          exercises: d.exercises,
        })),
      })),
    }
    addCustomProgram(program)
    navigate(`/programs/${program.id}`)
  }

  return (
    <div className="atlas-screen screen-enter">
      <div className="scr-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn-icon" onClick={() => navigate('/programs')} aria-label="Back">
          <IconChevronLeft size={20} />
        </button>
        <div>
          <div className="sub">NEW</div>
          <h1>Create Program</h1>
        </div>
      </div>

      {/* Program meta */}
      <div style={{ padding: '0 20px 20px' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>PROGRAM NAME</div>
            <input className="input-num" type="text" value={name} placeholder="e.g. My Push/Pull/Legs"
              onChange={e => setName(e.target.value)}
              style={{ width: '100%', textAlign: 'left', fontFamily: 'var(--font-display)', textTransform: 'none', fontSize: 15 }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>FOCUS</div>
              <input className="input-num" type="text" value={focus} placeholder="Squat · Bench · DL"
                onChange={e => setFocus(e.target.value)}
                style={{ width: '100%', textAlign: 'left', fontFamily: 'var(--font-mono)', textTransform: 'none', fontSize: 13 }} />
            </div>
            <div style={{ width: 96 }}>
              <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>WEEKS</div>
              <input className="input-num tnum" type="number" inputMode="numeric" value={weeks}
                onChange={e => setWeeks(e.target.value)} onFocus={e => e.target.select()}
                style={{ width: '100%', textAlign: 'center' }} />
            </div>
          </div>
          <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
            1 สัปดาห์ที่สร้างจะถูกทำซ้ำ {weeksNum} สัปดาห์
          </div>
        </div>
      </div>

      {/* Week template — days */}
      <div style={{ padding: '0 20px 20px' }}>
        <div className="t-eyebrow" style={{ marginBottom: 10 }}>WEEK TEMPLATE · {days.length} DAYS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {days.map((day, di) => (
            <div key={di} className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <select
                  value={day.dayOfWeek}
                  onChange={e => setDayField(di, { dayOfWeek: e.target.value as StructuredDay['dayOfWeek'] })}
                  style={{
                    background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8,
                    color: 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12,
                    padding: '8px 10px', flexShrink: 0,
                  }}>
                  {WEEKDAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <input className="input-num" type="text" value={day.focus} placeholder="Focus (e.g. Squat Focus)"
                  onChange={e => setDayField(di, { focus: e.target.value })}
                  style={{ flex: 1, minWidth: 0, height: 36, textAlign: 'left', fontFamily: 'var(--font-mono)', textTransform: 'none', fontSize: 12 }} />
                <button className="btn-icon" style={{ width: 36, height: 36, flexShrink: 0, color: 'var(--danger)' }}
                  onClick={() => removeDay(di)} aria-label="Remove day">
                  <IconX size={16} />
                </button>
              </div>

              {day.exercises.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                  {day.exercises.map((ex, ei) => (
                    <div key={ei} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="pill" style={{ fontSize: 8, flexShrink: 0 }}>{ex.type === 'main' ? 'MAIN' : 'ACC'}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</span>
                      <span className="t-mono" style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>
                        {ex.sets}×{ex.reps}{ex.rpe !== undefined ? ` @${ex.rpe}` : ''}
                      </span>
                      <button onClick={() => removeExercise(di, ei)} aria-label="Remove exercise"
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2, flexShrink: 0 }}>
                        <IconX size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button className="btn btn-secondary" style={{ width: '100%', height: 38, fontSize: 12 }}
                onClick={() => setPickerDay(di)}>
                <IconPlus size={14} /> Add Exercise
              </button>
            </div>
          ))}
        </div>

        <button className="btn btn-secondary" style={{ width: '100%', marginTop: 10 }} onClick={addDay}>
          <IconPlus size={16} /> Add Day
        </button>
      </div>

      <div style={{ padding: '0 20px 32px' }}>
        <button className="btn btn-primary" style={{ width: '100%', opacity: canCreate ? 1 : 0.4 }}
          disabled={!canCreate} onClick={handleCreate}>
          <IconCheck size={18} stroke={3} /> Create Program
        </button>
        {!canCreate && (
          <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8, textAlign: 'center' }}>
            ต้องมีชื่อโปรแกรม + อย่างน้อย 1 วัน
          </div>
        )}
      </div>

      {pickerDay !== null && (
        <ExercisePicker
          onPick={ex => { addExerciseToDay(pickerDay, ex); setPickerDay(null) }}
          onClose={() => setPickerDay(null)}
        />
      )}
    </div>
  )
}

function ExercisePicker({ onPick, onClose }: { onPick: (ex: StructuredExercise) => void; onClose: () => void }) {
  const [search, setSearch] = useState('')
  const [pickedId, setPickedId] = useState('')
  const [type, setType] = useState<'main' | 'accessory'>('accessory')
  const [sets, setSets] = useState('3')
  const [reps, setReps] = useState('10')
  const [rpe, setRpe] = useState('')

  const filtered = allExercises().filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) || e.group.toLowerCase().includes(search.toLowerCase()))

  const confirm = () => {
    const ex = allExercises().find(e => e.id === pickedId)
    if (!ex) return
    onPick({
      exerciseId: ex.id,
      name: ex.name,
      type,
      sets: Number(sets) || 3,
      reps: Number(reps) || 10,
      ...(rpe ? { rpe: Number(rpe) } : {}),
    })
  }

  return (
    <div className="sheet-backdrop" onClick={onClose} style={{ zIndex: 100 }}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div className="sheet-handle" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 className="t-display" style={{ margin: 0, fontSize: 20 }}>Add Exercise</h3>
          <button className="btn-icon" onClick={onClose}><IconX size={18} /></button>
        </div>

        <div className="search-bar" style={{ marginBottom: 12 }}>
          <IconSearch size={18} style={{ color: 'var(--muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search exercises…" />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12, minHeight: 80 }}>
          {filtered.map(ex => (
            <button key={ex.id} onClick={() => setPickedId(ex.id)}
              style={{
                all: 'unset', display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 4px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                background: pickedId === ex.id ? 'rgba(212,255,58,0.08)' : 'transparent', boxSizing: 'border-box',
              }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14 }}>{ex.name}</div>
                <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>{ex.group} · {ex.equipment}</div>
              </div>
              {pickedId === ex.id && <IconCheck size={16} style={{ color: 'var(--accent)' }} />}
            </button>
          ))}
        </div>

        {pickedId && (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {(['main', 'accessory'] as const).map(t => (
                <button key={t} onClick={() => setType(t)}
                  style={{
                    flex: 1, height: 36, borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${type === t ? 'var(--accent)' : 'var(--border)'}`,
                    background: type === t ? 'rgba(212,255,58,0.12)' : 'var(--surface-2)',
                    color: type === t ? 'var(--accent)' : 'var(--text-2)',
                    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                  }}>
                  {t}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[
                { label: 'SETS', val: sets, set: setSets, ph: '3' },
                { label: 'REPS', val: reps, set: setReps, ph: '10' },
                { label: 'RPE (opt)', val: rpe, set: setRpe, ph: '—' },
              ].map(({ label, val, set, ph }) => (
                <div key={label} style={{ flex: 1 }}>
                  <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>{label}</div>
                  <input className="input-num tnum" type="number" inputMode="numeric" value={val} placeholder={ph}
                    onChange={e => set(e.target.value)} onFocus={e => e.target.select()}
                    style={{ width: '100%', textAlign: 'center' }} />
                </div>
              ))}
            </div>
          </>
        )}

        <button className="btn btn-primary" style={{ width: '100%', opacity: pickedId ? 1 : 0.4 }}
          disabled={!pickedId} onClick={confirm}>
          <IconPlus size={16} /> Add to Day
        </button>
      </div>
    </div>
  )
}
