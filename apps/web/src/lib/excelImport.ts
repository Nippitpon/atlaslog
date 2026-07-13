import * as XLSX from 'xlsx'
import type { StructuredProgram, StructuredWeek, StructuredDay, StructuredExercise, ProgramPhase } from '@atlaslog/shared'

const VALID_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export interface ImportResult {
  program: StructuredProgram | null
  errors: string[]
}

// ─── Header normalization ─────────────────────────────────────────────────────
// Accepts both the native template (lowercase snake_case: week, day_of_week,
// exercise_id …) and coach-authored templates (Title Case: Week, Day, Lift,
// Variant, Prescription, Type=Work/Test …). Each header cell is normalized then
// mapped to a canonical internal key.

type Canonical =
  | 'week' | 'phase' | 'day_of_week' | 'lift' | 'exercise_id' | 'exercise_name'
  | 'variant' | 'prescription' | 'type' | 'sets' | 'reps' | 'pct' | 'rpe'
  | 'note' | 'focus' | 'distance' | 'duration'

const HEADER_ALIASES: Record<string, Canonical> = {
  week: 'week', wk: 'week',
  phase: 'phase', block: 'phase',
  day: 'day_of_week', day_of_week: 'day_of_week', dayofweek: 'day_of_week', weekday: 'day_of_week',
  lift: 'lift',
  exercise_id: 'exercise_id', exerciseid: 'exercise_id', id: 'exercise_id',
  exercise_name: 'exercise_name', exercisename: 'exercise_name', exercise: 'exercise_name', name: 'exercise_name',
  variant: 'variant',
  prescription: 'prescription', rx: 'prescription', set_type: 'prescription', settype: 'prescription',
  type: 'type',
  sets: 'sets', set: 'sets',
  reps: 'reps', rep: 'reps',
  pct: 'pct', percent: 'pct', percentage: 'pct', '1rm': 'pct', pct_1rm: 'pct', pct1rm: 'pct',
  rpe: 'rpe',
  note: 'note', notes: 'note', comment: 'note', comments: 'note',
  focus: 'focus',
  distance: 'distance', distance_km: 'distance', distancekm: 'distance', km: 'distance',
  duration: 'duration', duration_min: 'duration', durationmin: 'duration', min: 'duration',
}

