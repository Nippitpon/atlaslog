import { Fragment, useState } from 'react'
import { useNavigate, Navigate, useParams } from 'react-router-dom'
import type { StructuredExercise, StructuredProgram, StructuredDay } from '@atlaslog/shared'
import { useProgramStore } from '../../store/useProgramStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { createShare } from '../../lib/shareApi.js'
import { allExercises } from '../../lib/data.js'
import { getExercise, muscleColor, runTarget } from '../../lib/utils.js'
import { IconChevronLeft, IconPlus, IconX, IconCheck, IconSearch, IconCopy, IconRun } from '../../components/icons/index.js'

type Visibility = 'private' | 'code' | 'public'

// Authoring-only: a powerlifting main lift carries a per-week Set/Rep/% scheme
// (index 0 = week 1). Expanded into each week's StructuredExercise on save.
type WeekCell = { sets?: number; reps?: number; pct?: number }
type ExerciseDraft = StructuredExercise & { weekly?: WeekCell[] }
type DayDraft = { id?: string; dayOfWeek: StructuredDay['dayOfWeek']; focus: string; exercises: ExerciseDraft[] }

const WEEKDAYS: StructuredDay['dayOfWeek'][] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// "70→95%" range label for a draft main lift with a per-week scheme (null if no % set).
function pctRangeLabel(ex: ExerciseDraft): string | null {
  const vals = (ex.weekly ?? []).map(c => c.pct).filter((v): v is number => v !== undefined)
  if (!vals.length) return null
  const lo = Math.round(Math.min(...vals) * 100)
  const hi = Math.round(Math.max(...vals) * 100)
  return lo === hi ? `${lo}%` : `${lo}→${hi}%`
}

