import * as XLSX from 'xlsx'
import type { StructuredProgram, StructuredWeek, StructuredDay, StructuredExercise, ProgramPhase } from '@atlaslog/shared'

const REQUIRED_COLUMNS = ['week', 'phase', 'day_of_week', 'focus', 'exercise_name', 'exercise_id', 'type', 'sets', 'reps']
const VALID_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const VALID_PHASES: ProgramPhase[] = ['Accumulation', 'Intensification', 'Peaking', 'Taper']

interface RawRow {
  week: unknown
  phase: unknown
  day_of_week: unknown
  focus: unknown
  exercise_name: unknown
  exercise_id: unknown
  type: unknown
  sets: unknown
  reps: unknown
  pct?: unknown
  rpe?: unknown
  note?: unknown
}

export interface ImportResult {
  program: StructuredProgram | null
  errors: string[]
}

export async function parseExcelFile(file: File): Promise<ImportResult> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' })

  const errors: string[] = []

  // Read Meta sheet
  const metaSheet = workbook.Sheets['Meta']
  if (!metaSheet) return { program: null, errors: ['ไม่พบ Sheet ชื่อ "Meta"'] }

  const metaData = XLSX.utils.sheet_to_json<string[]>(metaSheet, { header: 1 }) as unknown[][]
  const meta = { name: '', description: '', focus: '', programType: '' }
  for (const row of metaData) {
    const key = String(row[0] ?? '').trim()
    const val = String(row[1] ?? '').trim()
    if (key === 'name') meta.name = val
    if (key === 'description') meta.description = val
    if (key === 'focus') meta.focus = val
    if (key === 'program_type') meta.programType = val.toLowerCase()
  }
  if (!meta.name) errors.push('Sheet "Meta": ต้องมี row ที่มี key "name"')

  // Read Program sheet
  const programSheet = workbook.Sheets['Program']
  if (!programSheet) return { program: null, errors: ['ไม่พบ Sheet ชื่อ "Program"'] }

  const rows = XLSX.utils.sheet_to_json<RawRow>(programSheet)
  if (rows.length === 0) return { program: null, errors: ['Sheet "Program" ว่างเปล่า'] }

  // Validate required columns
  const firstRow = rows[0]
  const missingCols = REQUIRED_COLUMNS.filter(col => !(col in firstRow))
  if (missingCols.length > 0) {
    return { program: null, errors: missingCols.map(c => `ไม่พบ column: "${c}"`) }
  }

  // Validate and group rows by week → day
  const weekMap = new Map<number, Map<string, StructuredExercise[]>>()
  const weekPhase = new Map<number, ProgramPhase>()
  const dayFocusMap = new Map<string, string>() // `week-day_key` → focus

  rows.forEach((row, idx) => {
    const rowNum = idx + 2
    const week = Number(row.week)
    if (!Number.isInteger(week) || week < 1) {
      errors.push(`Row ${rowNum}: "week" ต้องเป็นตัวเลขจำนวนเต็ม มากกว่า 0`)
      return
    }

    const dayOfWeek = String(row.day_of_week ?? '').trim()
    if (!VALID_DAYS.includes(dayOfWeek)) {
      errors.push(`Row ${rowNum}: "day_of_week" ต้องเป็น ${VALID_DAYS.join('/')} (ได้รับ: "${dayOfWeek}")`)
      return
    }

    const type = String(row.type ?? '').trim()
    if (!['main', 'accessory'].includes(type)) {
      errors.push(`Row ${rowNum}: "type" ต้องเป็น "main" หรือ "accessory" (ได้รับ: "${type}")`)
      return
    }

    const exerciseId = String(row.exercise_id ?? '').trim().toLowerCase().replace(/\s+/g, '_')
    const exerciseName = String(row.exercise_name ?? '').trim()
    if (!exerciseId || !exerciseName) {
      errors.push(`Row ${rowNum}: "exercise_id" และ "exercise_name" ต้องไม่ว่างเปล่า`)
      return
    }

    const sets = Number(row.sets)
    if (!sets || sets < 1) {
      errors.push(`Row ${rowNum}: "sets" ต้องเป็นตัวเลขมากกว่า 0`)
      return
    }

    const repsRaw = row.reps
    const reps: number | string = repsRaw === 'AMRAP' || repsRaw === 'amrap'
      ? 'AMRAP'
      : Number(repsRaw) || 1

    const pct = row.pct !== undefined && row.pct !== '' ? Number(row.pct) || undefined : undefined
    const rpe = row.rpe !== undefined && row.rpe !== '' ? Number(row.rpe) || undefined : undefined
    const note = row.note ? String(row.note).trim() : undefined

    const phase = VALID_PHASES.includes(String(row.phase ?? '') as ProgramPhase)
      ? (String(row.phase) as ProgramPhase)
      : 'Accumulation'

    if (!weekPhase.has(week)) weekPhase.set(week, phase)

    if (!weekMap.has(week)) weekMap.set(week, new Map())
    const dayMap = weekMap.get(week)!

    // Use dayOfWeek as day key (one day per day-of-week per week)
    if (!dayMap.has(dayOfWeek)) dayMap.set(dayOfWeek, [])
    dayMap.get(dayOfWeek)!.push({
      exerciseId,
      name: exerciseName,
      type: type as 'main' | 'accessory',
      sets,
      reps,
      pct,
      rpe,
      note,
    })

    // Track focus per day (use focus from first row for that day)
    const focusKey = `${week}-${dayOfWeek}`
    if (!dayFocusMap.has(focusKey)) {
      dayFocusMap.set(focusKey, String(row.focus ?? '').trim() || dayOfWeek)
    }
  })

  if (errors.length > 0) return { program: null, errors }

  // Build StructuredProgram
  const sortedWeekNums = Array.from(weekMap.keys()).sort((a, b) => a - b)
  const weeks: StructuredWeek[] = sortedWeekNums.map((weekNum) => {
    const dayMap = weekMap.get(weekNum)!
    const sortedDays = Array.from(dayMap.keys()).sort((a, b) => VALID_DAYS.indexOf(a) - VALID_DAYS.indexOf(b))

    const days: StructuredDay[] = sortedDays.map((dayOfWeek, dIdx) => ({
      id: `day-${dIdx + 1}`,
      dayOfWeek: dayOfWeek as StructuredDay['dayOfWeek'],
      focus: dayFocusMap.get(`${weekNum}-${dayOfWeek}`) ?? dayOfWeek,
      exercises: dayMap.get(dayOfWeek)!,
    }))

    return {
      id: `week-${weekNum}`,
      weekNumber: weekNum,
      phase: weekPhase.get(weekNum) ?? 'Accumulation',
      days,
    }
  })

  const maxDaysPerWeek = Math.max(...weeks.map(w => w.days.length))

  const program: StructuredProgram = {
    id: `custom-${Date.now()}`,
    name: meta.name,
    description: meta.description || `Custom program — ${meta.name}`,
    totalWeeks: sortedWeekNums.length,
    daysPerWeek: maxDaysPerWeek,
    focus: meta.focus || 'Custom',
    weeks,
    isCustom: true,
    source: 'excel',
    // Optional Meta key; default powerlifting (back-compat with older templates)
    programType: meta.programType === 'general' ? 'general' : 'powerlifting',
  }

  return { program, errors: [] }
}