function normHeader(h: unknown): string {
  return String(h ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

// ─── Value dictionaries ───────────────────────────────────────────────────────

const DAY_ALIASES: Record<string, string> = {
  mon: 'Mon', monday: 'Mon', จันทร์: 'Mon',
  tue: 'Tue', tues: 'Tue', tuesday: 'Tue', อังคาร: 'Tue',
  wed: 'Wed', weds: 'Wed', wednesday: 'Wed', พุธ: 'Wed',
  thu: 'Thu', thur: 'Thu', thurs: 'Thu', thursday: 'Thu', พฤหัส: 'Thu', พฤหัสบดี: 'Thu',
  fri: 'Fri', friday: 'Fri', ศุกร์: 'Fri',
  sat: 'Sat', saturday: 'Sat', เสาร์: 'Sat',
}

const LIFT_DICTIONARY: Record<string, { id: string; name: string }> = {
  squat: { id: 'squat', name: 'Squat' },
  back_squat: { id: 'squat', name: 'Squat' },
  backsquat: { id: 'squat', name: 'Squat' },
  bench: { id: 'bench', name: 'Bench Press' },
  bench_press: { id: 'bench', name: 'Bench Press' },
  benchpress: { id: 'bench', name: 'Bench Press' },
  deadlift: { id: 'deadlift', name: 'Deadlift' },
  dead_lift: { id: 'deadlift', name: 'Deadlift' },
  conventional_deadlift: { id: 'deadlift', name: 'Deadlift' },
  sumo_deadlift: { id: 'deadlift', name: 'Deadlift' },
}

function mapPhase(raw: string): ProgramPhase {
  const v = raw.toLowerCase()
  if (v.includes('accum')) return 'Accumulation'
  if (v.includes('intens')) return 'Intensification'
  if (v.includes('peak')) return 'Peaking'
  if (v.includes('taper') || v.includes('test')) return 'Taper'
  return 'Accumulation'
}

function mapType(raw: string): 'main' | 'accessory' | 'running' {
  const v = raw.toLowerCase().trim()
  if (v === 'accessory' || v === 'acc') return 'accessory'
  if (v === 'running' || v === 'run' || v === 'cardio') return 'running'
  // 'work' / 'test' / 'main' / '' all map to a computed main lift
  return 'main'
}

function slug(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '_')
}

function prettifyName(fileName: string): string {
  return fileName.replace(/\.(xlsx|xls)$/i, '').replace(/[-_]+/g, ' ').trim()
}

// ─── Parser ───────────────────────────────────────────────────────────────────

export async function parseExcelFile(file: File): Promise<ImportResult> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' })
  const errors: string[] = []

  // Meta sheet is OPTIONAL. When present it provides name/description/focus/type.
  const meta = { name: '', description: '', focus: '', programType: '' }
  const metaSheet = workbook.Sheets['Meta']
  if (metaSheet) {
    const metaData = XLSX.utils.sheet_to_json<unknown[]>(metaSheet, { header: 1 }) as unknown[][]
    for (const row of metaData) {
      const key = String(row[0] ?? '').trim().toLowerCase()
      const val = String(row[1] ?? '').trim()
      if (key === 'name') meta.name = val
      if (key === 'description') meta.description = val
      if (key === 'focus') meta.focus = val
      if (key === 'program_type') meta.programType = val.toLowerCase()
    }
  }

  // Locate the program sheet: prefer "Program", then "Template", then the first
  // sheet whose header row exposes the required columns.
  const findSheet = (): { sheet: XLSX.WorkSheet; colIndex: Partial<Record<Canonical, number>> } | null => {
    const candidates = [
      workbook.Sheets['Program'],
      workbook.Sheets['Template'],
      ...workbook.SheetNames.map(n => workbook.Sheets[n]),
    ].filter(Boolean) as XLSX.WorkSheet[]
    for (const sheet of candidates) {
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false }) as unknown[][]
      if (!aoa.length) continue
      const header = aoa[0]
      const colIndex: Partial<Record<Canonical, number>> = {}
      header.forEach((h, i) => {
        const canon = HEADER_ALIASES[normHeader(h)]
        if (canon && colIndex[canon] === undefined) colIndex[canon] = i
      })
      const hasExercise = colIndex.lift !== undefined || colIndex.exercise_id !== undefined
      if (colIndex.week !== undefined && colIndex.day_of_week !== undefined && hasExercise) {
        return { sheet, colIndex }
      }
    }
    return null
  }

  const found = findSheet()
  if (!found) {
    return {
      program: null,
      errors: ['ไม่พบตารางโปรแกรมที่อ่านได้ — ต้องมี sheet ที่มี column: Week, Day และ Lift (หรือ exercise_id)'],
    }
  }
  const { sheet, colIndex } = found
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false }) as unknown[][]
  const dataRows = aoa.slice(1)

  const cell = (row: unknown[], key: Canonical): unknown => {
    const i = colIndex[key]
    return i === undefined ? undefined : row[i]
  }
  const cellStr = (row: unknown[], key: Canonical): string => {
    const v = cell(row, key)
    return v === undefined || v === null ? '' : String(v).trim()
  }

  // Group rows by week → day-of-week
  const weekMap = new Map<number, Map<string, StructuredExercise[]>>()
  const weekPhase = new Map<number, ProgramPhase>()
  const dayFocusMap = new Map<string, string>()

  dataRows.forEach((row, idx) => {
    const rowNum = idx + 2 // header is row 1

    // Skip fully-empty rows
    const nonEmpty = (['week', 'day_of_week', 'lift', 'exercise_id', 'sets', 'reps', 'note'] as Canonical[])
      .some(k => cellStr(row, k) !== '')
    if (!nonEmpty) return

    const week = Number(cell(row, 'week'))
    if (!Number.isInteger(week) || week < 1) {
      errors.push(`Row ${rowNum}: "Week" ต้องเป็นจำนวนเต็มมากกว่า 0`)
      return
    }

    const dayRaw = cellStr(row, 'day_of_week')
    const dayOfWeek = DAY_ALIASES[dayRaw.toLowerCase()] ?? (VALID_DAYS.includes(dayRaw) ? dayRaw : '')
    if (!dayOfWeek) {
      errors.push(`Row ${rowNum}: "Day" ต้องเป็น ${VALID_DAYS.join('/')} (ได้รับ: "${dayRaw}")`)
      return
    }

    const type = mapType(cellStr(row, 'type'))
    const isRunning = type === 'running'

    // Resolve exercise: prefer Lift dictionary, else explicit exercise_id/name.
    let exerciseId: string
    let exerciseName: string
    const liftRaw = cellStr(row, 'lift')
    if (liftRaw) {
      const mapped = LIFT_DICTIONARY[slug(liftRaw)]
      if (mapped) { exerciseId = mapped.id; exerciseName = mapped.name }
      else { exerciseId = slug(liftRaw); exerciseName = liftRaw }
    } else {
      exerciseId = slug(cellStr(row, 'exercise_id'))
      exerciseName = cellStr(row, 'exercise_name') || liftRaw
    }
    if (!exerciseId || !exerciseName) {
      errors.push(`Row ${rowNum}: ต้องมี "Lift" หรือ "exercise_id" + "exercise_name"`)
      return
    }

    // Variant + Prescription → display sub-label
    const variant = cellStr(row, 'variant')
    const prescription = cellStr(row, 'prescription')
    const label = [variant, prescription].filter(Boolean).join(' · ') || undefined

    // Running rows carry distance/duration instead of sets/reps.
    const distance = cellStr(row, 'distance') !== '' ? Number(cell(row, 'distance')) || undefined : undefined
    const duration = cellStr(row, 'duration') !== '' ? Number(cell(row, 'duration')) || undefined : undefined

    let note = cellStr(row, 'note') || undefined

    if (isRunning) {
      pushExercise(weekMap, week, dayOfWeek, {
        exerciseId, name: exerciseName, label, type: 'running',
        distanceKm: distance, durationMin: duration, note,
      })
    } else {
      // sets: integer 1–50
      const sets = Number(cell(row, 'sets'))
      if (!Number.isInteger(sets) || sets < 1 || sets > 50) {
        errors.push(`Row ${rowNum}: "Sets" ต้องเป็นจำนวนเต็ม 1–50 (ได้รับ: "${cellStr(row, 'sets')}")`)
        return
      }

      // reps: positive integer or AMRAP
      const repsRaw = cellStr(row, 'reps')
      let reps: number | string
      if (repsRaw.toLowerCase() === 'amrap') {
        reps = 'AMRAP'
      } else {
        const n = Number(cell(row, 'reps'))
        if (!Number.isInteger(n) || n < 1) {
          errors.push(`Row ${rowNum}: "Reps" ต้องเป็นจำนวนเต็มบวก หรือ "AMRAP" (ได้รับ: "${repsRaw}")`)
          return
        }
        reps = n
      }

      // pct: 0 < pct ≤ 1.1 (attempts may exceed 100%). Empty → undefined.
      let pct: number | undefined
      const pctRaw = cellStr(row, 'pct')
      if (pctRaw !== '') {
        const p = Number(cell(row, 'pct'))
        if (!Number.isFinite(p) || p <= 0 || p > 1.1) {
          errors.push(`Row ${rowNum}: "PCT" ต้องอยู่ในช่วง 0–1.1 (เช่น 0.75 = 75%) (ได้รับ: "${pctRaw}")`)
          return
        }
        pct = p
      }

      // rpe: numeric only. Non-numeric (e.g. "<6.0") is preserved into the note.
      let rpe: number | undefined
      const rpeRaw = cellStr(row, 'rpe')
      if (rpeRaw !== '') {
        const r = Number(cell(row, 'rpe'))
        if (Number.isFinite(r)) {
          rpe = r
        } else {
          note = note ? `${note} · RPE ${rpeRaw}` : `RPE ${rpeRaw}`
        }
      }

      pushExercise(weekMap, week, dayOfWeek, {
        exerciseId, name: exerciseName, label, type,
        sets, reps, pct, rpe, note,
      })
    }

    if (!weekPhase.has(week)) weekPhase.set(week, mapPhase(cellStr(row, 'phase')))

    const focusKey = `${week}-${dayOfWeek}`
    const focusCol = cellStr(row, 'focus')
    if (focusCol && !dayFocusMap.has(focusKey)) dayFocusMap.set(focusKey, focusCol)
  })

  if (errors.length > 0) return { program: null, errors }
  if (weekMap.size === 0) return { program: null, errors: ['ไม่พบข้อมูลโปรแกรม (ตารางว่างเปล่า)'] }

  // Build StructuredProgram
  const sortedWeekNums = Array.from(weekMap.keys()).sort((a, b) => a - b)
  const weeks: StructuredWeek[] = sortedWeekNums.map((weekNum) => {
    const dayMap = weekMap.get(weekNum)!
    const sortedDays = Array.from(dayMap.keys()).sort((a, b) => VALID_DAYS.indexOf(a) - VALID_DAYS.indexOf(b))

    const days: StructuredDay[] = sortedDays.map((dayOfWeek, dIdx) => {
      const exercises = dayMap.get(dayOfWeek)!
      // Assign a stable per-row id so same-lift rows (top set + back-off) never
      // collide when the week view keys weight overrides by exercise.
      exercises.forEach((ex, ei) => { ex.id = `w${weekNum}-${dayOfWeek}-e${ei}` })
      const derivedFocus = Array.from(new Set(exercises.map(e => e.name))).join(' · ')
      return {
        id: `day-${dIdx + 1}`,
        dayOfWeek: dayOfWeek as StructuredDay['dayOfWeek'],
        focus: dayFocusMap.get(`${weekNum}-${dayOfWeek}`) || derivedFocus || dayOfWeek,
        exercises,
      }
    })

    return {
      id: `week-${weekNum}`,
      weekNumber: weekNum,
      phase: weekPhase.get(weekNum) ?? 'Accumulation',
      days,
    }
  })

  const maxDaysPerWeek = Math.max(...weeks.map(w => w.days.length))
  const name = meta.name || prettifyName(file.name) || 'Imported Program'

  const program: StructuredProgram = {
    id: `custom-${Date.now()}`,
    name,
    description: meta.description || `Custom program — ${name}`,
    totalWeeks: sortedWeekNums.length,
    daysPerWeek: maxDaysPerWeek,
    focus: meta.focus || 'Squat · Bench · Deadlift',
    weeks,
    isCustom: true,
    source: 'excel',
    programType: meta.programType === 'general' ? 'general' : 'powerlifting',
  }

  return { program, errors: [] }
}

function pushExercise(
  weekMap: Map<number, Map<string, StructuredExercise[]>>,
  week: number,
  dayOfWeek: string,
  ex: StructuredExercise,
) {
  if (!weekMap.has(week)) weekMap.set(week, new Map())
  const dayMap = weekMap.get(week)!
  if (!dayMap.has(dayOfWeek)) dayMap.set(dayOfWeek, [])
  dayMap.get(dayOfWeek)!.push(ex)
}