export function CreateProgramPage() {
  const navigate = useNavigate()
  const { programId } = useParams<{ programId: string }>()
  const { addCustomProgram, updateCustomProgram, customPrograms } = useProgramStore()
  const { isCoach, isAdmin, roleLoaded } = useAuthStore()
  const canCreate = isCoach || isAdmin

  // Edit mode: opened via /programs/:programId/edit for an own custom program.
  const editing = programId ? customPrograms.find(p => p.id === programId) : undefined
  const isEditable = !!editing && editing.source !== 'coach'

  const [name, setName] = useState(() => editing?.name ?? '')
  const [focus, setFocus] = useState(() => editing?.focus === 'Custom' ? '' : (editing?.focus ?? ''))
  const [weeks, setWeeks] = useState(() => editing ? (editing.weekly ? '' : String(editing.totalWeeks)) : '')
  const [days, setDays] = useState<DayDraft[]>(() =>
    (editing?.weeks[0]?.days ?? []).map((d, di) => ({
      id: d.id,
      dayOfWeek: d.dayOfWeek,
      focus: d.focus,
      // Reconstruct per-week Set/Rep/% for main lifts so editing doesn't flatten it.
      exercises: d.exercises.map((ex, ei) =>
        editing && editing.programType === 'powerlifting' && editing.weeks.length > 1 && ex.type === 'main'
          ? {
              ...ex,
              weekly: editing.weeks.map(w => {
                const x = w.days[di]?.exercises[ei]
                return { sets: x?.sets, reps: typeof x?.reps === 'number' ? x.reps : undefined, pct: x?.pct }
              }),
            }
          : ex
      ),
    }))
  )
  const [programType, setProgramType] = useState<'general' | 'powerlifting'>(() => editing?.programType ?? 'general')
  const [visibility, setVisibility] = useState<Visibility>('private')
  const [busy, setBusy] = useState(false)
  const [publishedCode, setPublishedCode] = useState<string | null>(null)

  // exercise picker target: index of day we're adding to (null = closed)
  const [pickerDay, setPickerDay] = useState<number | null>(null)
  // running picker target: index of day we're adding a run to (null = closed)
  const [runDay, setRunDay] = useState<number | null>(null)

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

  const addExerciseToDay = (di: number, ex: ExerciseDraft) =>
    setDays(d => d.map((day, idx) => idx === di ? { ...day, exercises: [...day.exercises, ex] } : day))

  // Weekly routine = General program with no week count → no periodization,
  // no start/end date setup. Powerlifting always requires a week count + setup.
  const isWeekly = programType === 'general' && weeks.trim() === ''
  const weeksNum = isWeekly ? 1 : Math.max(1, Math.min(52, Number(weeks) || 1))
  const weeksValid = isWeekly || Number(weeks) >= 1
  const canSave = name.trim().length > 0 && days.length > 0 && weeksValid

  const handleCreate = async () => {
    if (!canSave || busy) return
    // Assign stable day ids ONCE: keep existing (preserves progress), new days get
    // a fresh non-positional id so nothing collides / drifts on later edits.
    const stamp = Date.now()
    const dayIds = days.map((d, di) => d.id ?? `day-${stamp}-${di}`)
    const program: StructuredProgram = {
      id: editing ? editing.id : `custom-${stamp}`,
      name: name.trim(),
      description: editing?.description ?? '',
      totalWeeks: weeksNum,
      daysPerWeek: days.length,
      focus: focus.trim() || 'Custom',
      isCustom: true,
      // Preserve source (manual/excel) when editing; new programs are manual.
      source: editing?.source === 'excel' ? 'excel' : 'manual',
      weekly: isWeekly || undefined,
      programType,
      weeks: Array.from({ length: weeksNum }, (_, wi) => ({
        id: `week-${wi + 1}`,
        weekNumber: wi + 1,
        phase: 'Accumulation' as const,
        days: days.map((d, di) => ({
          id: dayIds[di],
          dayOfWeek: d.dayOfWeek,
          focus: d.focus.trim() || `${d.dayOfWeek} Training`,
          // Expand per-week Set/Rep/% into each week + assign a per-row id (so two
          // same-exerciseId main rows never collide in the logger's weight map).
          exercises: d.exercises.map((ex, ei) => {
            const { weekly, ...base } = ex
            const id = `${dayIds[di]}-e${ei}`
            if (!weekly) return { ...base, id } as StructuredExercise
            // In-range blank cells fall back to the base value; weeks past the array clamp to last.
            const c = wi < weekly.length ? weekly[wi] : weekly[weekly.length - 1]
            const row = { ...base, id } as StructuredExercise
            if (c.sets !== undefined) row.sets = c.sets
            if (c.reps !== undefined) row.reps = c.reps
            if (c.pct !== undefined) row.pct = c.pct
            else delete row.pct
            return row
          }),
        })),
      })),
    }

    if (editing) {
      updateCustomProgram(program)
      navigate(`/programs/${program.id}`)
      return
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
  // Edit route for a program that isn't yours/editable → bounce.
  if (programId && !isEditable) return <Navigate to="/programs" replace />

  return (
    <div className="atlas-screen screen-enter">
      <div className="scr-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn-icon" onClick={() => navigate('/programs')} aria-label="Back">
          <IconChevronLeft size={20} />
        </button>
        <div>
          <div className="sub">{editing ? 'EDIT' : 'NEW'}</div>
          <h1>{editing ? 'Edit Program' : 'Create Program'}</h1>
        </div>
      </div>

      {editing && (
        <div style={{ padding: '0 20px 16px' }}>
          <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.6 }}>
            การแก้ไม่กระทบสำเนาที่แชร์/มอบหมายไปแล้ว (ต้อง share/assign ใหม่) · วันที่ลบจะล้าง progress ของวันนั้น
          </div>
        </div>
      )}

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
                      <span className="pill" style={{ fontSize: 8, flexShrink: 0 }}>
                        {ex.type === 'main' ? 'MAIN' : ex.type === 'running' ? 'RUN' : 'ACC'}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</div>
                        {ex.type !== 'running' && getExercise(ex.exerciseId)?.group && (
                          <div className="t-mono" style={{ fontSize: 9, color: 'var(--muted)' }}>{getExercise(ex.exerciseId).group}</div>
                        )}
                      </div>
                      <span className="t-mono" style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>
                        {ex.type === 'running'
                          ? (runTarget(ex) || 'Run')
                          : `${ex.sets}×${ex.reps}${ex.rpe !== undefined ? ` @${ex.rpe}` : ''}${pctRangeLabel(ex) ? ` · ${pctRangeLabel(ex)}` : ''}`}
                      </span>
                      <button onClick={() => removeExercise(di, ei)} aria-label="Remove exercise"
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2, flexShrink: 0 }}>
                        <IconX size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" style={{ flex: 1, height: 38, fontSize: 12 }}
                  onClick={() => setPickerDay(di)}>
                  <IconPlus size={14} /> Add Exercise
                </button>
                <button className="btn btn-secondary" style={{ height: 38, fontSize: 12, padding: '0 12px', flexShrink: 0 }}
                  onClick={() => setRunDay(di)}>
                  <IconRun size={14} /> Running
                </button>
              </div>
            </div>
          ))}
        </div>

        <button className="btn btn-secondary" style={{ width: '100%', marginTop: 10 }} onClick={addDay}>
          <IconPlus size={16} /> Add Day
        </button>
      </div>

      {/* Visibility (create only — editing keeps existing shares untouched) */}
      {!editing && (
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
      )}

      <div style={{ padding: '0 20px 32px' }}>
        <button className="btn btn-primary" style={{ width: '100%', opacity: canSave && !busy ? 1 : 0.4 }}
          disabled={!canSave || busy} onClick={() => void handleCreate()}>
          <IconCheck size={18} stroke={3} /> {editing ? 'Save changes' : busy ? 'Publishing…' : 'Create Program'}
        </button>
        {!canSave && (
          <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8, textAlign: 'center' }}>
            ต้องมีชื่อโปรแกรม + อย่างน้อย 1 วัน
          </div>
        )}
      </div>

      {pickerDay !== null && (
        <ExercisePicker
          weeks={weeksNum}
          programType={programType}
          onPick={ex => { addExerciseToDay(pickerDay, ex); setPickerDay(null) }}
          onClose={() => setPickerDay(null)}
        />
      )}

      {runDay !== null && (
        <RunPicker
          onPick={ex => { addExerciseToDay(runDay, ex); setRunDay(null) }}
          onClose={() => setRunDay(null)}
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

function RunPicker({ onPick, onClose }: { onPick: (ex: StructuredExercise) => void; onClose: () => void }) {
  const [label, setLabel] = useState('')
  const [dist, setDist] = useState('')
  const [dur, setDur] = useState('')

  const confirm = () => {
    onPick({
      exerciseId: 'running',
      name: label.trim() || 'Running',
      type: 'running',
      ...(Number(dist) > 0 ? { distanceKm: Number(dist) } : {}),
      ...(Number(dur) > 0 ? { durationMin: Number(dur) } : {}),
    })
  }

  return (
    <div className="sheet-backdrop" onClick={onClose} style={{ zIndex: 100 }}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h3 className="t-display" style={{ margin: 0, fontSize: 20 }}>Add Running</h3>
          <button className="btn-icon" onClick={onClose}><IconX size={18} /></button>
        </div>
        <p className="t-mono" style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16 }}>
          ตั้งเป้าหมายระยะ/เวลา (ไม่บังคับ) · วันนี้จะแสดงเป็น Running แล้วกดไปหน้า Running
        </p>

        <div style={{ marginBottom: 12 }}>
          <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>LABEL (OPT)</div>
          <input className="input-num" type="text" value={label} placeholder="e.g. Easy Zone 2"
            onChange={e => setLabel(e.target.value)}
            style={{ width: '100%', textAlign: 'left', fontFamily: 'var(--font-mono)', textTransform: 'none', fontSize: 13 }} />
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'DISTANCE (KM)', val: dist, set: setDist, ph: '5' },
            { label: 'TIME (MIN)', val: dur, set: setDur, ph: '30' },
          ].map(({ label, val, set, ph }) => (
            <div key={label} style={{ flex: 1 }}>
              <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>{label}</div>
              <input className="input-num tnum" type="number" inputMode="decimal" value={val} placeholder={ph}
                onChange={e => set(e.target.value)} onFocus={e => e.target.select()}
                style={{ width: '100%', textAlign: 'center' }} />
            </div>
          ))}
        </div>

        <button className="btn btn-primary" style={{ width: '100%' }} onClick={confirm}>
          <IconPlus size={16} /> Add to Day
        </button>
      </div>
    </div>
  )
}

