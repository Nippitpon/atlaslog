import { Fragment, useState } from 'react'
import { useNavigate, Navigate, useParams } from 'react-router-dom'
import type { StructuredExercise, StructuredProgram, StructuredDay, ProgramPhase } from '@atlaslog/shared'
import { useProgramStore } from '../../store/useProgramStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { createShare } from '../../lib/shareApi.js'
import { allExercises } from '../../lib/data.js'
import { getExercise, moveItem, muscleColor, runTarget, round2 } from '../../lib/utils.js'
import { ReorderList } from '../../components/ReorderList.js'
import {
  PHASES, addExerciseToWeeks, copyWeek, draftToWeeks, emptyWeek, findEmptyDays, maxDaysPerWeek, programToDraft,
  removeEmptyDays, resizeWeeks,
  type DayDraft, type WeekDraft,
} from '../../lib/programDraft.js'
import { IconChevronLeft, IconPlus, IconX, IconCheck, IconSearch, IconCopy, IconRun } from '../../components/icons/index.js'

type Visibility = 'private' | 'code' | 'public'

// What ExercisePicker hands back: one row for the selected week, or one row per week.
type PickResult = { scope: 'week'; row: StructuredExercise } | { scope: 'all'; rows: StructuredExercise[] }

const WEEKDAYS: StructuredDay['dayOfWeek'][] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function rowSummary(ex: StructuredExercise): string {
  if (ex.type === 'running') return runTarget(ex) || 'Run'
  const rpe = ex.rpe !== undefined ? ` @${ex.rpe}` : ''
  const pct = ex.pct !== undefined ? ` · ${Math.round(ex.pct * 1000) / 10}%` : ''
  return `${ex.sets}×${ex.reps}${rpe}${pct}`
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
  const [weeksInput, setWeeksInput] = useState(() => editing ? (editing.weekly ? '' : String(editing.weeks.length)) : '')
  // Every week owns its own days + rows; editing one week never rewrites another.
  const [drafts, setDrafts] = useState<WeekDraft[]>(() => editing ? programToDraft(editing) : [emptyWeek()])
  const [selWeek, setSelWeek] = useState(0)
  const [programType, setProgramType] = useState<'general' | 'powerlifting'>(() => editing?.programType ?? 'general')
  const [visibility, setVisibility] = useState<Visibility>('private')
  const [busy, setBusy] = useState(false)
  const [publishedCode, setPublishedCode] = useState<string | null>(null)

  // exercise picker target: index of day (in the selected week) we're adding to
  const [pickerDay, setPickerDay] = useState<number | null>(null)
  const [runDay, setRunDay] = useState<number | null>(null)
  const [editRow, setEditRow] = useState<{ di: number; ei: number } | null>(null)
  const [copyOpen, setCopyOpen] = useState(false)
  const [emptyNotice, setEmptyNotice] = useState<{ week: number; dayOfWeek: StructuredDay['dayOfWeek'] }[] | null>(null)

  // Weekly routine = General program with no week count → no periodization,
  // no start/end date setup. Powerlifting always requires a week count + setup.
  const isWeekly = programType === 'general' && weeksInput.trim() === ''
  const typedWeeks = Math.max(1, Math.min(52, Math.floor(Number(weeksInput)) || 1))
  const weeksValid = isWeekly || Number(weeksInput) >= 1
  const multiWeek = !isWeekly && drafts.length > 1
  const wk = multiWeek ? Math.min(selWeek, drafts.length - 1) : 0
  const week = drafts[wk]
  const days = week.days

  // Resize on commit (blur/Enter), not per keystroke — typing "12" passes through "1".
  const commitWeeks = () => {
    if (!weeksValid) return
    const n = isWeekly ? 1 : typedWeeks
    if (n === drafts.length) return
    if (n < drafts.length) {
      const lost = drafts.slice(n).some(w => w.days.length > 0)
      const range = n + 1 === drafts.length ? `${drafts.length}` : `${n + 1}–${drafts.length}`
      if (lost && !window.confirm(`ลดเหลือ ${n} สัปดาห์? สัปดาห์ ${range} และ progress ของสัปดาห์เหล่านั้นจะถูกลบ`)) {
        setWeeksInput(String(drafts.length))
        return
      }
    }
    setDrafts(d => resizeWeeks(d, n))
    setSelWeek(s => Math.min(s, n - 1))
  }

  const updateWeek = (fn: (w: WeekDraft) => WeekDraft) =>
    setDrafts(d => d.map((w, i) => (i === wk ? fn(w) : w)))
  const updateDays = (fn: (days: DayDraft[]) => DayDraft[]) => updateWeek(w => ({ ...w, days: fn(w.days) }))
  const setDayField = (i: number, patch: Partial<DayDraft>) =>
    updateDays(ds => ds.map((day, idx) => idx === i ? { ...day, ...patch } : day))

  const addDay = (allWeeks: boolean) => {
    const used = new Set(days.map(d => d.dayOfWeek))
    const next = WEEKDAYS.find(d => !used.has(d)) ?? 'Mon'
    setDrafts(d => d.map((w, i) => {
      if (i !== wk && !allWeeks) return w
      if (w.days.some(x => x.dayOfWeek === next)) return w
      return { ...w, days: [...w.days, { dayOfWeek: next, focus: '', exercises: [] }] }
    }))
  }
  const removeDay = (i: number) => updateDays(ds => ds.filter((_, idx) => idx !== i))
  const removeExercise = (di: number, ei: number) =>
    setDayField(di, { exercises: days[di].exercises.filter((_, idx) => idx !== ei) })
  const reorderExercise = (di: number, from: number, to: number) =>
    updateDays(ds => ds.map((day, i) => i === di ? { ...day, exercises: moveItem(day.exercises, from, to) } : day))
  const replaceExercise = (di: number, ei: number, ex: StructuredExercise) =>
    setDayField(di, { exercises: days[di].exercises.map((x, i) => i === ei ? ex : x) })

  const addPicked = (di: number, res: PickResult) => {
    const day = days[di]
    if (res.scope === 'week') setDrafts(d => addExerciseToWeeks(d, [wk], day.dayOfWeek, res.row))
    else setDrafts(d => addExerciseToWeeks(d, d.map((_, i) => i), day.dayOfWeek, res.rows, day.focus))
  }

  const canSave = name.trim().length > 0 && drafts.some(w => w.days.length > 0) && weeksValid

  const handleCreate = async () => {
    if (!canSave || busy) return
    const stamp = Date.now()
    const finalDrafts = resizeWeeks(drafts, isWeekly ? 1 : typedWeeks)
    const empty = findEmptyDays(finalDrafts)
    if (empty.length) {
      setEmptyNotice(empty)
      return
    }
    const program: StructuredProgram = {
      id: editing ? editing.id : `custom-${stamp}`,
      name: name.trim(),
      description: editing?.description ?? '',
      totalWeeks: finalDrafts.length,
      daysPerWeek: maxDaysPerWeek(finalDrafts),
      focus: focus.trim() || 'Custom',
      isCustom: true,
      // Preserve source (manual/excel) when editing; new programs are manual.
      source: editing?.source === 'excel' ? 'excel' : 'manual',
      weekly: isWeekly || undefined,
      programType,
      weeks: draftToWeeks(finalDrafts, stamp),
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

  const editing_row = editRow ? days[editRow.di]?.exercises[editRow.ei] : undefined

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
              <input className="input-num tnum" type="number" inputMode="numeric" value={weeksInput}
                placeholder={programType === 'general' ? '—' : '4'}
                onChange={e => setWeeksInput(e.target.value)} onFocus={e => e.target.select()}
                onBlur={commitWeeks}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                style={{ width: '100%', textAlign: 'center' }} />
            </div>
          </div>
          <div className="t-mono" style={{ fontSize: 10, color: isWeekly ? 'var(--accent)' : 'var(--muted)' }}>
            {isWeekly
              ? 'โปรแกรมประจำสัปดาห์ · ไม่ต้องตั้งวันเริ่ม/จบ'
              : programType === 'general'
                ? `เว้นว่าง = ประจำสัปดาห์ · ใส่เลข = ${drafts.length} สัปดาห์ แก้ได้ทีละสัปดาห์`
                : `${drafts.length} สัปดาห์ · แก้ได้ทีละสัปดาห์ · เพิ่มสัปดาห์ = คัดลอกสัปดาห์สุดท้าย`}
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
                background: programType === v ? 'rgba(var(--accent-rgb),0.10)' : 'var(--surface-2)',
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

      {/* Week picker */}
      {multiWeek && (
        <div style={{ padding: '0 20px 12px' }}>
          <div className="t-eyebrow" style={{ marginBottom: 8 }}>WEEK</div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {drafts.map((w, i) => {
              const on = i === wk
              return (
                <button key={i} onClick={() => setSelWeek(i)} aria-pressed={on}
                  style={{
                    flexShrink: 0, minWidth: 44, height: 40, borderRadius: 10, cursor: 'pointer', padding: '0 8px',
                    border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                    background: on ? 'rgba(var(--accent-rgb),0.12)' : 'var(--surface-2)',
                    color: on ? 'var(--accent)' : 'var(--text-2)',
                    fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, lineHeight: 1.1,
                  }}>
                  W{i + 1}
                  <div style={{ fontSize: 8, fontWeight: 500, opacity: 0.8 }}>{w.phase.slice(0, 5).toUpperCase()}</div>
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <select value={week.phase} aria-label="Phase"
              onChange={e => updateWeek(w => ({ ...w, phase: e.target.value as ProgramPhase }))}
              style={{
                flex: 1, minWidth: 0, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8,
                color: 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, padding: '8px 10px',
              }}>
              {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <button className="btn btn-secondary" style={{ height: 36, fontSize: 12, padding: '0 12px', flexShrink: 0 }}
              onClick={() => setCopyOpen(true)}>
              <IconCopy size={14} /> คัดลอกสัปดาห์นี้ไป…
            </button>
          </div>
        </div>
      )}

      {/* Days of the selected week */}
      <div style={{ padding: '0 20px 20px' }}>
        <div className="t-eyebrow" style={{ marginBottom: 10 }}>
          {multiWeek ? `WEEK ${wk + 1}` : 'WEEK'} · {days.length} DAYS
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {days.map((day, di) => (
            <div key={`${wk}-${di}`} className="card">
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
                <div style={{ marginBottom: 10 }}>
                  <ReorderList
                    items={day.exercises}
                    getKey={(_ex, ei) => String(ei)}
                    onReorder={(from, to) => reorderExercise(di, from, to)}
                    groupId={`w${wk}-day-${di}`}
                    renderRow={(ex, ei, handle) => (
                      <>
                        {handle}
                        <span className="pill" style={{ fontSize: 8, flexShrink: 0 }}>
                          {ex.type === 'main' ? 'MAIN' : ex.type === 'running' ? 'RUN' : 'ACC'}
                        </span>
                        <button onClick={() => setEditRow({ di, ei })} aria-label={`Edit ${ex.name}`}
                          style={{ all: 'unset', cursor: 'pointer', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</div>
                            <div className="t-mono" style={{ fontSize: 9, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ex.label ?? (ex.type !== 'running' ? getExercise(ex.exerciseId)?.group : '')}
                            </div>
                          </div>
                          <span className="t-mono" style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>{rowSummary(ex)}</span>
                        </button>
                        <button onClick={() => removeExercise(di, ei)} aria-label="Remove exercise"
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2, flexShrink: 0 }}>
                          <IconX size={13} />
                        </button>
                      </>
                    )}
                  />
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

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => addDay(false)}>
            <IconPlus size={16} /> {multiWeek ? `Add Day (W${wk + 1})` : 'Add Day'}
          </button>
          {multiWeek && (
            <button className="btn btn-secondary" style={{ flexShrink: 0, padding: '0 12px', fontSize: 12 }} onClick={() => addDay(true)}>
              <IconPlus size={14} /> เพิ่มวันทุกสัปดาห์
            </button>
          )}
        </div>
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
                background: visibility === v ? 'rgba(var(--accent-rgb),0.10)' : 'var(--surface-2)',
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
          weeks={multiWeek ? drafts.length : 1}
          currentWeek={wk}
          programType={programType}
          onPick={res => { addPicked(pickerDay, res); setPickerDay(null) }}
          onClose={() => setPickerDay(null)}
        />
      )}

      {runDay !== null && (
        <RunPicker
          weeks={multiWeek ? drafts.length : 1}
          currentWeek={wk}
          onPick={res => { addPicked(runDay, res); setRunDay(null) }}
          onClose={() => setRunDay(null)}
        />
      )}

      {editRow && editing_row && (
        <ExerciseRowSheet
          key={`${wk}-${editRow.di}-${editRow.ei}`}
          ex={editing_row}
          weekLabel={multiWeek ? `W${wk + 1} · ${days[editRow.di].dayOfWeek}` : days[editRow.di].dayOfWeek}
          onSave={ex => { replaceExercise(editRow.di, editRow.ei, ex); setEditRow(null) }}
          onClose={() => setEditRow(null)}
        />
      )}

      {emptyNotice && (
        <div className="sheet-backdrop" onClick={() => setEmptyNotice(null)} style={{ zIndex: 100 }}>
          <div className="sheet" role="alertdialog" aria-labelledby="empty-days-title" onClick={e => e.stopPropagation()}
            style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="sheet-handle" />
            <h3 id="empty-days-title" className="t-display" style={{ margin: '0 0 6px', fontSize: 20, color: 'var(--danger)' }}>
              บันทึกไม่ได้ · มีวันที่ไม่มีท่า
            </h3>
            <p className="t-mono" style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
              วันเทรนต้องมีอย่างน้อย 1 ท่า — เพิ่มท่า หรือลบวันเหล่านี้ก่อน ({emptyNotice.length} วัน)
            </p>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {emptyNotice.map(({ week: w, dayOfWeek }) => (
                <button key={`${w}-${dayOfWeek}`} className="pill"
                  onClick={() => { setSelWeek(w); setEmptyNotice(null) }}
                  style={{ cursor: 'pointer', fontSize: 11, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                  {multiWeek ? `W${w + 1} · ` : ''}{dayOfWeek}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEmptyNotice(null)}>
                กลับไปแก้
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }}
                onClick={() => { setDrafts(removeEmptyDays); setEmptyNotice(null) }}>
                ลบวันว่างทั้งหมด
              </button>
            </div>
          </div>
        </div>
      )}

      {copyOpen && (
        <CopyWeekSheet
          from={wk}
          total={drafts.length}
          onCopy={targets => { setDrafts(d => copyWeek(d, wk, targets)); setCopyOpen(false) }}
          onClose={() => setCopyOpen(false)}
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

function RunPicker({ weeks, currentWeek, onPick, onClose }: {
  weeks: number
  currentWeek: number
  onPick: (res: PickResult) => void
  onClose: () => void
}) {
  const [label, setLabel] = useState('')
  const [dist, setDist] = useState('')
  const [dur, setDur] = useState('')
  const [scope, setScope] = useState<'week' | 'all'>('week')
  const allWeeks = scope === 'all' && weeks > 1

  const confirm = () => {
    const row: StructuredExercise = {
      exerciseId: 'running',
      name: label.trim() || 'Running',
      type: 'running',
      ...(Number(dist) > 0 ? { distanceKm: round2(Number(dist)) } : {}),
      ...(Number(dur) > 0 ? { durationMin: round2(Number(dur)) } : {}),
    }
    onPick(allWeeks ? { scope: 'all', rows: Array.from({ length: weeks }, () => ({ ...row })) } : { scope: 'week', row })
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

        {weeks > 1 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {([['week', `เฉพาะ W${currentWeek + 1}`], ['all', `ทุกสัปดาห์ (${weeks})`]] as const).map(([v, text]) => (
              <button key={v} onClick={() => setScope(v)} aria-pressed={scope === v}
                style={{
                  flex: 1, height: 34, borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${scope === v ? 'var(--accent)' : 'var(--border)'}`,
                  background: scope === v ? 'rgba(var(--accent-rgb),0.12)' : 'var(--surface-2)',
                  color: scope === v ? 'var(--accent)' : 'var(--text-2)',
                  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                }}>
                {text}
              </button>
            ))}
          </div>
        )}

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
          <IconPlus size={16} /> {allWeeks ? `Add to ${weeks} weeks` : 'Add to Day'}
        </button>
      </div>
    </div>
  )
}

// Sets and reps index rows and drive loop counts, so they must be whole numbers.
// `<input type="number">` accepts '2.5' whatever the step, and a fractional reps
// used to reach RPE_TABLE as a non-integer index and white-screen the app.
function wholeOr(value: string | undefined, fallback: number): number {
  const n = Math.round(Number(value))
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const pctToFraction = (v: string): number | undefined => {
  const t = v.trim()
  if (!t) return undefined
  const n = Number(t)
  return Number.isFinite(n) && n > 0 ? Math.min(1.1, n / 100) : undefined
}
const numOrUndef = (v: string): number | undefined => {
  const t = v.trim()
  if (!t) return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}
const LABEL_CHIPS = ['Top set', 'Back-off', 'Work sets'] as const

const fieldStyle = { width: '100%', textAlign: 'center' } as const
const textFieldStyle = { width: '100%', textAlign: 'left', fontFamily: 'var(--font-mono)', textTransform: 'none', fontSize: 13 } as const

function ExercisePicker({ weeks, currentWeek, programType, onPick, onClose }: {
  weeks: number
  currentWeek: number
  programType: 'general' | 'powerlifting'
  onPick: (res: PickResult) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('All')
  const [pickedId, setPickedId] = useState('')
  const [type, setType] = useState<'main' | 'accessory'>('accessory')
  const [scope, setScope] = useState<'week' | 'all'>('week')
  const [label, setLabel] = useState('')
  const [sets, setSets] = useState('3')
  const [reps, setReps] = useState('10')
  const [rpe, setRpe] = useState('')
  const [pct, setPct] = useState('')
  const [basePct, setBasePct] = useState('')
  const [stepPct, setStepPct] = useState('')
  const [wSets, setWSets] = useState<string[]>([])
  const [wReps, setWReps] = useState<string[]>([])
  const [wPct, setWPct] = useState<string[]>([])
  const [wRpe, setWRpe] = useState<string[]>([])

  const isPLMain = programType === 'powerlifting' && type === 'main'
  // Per-week Set/Rep/% table only when adding a powerlifting main lift to every week.
  const showWeekly = isPLMain && scope === 'all' && weeks > 1

  // Reset the config step to defaults (called when going back to the exercise list).
  const resetConfig = () => {
    setType('accessory'); setScope('week'); setLabel('')
    setSets('3'); setReps('10'); setRpe(''); setPct('')
    setBasePct(''); setStepPct('')
    setWSets([]); setWReps([]); setWPct([]); setWRpe([])
  }

  const fillPct = () => {
    const b = Number(basePct)
    if (!b) return
    const s = Number(stepPct) || 0
    setWPct(Array.from({ length: weeks }, (_, i) =>
      String(Math.max(0, Math.min(110, Math.round((b + s * i) * 10) / 10)))
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
    const base: StructuredExercise = {
      exerciseId: ex.id,
      name: ex.name,
      ...(label.trim() ? { label: label.trim() } : {}),
      type,
      sets: wholeOr(sets, 3),
      reps: wholeOr(reps, 10),
    }
    const baseRpe = numOrUndef(rpe)
    if (!showWeekly) {
      const row = { ...base }
      if (baseRpe !== undefined) row.rpe = baseRpe
      const p = isPLMain ? pctToFraction(pct) : undefined
      if (p !== undefined) row.pct = p
      onPick(scope === 'all' && weeks > 1
        ? { scope: 'all', rows: Array.from({ length: weeks }, () => ({ ...row })) }
        : { scope: 'week', row })
      return
    }
    const rows = Array.from({ length: weeks }, (_, i) => {
      const row = { ...base }
      row.sets = wholeOr(wSets[i] || sets, base.sets ?? 3)
      row.reps = wholeOr(wReps[i] || reps, typeof base.reps === 'number' ? base.reps : 10)
      const p = pctToFraction(wPct[i] ?? '')
      if (p !== undefined) row.pct = p
      const r = numOrUndef(wRpe[i] ?? '') ?? baseRpe // blank per-week cell falls back to RPE (BASE)
      if (r !== undefined) row.rpe = r
      return row
    })
    onPick({ scope: 'all', rows })
  }

  const toggle = <T extends string>(value: T, current: T, set: (v: T) => void, text: string) => (
    <button key={value} onClick={() => set(value)}
      style={{
        flex: 1, height: 34, borderRadius: 8, cursor: 'pointer',
        border: `1px solid ${current === value ? 'var(--accent)' : 'var(--border)'}`,
        background: current === value ? 'rgba(var(--accent-rgb),0.12)' : 'var(--surface-2)',
        color: current === value ? 'var(--accent)' : 'var(--text-2)',
        fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
      }}>
      {text}
    </button>
  )

  return (
    <div className="sheet-backdrop" onClick={onClose} style={{ zIndex: 100 }}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div className="sheet-handle" />
        {pickedId === '' ? (
        <>
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
                    background: pickedId === ex.id ? 'rgba(var(--accent-rgb),0.08)' : 'transparent', boxSizing: 'border-box',
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
        </>
        ) : (
        <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <button className="btn-icon" onClick={() => { setPickedId(''); resetConfig() }} aria-label="Back">
            <IconChevronLeft size={18} />
          </button>
          <h3 className="t-display" style={{ margin: 0, fontSize: 18, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {allExercises().find(e => e.id === pickedId)?.name ?? 'Exercise'}
          </h3>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12 }}>
            {weeks > 1 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {toggle('week', scope, setScope, `เฉพาะ W${currentWeek + 1}`)}
                {toggle('all', scope, setScope, `ทุกสัปดาห์ (${weeks})`)}
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {toggle('main', type, setType, 'MAIN')}
              {toggle('accessory', type, setType, 'ACCESSORY')}
            </div>

            <div style={{ marginBottom: 10 }}>
              <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>LABEL / ชื่อเซ็ต (OPT)</div>
              <input className="input-num" type="text" value={label} placeholder="e.g. Top set"
                onChange={e => setLabel(e.target.value)} style={textFieldStyle} />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                {LABEL_CHIPS.map(c => (
                  <button key={c} onClick={() => setLabel(c)} className="pill"
                    style={{ cursor: 'pointer', fontSize: 9, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[
                { label: showWeekly ? 'SETS (BASE)' : 'SETS', val: sets, set: setSets, ph: '3', step: '1' },
                { label: showWeekly ? 'REPS (BASE)' : 'REPS', val: reps, set: setReps, ph: '10', step: '1' },
                { label: showWeekly ? 'RPE (BASE)' : 'RPE (opt)', val: rpe, set: setRpe, ph: '—', step: '0.5' },
                ...(isPLMain && !showWeekly ? [{ label: '%1RM (opt)', val: pct, set: setPct, ph: '—', step: '0.5' }] : []),
              ].map(({ label: l, val, set, ph, step }) => (
                <div key={l} style={{ flex: 1 }}>
                  <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>{l}</div>
                  <input className="input-num tnum" type="number" inputMode="decimal" step={step} {...(step === '1' ? { min: '1' } : {})}
                    value={val} placeholder={ph}
                    onChange={e => set(e.target.value)} onFocus={e => e.target.select()}
                    style={fieldStyle} />
                </div>
              ))}
            </div>

            {showWeekly && (
              <div style={{ marginBottom: 12 }}>
                <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>Set / Rep / %1RM / RPE ต่อสัปดาห์</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>BASE %</div>
                    <input className="input-num tnum" type="number" inputMode="numeric" value={basePct} placeholder="70"
                      onChange={e => setBasePct(e.target.value)} onFocus={e => e.target.select()}
                      style={fieldStyle} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>STEP %/WK</div>
                    <input className="input-num tnum" type="number" inputMode="numeric" value={stepPct} placeholder="5"
                      onChange={e => setStepPct(e.target.value)} onFocus={e => e.target.select()}
                      style={fieldStyle} />
                  </div>
                  <button className="btn btn-secondary" style={{ height: 36, padding: '0 14px', flexShrink: 0, opacity: basePct ? 1 : 0.4 }}
                    disabled={!basePct} onClick={fillPct}>Fill %</button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '26px 1fr 1fr 1fr 1fr', gap: 4, alignItems: 'center', minWidth: 260 }}>
                    <div />
                    <div className="t-eyebrow" style={{ fontSize: 8, textAlign: 'center' }}>SET</div>
                    <div className="t-eyebrow" style={{ fontSize: 8, textAlign: 'center' }}>REP</div>
                    <div className="t-eyebrow" style={{ fontSize: 8, textAlign: 'center' }}>%</div>
                    <div className="t-eyebrow" style={{ fontSize: 8, textAlign: 'center' }}>RPE</div>
                    {Array.from({ length: weeks }, (_, i) => (
                      <Fragment key={i}>
                        <div className="t-mono" style={{ fontSize: 9, color: 'var(--muted)', textAlign: 'center' }}>{i + 1}</div>
                        <input className="input-num tnum" type="number" inputMode="numeric" step="1" min="1" value={wSets[i] ?? ''} placeholder={sets || '—'}
                          onChange={e => editCell(wSets, setWSets, i, e.target.value)} onFocus={e => e.target.select()}
                          style={fieldStyle} />
                        <input className="input-num tnum" type="number" inputMode="numeric" step="1" min="1" value={wReps[i] ?? ''} placeholder={reps || '—'}
                          onChange={e => editCell(wReps, setWReps, i, e.target.value)} onFocus={e => e.target.select()}
                          style={fieldStyle} />
                        <input className="input-num tnum" type="number" inputMode="numeric" value={wPct[i] ?? ''} placeholder="—"
                          onChange={e => editCell(wPct, setWPct, i, e.target.value)} onFocus={e => e.target.select()}
                          style={fieldStyle} />
                        <input className="input-num tnum" type="number" inputMode="decimal" step="0.5" value={wRpe[i] ?? ''} placeholder={rpe || '—'}
                          onChange={e => editCell(wRpe, setWRpe, i, e.target.value)} onFocus={e => e.target.select()}
                          style={fieldStyle} />
                      </Fragment>
                    ))}
                  </div>
                </div>
                <div className="t-mono" style={{ fontSize: 9, color: 'var(--muted)', marginTop: 6 }}>
                  คำนวณน้ำหนักเฉพาะ squat / bench / deadlift · เว้นว่าง Set/Rep = ใช้ค่า BASE · เว้น % = ใช้ RPE · เว้น RPE = ใช้ค่า BASE
                </div>
              </div>
            )}
        </div>

        <button className="btn btn-primary" style={{ width: '100%', flexShrink: 0 }} onClick={confirm}>
          <IconPlus size={16} /> {scope === 'all' && weeks > 1 ? `Add to ${weeks} weeks` : 'Add to Day'}
        </button>
        </>
        )}
      </div>
    </div>
  )
}

// Edit one row of one week in place (sets/reps/%/RPE/label/note, or a run's target).
function ExerciseRowSheet({ ex, weekLabel, onSave, onClose }: {
  ex: StructuredExercise
  weekLabel: string
  onSave: (ex: StructuredExercise) => void
  onClose: () => void
}) {
  const isRun = ex.type === 'running'
  const [label, setLabel] = useState(ex.label ?? '')
  const [sets, setSets] = useState(ex.sets !== undefined ? String(ex.sets) : '')
  const [reps, setReps] = useState(ex.reps !== undefined ? String(ex.reps) : '')
  const [pct, setPct] = useState(ex.pct !== undefined ? String(Math.round(ex.pct * 1000) / 10) : '')
  const [rpe, setRpe] = useState(ex.rpe !== undefined ? String(ex.rpe) : '')
  const [note, setNote] = useState(ex.note ?? '')
  const [runName, setRunName] = useState(ex.name)
  const [dist, setDist] = useState(ex.distanceKm !== undefined ? String(ex.distanceKm) : '')
  const [dur, setDur] = useState(ex.durationMin !== undefined ? String(ex.durationMin) : '')

  const save = () => {
    const next: StructuredExercise = { ...ex }
    const setOpt = <K extends keyof StructuredExercise>(k: K, v: StructuredExercise[K] | undefined) => {
      if (v === undefined || v === '') delete next[k]
      else next[k] = v
    }
    setOpt('note', note.trim() || undefined)
    if (isRun) {
      next.name = runName.trim() || 'Running'
      setOpt('distanceKm', Number(dist) > 0 ? round2(Number(dist)) : undefined)
      setOpt('durationMin', Number(dur) > 0 ? round2(Number(dur)) : undefined)
    } else {
      setOpt('label', label.trim() || undefined)
      next.sets = wholeOr(sets, ex.sets ?? 3)
      next.reps = reps.trim().toUpperCase() === 'AMRAP' ? 'AMRAP' : wholeOr(reps, typeof ex.reps === 'number' ? ex.reps : 5)
      setOpt('pct', pctToFraction(pct))
      setOpt('rpe', numOrUndef(rpe))
    }
    onSave(next)
  }

  return (
    <div className="sheet-backdrop" onClick={onClose} style={{ zIndex: 100 }}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div className="sheet-handle" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h3 className="t-display" style={{ margin: 0, fontSize: 20, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Close"><IconX size={18} /></button>
        </div>
        <p className="t-mono" style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 14 }}>
          แก้เฉพาะแถวนี้ของ {weekLabel} · สัปดาห์อื่นไม่เปลี่ยน
        </p>
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {isRun ? (
            <>
              <div>
                <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>LABEL</div>
                <input className="input-num" type="text" value={runName} onChange={e => setRunName(e.target.value)} style={textFieldStyle} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { l: 'DISTANCE (KM)', v: dist, s: setDist },
                  { l: 'TIME (MIN)', v: dur, s: setDur },
                ].map(({ l, v, s }) => (
                  <div key={l} style={{ flex: 1 }}>
                    <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>{l}</div>
                    <input className="input-num tnum" type="number" inputMode="decimal" value={v}
                      onChange={e => s(e.target.value)} onFocus={e => e.target.select()} style={fieldStyle} />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>LABEL / ชื่อเซ็ต</div>
                <input className="input-num" type="text" value={label} placeholder="e.g. Top set"
                  onChange={e => setLabel(e.target.value)} style={textFieldStyle} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>SETS</div>
                  <input className="input-num tnum" type="number" inputMode="numeric" step="1" min="1" value={sets}
                    onChange={e => setSets(e.target.value)} onFocus={e => e.target.select()} style={fieldStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>REPS</div>
                  <input className="input-num tnum" type="text" inputMode="numeric" value={reps} placeholder="5 / AMRAP"
                    onChange={e => setReps(e.target.value)} onFocus={e => e.target.select()} style={fieldStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>%1RM</div>
                  <input className="input-num tnum" type="number" inputMode="decimal" step="0.5" value={pct} placeholder="—"
                    onChange={e => setPct(e.target.value)} onFocus={e => e.target.select()} style={fieldStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>RPE</div>
                  <input className="input-num tnum" type="number" inputMode="decimal" step="0.5" value={rpe} placeholder="—"
                    onChange={e => setRpe(e.target.value)} onFocus={e => e.target.select()} style={fieldStyle} />
                </div>
              </div>
            </>
          )}
          <div>
            <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>NOTE</div>
            <textarea className="input-num" value={note} rows={2} onChange={e => setNote(e.target.value)}
              style={{ ...textFieldStyle, height: 'auto', minHeight: 56, padding: 10, resize: 'vertical' }} />
          </div>
          {!isRun && (
            <div className="t-mono" style={{ fontSize: 9, color: 'var(--muted)' }}>
              มี % → คำนวณน้ำหนักจาก % · ไม่มี % → ใช้ RPE (เฉพาะ squat / bench / deadlift)
            </div>
          )}
        </div>
        <button className="btn btn-primary" style={{ width: '100%', flexShrink: 0 }} onClick={save}>
          <IconCheck size={16} stroke={3} /> Save row
        </button>
      </div>
    </div>
  )
}

// Pick which weeks receive a copy of the selected week (their rows are replaced).
function CopyWeekSheet({ from, total, onCopy, onClose }: {
  from: number
  total: number
  onCopy: (targets: number[]) => void
  onClose: () => void
}) {
  const [picked, setPicked] = useState<Set<number>>(() => new Set())
  const toggleWeek = (i: number) => setPicked(p => {
    const n = new Set(p)
    if (n.has(i)) n.delete(i)
    else n.add(i)
    return n
  })
  const after = Array.from({ length: total }, (_, i) => i).filter(i => i > from)

  return (
    <div className="sheet-backdrop" onClick={onClose} style={{ zIndex: 100 }}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h3 className="t-display" style={{ margin: 0, fontSize: 20 }}>คัดลอก W{from + 1} ไป…</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Close"><IconX size={18} /></button>
        </div>
        <p className="t-mono" style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
          ท่าทั้งหมดของสัปดาห์ที่เลือกจะถูกแทนที่ด้วยท่าของ W{from + 1} (Phase ไม่เปลี่ยน)
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <button className="btn btn-secondary" style={{ flex: 1, height: 34, fontSize: 11 }} disabled={!after.length}
            onClick={() => setPicked(new Set(after))}>ทุกสัปดาห์ถัดไป</button>
          <button className="btn btn-secondary" style={{ flex: 1, height: 34, fontSize: 11 }}
            onClick={() => setPicked(new Set())}>ล้าง</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))', gap: 6, marginBottom: 16 }}>
          {Array.from({ length: total }, (_, i) => {
            const on = picked.has(i)
            const self = i === from
            return (
              <button key={i} disabled={self} onClick={() => toggleWeek(i)} aria-pressed={on}
                style={{
                  height: 38, borderRadius: 8, cursor: self ? 'default' : 'pointer', opacity: self ? 0.35 : 1,
                  border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                  background: on ? 'rgba(var(--accent-rgb),0.12)' : 'var(--surface-2)',
                  color: on ? 'var(--accent)' : 'var(--text-2)',
                  fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12,
                }}>
                W{i + 1}
              </button>
            )
          })}
        </div>
        <button className="btn btn-primary" style={{ width: '100%', opacity: picked.size ? 1 : 0.4 }} disabled={!picked.size}
          onClick={() => {
            if (window.confirm(`แทนที่ท่าใน ${picked.size} สัปดาห์ด้วย W${from + 1}?`)) onCopy([...picked].sort((a, b) => a - b))
          }}>
          <IconCopy size={16} /> คัดลอกไป {picked.size} สัปดาห์
        </button>
      </div>
    </div>
  )
}
