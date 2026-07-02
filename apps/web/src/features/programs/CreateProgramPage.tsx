import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import type { StructuredExercise, StructuredProgram, StructuredDay } from '@atlaslog/shared'
import { useProgramStore } from '../../store/useProgramStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { createShare } from '../../lib/shareApi.js'
import { allExercises } from '../../lib/data.js'
import { getExercise, muscleColor } from '../../lib/utils.js'
import { IconChevronLeft, IconPlus, IconX, IconCheck, IconSearch, IconCopy } from '../../components/icons/index.js'

type Visibility = 'private' | 'code' | 'public'

type DayDraft = { dayOfWeek: StructuredDay['dayOfWeek']; focus: string; exercises: StructuredExercise[] }

const WEEKDAYS: StructuredDay['dayOfWeek'][] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function CreateProgramPage() {
  const navigate = useNavigate()
  const { addCustomProgram } = useProgramStore()
  const { isCoach, isAdmin, roleLoaded } = useAuthStore()
  const canCreate = isCoach || isAdmin

  const [name, setName] = useState('')
  const [focus, setFocus] = useState('')
  const [weeks, setWeeks] = useState('')
  const [days, setDays] = useState<DayDraft[]>([])
  const [programType, setProgramType] = useState<'general' | 'powerlifting'>('general')
  const [visibility, setVisibility] = useState<Visibility>('private')
  const [busy, setBusy] = useState(false)
  const [publishedCode, setPublishedCode] = useState<string | null>(null)

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

  // Weekly routine = General program with no week count → no periodization,
  // no start/end date setup. Powerlifting always requires a week count + setup.
  const isWeekly = programType === 'general' && weeks.trim() === ''
  const weeksNum = isWeekly ? 1 : Math.max(1, Math.min(52, Number(weeks) || 1))
  const weeksValid = isWeekly || Number(weeks) >= 1
  const canSave = name.trim().length > 0 && days.length > 0 && weeksValid

  const handleCreate = async () => {
    if (!canSave || busy) return
    const program: StructuredProgram = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      description: '',
      totalWeeks: weeksNum,
      daysPerWeek: days.length,
      focus: focus.trim() || 'Custom',
      isCustom: true,
      source: 'manual',
      weekly: isWeekly || undefined,
      programType,
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

    if (visibility === 'private') {
      navigate(`/programs/${program.id}`)
      return
    }
    // code / public → publish to shared_programs
    setBusy(true)
    try {
      const code = await createShare(program, visibility === 'public')
      if (visibility === 'code') {
        setPublishedCode(code) // show the code sheet (then user proceeds)
      } else {
        navigate(`/programs/${program.id}`) // public: just go to overview
      }
    } catch {
      navigate(`/programs/${program.id}`) // saved locally regardless; publish can retry later
    } finally {
      setBusy(false)
    }
  }

  if (!roleLoaded) return null
  if (!canCreate) return <Navigate to="/programs" replace />

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
                placeholder={programType === 'general' ? '—' : '4'}
                onChange={e => setWeeks(e.target.value)} onFocus={e => e.target.select()}
                style={{ width: '100%', textAlign: 'center' }} />
            </div>
          </div>
          <div className="t-mono" style={{ fontSize: 10, color: isWeekly ? 'var(--accent)' : 'var(--muted)' }}>
            {isWeekly
              ? 'โปรแกรมประจำสัปดาห์ · ไม่ต้องตั้งวันเริ่ม/จบ'
              : programType === 'general'
                ? `เว้นว่าง = ประจำสัปดาห์ · ใส่เลข = ทำซ้ำ ${weeksNum} สัปดาห์`
                : `1 สัปดาห์ที่สร้างจะถูกทำซ้ำ ${weeks.trim() === '' ? 'N' : weeksNum} สัปดาห์ (Powerlifting ต้องกำหนด)`}
          </div>
        </div>
      </div>

      {/* Program type */}
      <div style={{ padding: '0 20px 20px' }}>
        <div className="t-eyebrow" style={{ marginBottom: 10 }}>PROGRAM TYPE</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {([
            { v: 'general', label: 'General', desc: 'บันทึกน้ำหนักเอง' },
            { v: 'powerlifting', label: 'Powerlifting', desc: 'คำนวณจาก 1RM โปรไฟล์' },
          ] as const).map(({ v, label, desc }) => (
            <button key={v} onClick={() => setProgramType(v)}
              style={{
                all: 'unset', cursor: 'pointer', flex: 1, boxSizing: 'border-box',
                padding: '12px', borderRadius: 12, textAlign: 'center',
                border: `1px solid ${programType === v ? 'var(--accent)' : 'var(--border)'}`,
                background: programType === v ? 'rgba(212,255,58,0.10)' : 'var(--surface-2)',
              }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: programType === v ? 'var(--accent)' : 'var(--text)' }}>{label}</div>
              <div className="t-mono" style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>{desc}</div>
            </button>
          ))}
        </div>
        {programType === 'powerlifting' && (
          <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8 }}>
            ท่า squat/bench/deadlift จะคำนวณน้ำหนักจาก Personal 1RM ในโปรไฟล์ (ใส่ % หรือ RPE ในแต่ละท่า)
          </div>
        )}
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
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</div>
                        {getExercise(ex.exerciseId)?.group && (
                          <div className="t-mono" style={{ fontSize: 9, color: 'var(--muted)' }}>{getExercise(ex.exerciseId).group}</div>
                        )}
                      </div>
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

      {/* Visibility */}
      <div style={{ padding: '0 20px 20px' }}>
        <div className="t-eyebrow" style={{ marginBottom: 10 }}>VISIBILITY</div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {([
            { v: 'private', label: 'Private', desc: 'เฉพาะฉัน' },
            { v: 'code', label: 'Share by code', desc: 'สร้างโค้ดให้คนอื่น import' },
            { v: 'public', label: 'Public', desc: 'ทุกคนเห็นใน Discover' },
          ] as const).map(({ v, label, desc }) => (
            <button key={v} onClick={() => setVisibility(v)}
              style={{
                all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 10,
                border: `1px solid ${visibility === v ? 'var(--accent)' : 'var(--border)'}`,
                background: visibility === v ? 'rgba(212,255,58,0.10)' : 'var(--surface-2)',
              }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${visibility === v ? 'var(--accent)' : 'var(--border-strong)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {visibility === v && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14 }}>{label}</div>
                <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>{desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 20px 32px' }}>
        <button className="btn btn-primary" style={{ width: '100%', opacity: canSave && !busy ? 1 : 0.4 }}
          disabled={!canSave || busy} onClick={() => void handleCreate()}>
          <IconCheck size={18} stroke={3} /> {busy ? 'Publishing…' : 'Create Program'}
        </button>
        {!canSave && (
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

      {/* Published share code */}
      {publishedCode && (
        <div className="sheet-backdrop" onClick={() => navigate('/programs')} style={{ zIndex: 100 }}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h3 className="t-display" style={{ marginBottom: 6 }}>Program created · Share code</h3>
            <p className="t-mono" style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
              ส่งโค้ดนี้ให้คนอื่น → Programs → ไอคอนลิงก์ → Import by code
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div className="t-mono" style={{
                flex: 1, fontSize: 24, fontWeight: 700, letterSpacing: '0.16em', textAlign: 'center',
                background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, color: 'var(--accent)',
              }}>{publishedCode}</div>
              <button className="btn btn-secondary" style={{ height: 52, fontSize: 12, padding: '0 14px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => { void navigator.clipboard.writeText(publishedCode).catch(() => {}) }}>
                <IconCopy size={16} /> Copy
              </button>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', height: 44 }} onClick={() => navigate('/programs')}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ExercisePicker({ onPick, onClose }: { onPick: (ex: StructuredExercise) => void; onClose: () => void }) {
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('All')
  const [pickedId, setPickedId] = useState('')
  const [type, setType] = useState<'main' | 'accessory'>('accessory')
  const [sets, setSets] = useState('3')
  const [reps, setReps] = useState('10')
  const [rpe, setRpe] = useState('')

  const groups = ['All', ...Array.from(new Set(allExercises().map(e => e.group)))]

  const CAP = 80
  const matches = allExercises().filter(e =>
    (e.name.toLowerCase().includes(search.toLowerCase()) || e.group.toLowerCase().includes(search.toLowerCase()))
    && (groupFilter === 'All' || e.group === groupFilter))
  const filtered = matches.slice(0, CAP)

  // Group the filtered exercises by muscle group, preserving encounter order.
  const groupedList = filtered.reduce<{ group: string; items: typeof filtered }[]>((acc, ex) => {
    const bucket = acc.find(b => b.group === ex.group)
    if (bucket) bucket.items.push(ex)
    else acc.push({ group: ex.group, items: [ex] })
    return acc
  }, [])

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

        <div className="search-bar" style={{ marginBottom: 10 }}>
          <IconSearch size={18} style={{ color: 'var(--muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search exercises…" />
        </div>

        {/* Muscle group filter chips */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12, paddingBottom: 2, flexShrink: 0 }}>
          {groups.map(g => {
            const active = groupFilter === g
            const color = g === 'All' ? 'var(--accent)' : muscleColor(g)
            return (
              <button key={g} onClick={() => setGroupFilter(g)}
                style={{
                  flexShrink: 0, padding: '5px 12px', borderRadius: 999, cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
                  border: `1px solid ${active ? color : 'var(--border)'}`,
                  background: active ? color : 'var(--surface-2)',
                  color: active ? '#0a0a0a' : 'var(--text-2)',
                }}>
                {g}
              </button>
            )
          })}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12, minHeight: 80 }}>
          {groupedList.map(({ group, items }) => (
            <div key={group}>
              <div className="t-eyebrow" style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: 'var(--muted)',
                padding: '8px 4px 4px', position: 'sticky', top: 0, background: 'var(--surface-1)',
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: muscleColor(group), flexShrink: 0 }} />
                {group}
              </div>
              {items.map(ex => (
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
          ))}
          {matches.length > CAP && (
            <div style={{ textAlign: 'center', padding: '12px 4px', color: 'var(--muted)', fontSize: 11 }}>
              +{matches.length - CAP} more — refine your search
            </div>
          )}
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