function ExercisePicker({ weeks, programType, onPick, onClose }: {
  weeks: number
  programType: 'general' | 'powerlifting'
  onPick: (ex: ExerciseDraft) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('All')
  const [pickedId, setPickedId] = useState('')
  const [type, setType] = useState<'main' | 'accessory'>('accessory')
  const [sets, setSets] = useState('3')
  const [reps, setReps] = useState('10')
  const [rpe, setRpe] = useState('')
  const [basePct, setBasePct] = useState('')
  const [stepPct, setStepPct] = useState('')
  const [role, setRole] = useState<'top' | 'backoff' | 'working'>('working')
  const [wSets, setWSets] = useState<string[]>([])
  const [wReps, setWReps] = useState<string[]>([])
  const [wPct, setWPct] = useState<string[]>([])

  // Per-week Set/Rep/% table only makes sense for a powerlifting main lift.
  const showWeekly = programType === 'powerlifting' && type === 'main'

  const fillPct = () => {
    const b = Number(basePct)
    if (!b) return
    const s = Number(stepPct) || 0
    setWPct(Array.from({ length: weeks }, (_, i) =>
      String(Math.max(0, Math.min(100, Math.round((b + s * i) * 10) / 10)))
    ))
  }
  const editCell = (arr: string[], setArr: (v: string[]) => void, i: number, v: string) => {
    const next = arr.length ? [...arr] : Array.from({ length: weeks }, () => '')
    next[i] = v
    setArr(next)
  }

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
    const suffix = role === 'top' ? ' — Top set' : role === 'backoff' ? ' — Back-off' : ''
    const draft: ExerciseDraft = {
      exerciseId: ex.id,
      name: ex.name + (showWeekly ? suffix : ''),
      type,
      sets: Number(sets) || 3,
      reps: Number(reps) || 10,
      ...(rpe ? { rpe: Number(rpe) } : {}),
    }
    if (showWeekly) {
      const weekly = Array.from({ length: weeks }, (_, i) => {
        const p = wPct[i]?.trim()
        return {
          sets: Number(wSets[i] || sets) || undefined,
          reps: Number(wReps[i] || reps) || undefined,
          pct: p ? Math.max(0, Math.min(1, Number(p) / 100)) : undefined,
        }
      })
      draft.weekly = weekly
      // Representative week-1 values for the day-list summary / week-1 consumers.
      if (weekly[0]?.sets !== undefined) draft.sets = weekly[0].sets
      if (weekly[0]?.reps !== undefined) draft.reps = weekly[0].reps
      draft.pct = weekly.find(c => c.pct !== undefined)?.pct
    }
    onPick(draft)
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

            {showWeekly && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {([['top', 'Top set'], ['backoff', 'Back-off'], ['working', 'Working']] as const).map(([r, lbl]) => (
                  <button key={r} onClick={() => setRole(r)}
                    style={{
                      flex: 1, height: 32, borderRadius: 8, cursor: 'pointer',
                      border: `1px solid ${role === r ? 'var(--accent)' : 'var(--border)'}`,
                      background: role === r ? 'rgba(212,255,58,0.12)' : 'var(--surface-2)',
                      color: role === r ? 'var(--accent)' : 'var(--text-2)',
                      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                    }}>
                    {lbl}
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[
                { label: showWeekly ? 'SETS (BASE)' : 'SETS', val: sets, set: setSets, ph: '3' },
                { label: showWeekly ? 'REPS (BASE)' : 'REPS', val: reps, set: setReps, ph: '10' },
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

            {showWeekly && (
              <div style={{ marginBottom: 12 }}>
                <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>Set / Rep / %1RM ต่อสัปดาห์</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>BASE %</div>
                    <input className="input-num tnum" type="number" inputMode="numeric" value={basePct} placeholder="70"
                      onChange={e => setBasePct(e.target.value)} onFocus={e => e.target.select()}
                      style={{ width: '100%', textAlign: 'center' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>STEP %/WK</div>
                    <input className="input-num tnum" type="number" inputMode="numeric" value={stepPct} placeholder="5"
                      onChange={e => setStepPct(e.target.value)} onFocus={e => e.target.select()}
                      style={{ width: '100%', textAlign: 'center' }} />
                  </div>
                  <button className="btn btn-secondary" style={{ height: 36, padding: '0 14px', flexShrink: 0, opacity: basePct ? 1 : 0.4 }}
                    disabled={!basePct} onClick={fillPct}>Fill %</button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '26px 1fr 1fr 1fr', gap: 4, alignItems: 'center', minWidth: 210 }}>
                    <div />
                    <div className="t-eyebrow" style={{ fontSize: 8, textAlign: 'center' }}>SET</div>
                    <div className="t-eyebrow" style={{ fontSize: 8, textAlign: 'center' }}>REP</div>
                    <div className="t-eyebrow" style={{ fontSize: 8, textAlign: 'center' }}>%</div>
                    {Array.from({ length: weeks }, (_, i) => (
                      <Fragment key={i}>
                        <div className="t-mono" style={{ fontSize: 9, color: 'var(--muted)', textAlign: 'center' }}>{i + 1}</div>
                        <input className="input-num tnum" type="number" inputMode="numeric" value={wSets[i] ?? ''} placeholder={sets || '—'}
                          onChange={e => editCell(wSets, setWSets, i, e.target.value)} onFocus={e => e.target.select()}
                          style={{ width: '100%', textAlign: 'center' }} />
                        <input className="input-num tnum" type="number" inputMode="numeric" value={wReps[i] ?? ''} placeholder={reps || '—'}
                          onChange={e => editCell(wReps, setWReps, i, e.target.value)} onFocus={e => e.target.select()}
                          style={{ width: '100%', textAlign: 'center' }} />
                        <input className="input-num tnum" type="number" inputMode="numeric" value={wPct[i] ?? ''} placeholder="—"
                          onChange={e => editCell(wPct, setWPct, i, e.target.value)} onFocus={e => e.target.select()}
                          style={{ width: '100%', textAlign: 'center' }} />
                      </Fragment>
                    ))}
                  </div>
                </div>
                <div className="t-mono" style={{ fontSize: 9, color: 'var(--muted)', marginTop: 6 }}>
                  คำนวณน้ำหนักเฉพาะ squat / bench / deadlift · เว้นว่าง Set/Rep = ใช้ค่า BASE · เว้น % = ใช้ RPE
                </div>
              </div>
            )}
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
