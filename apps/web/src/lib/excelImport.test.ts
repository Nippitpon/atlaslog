import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { parseExcelFile } from './excelImport.js'

// parseExcelFile only ever takes a File, so every case has to travel through a
// real workbook. The binary fixture covers the shape a coach actually sends;
// synthetic sheets keep the edge cases readable instead of adding more binaries.
function makeXlsx(sheets: Record<string, unknown[][]>, fileName = 'test.xlsx'): File {
  const wb = XLSX.utils.book_new()
  for (const [name, aoa] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name)
  }
  return new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], fileName)
}

const HEAD = ['Week', 'Phase', 'Day', 'Lift', 'Variant', 'Prescription', 'Sets', 'Reps', 'PCT', 'RPE', 'Type', 'Notes']

// One valid row, with per-case overrides spread over it.
function row(o: Record<string, unknown> = {}): unknown[] {
  const cells: Record<string, unknown> = {
    Week: 1, Phase: 'Accumulation', Day: 'Mon', Lift: 'Squat', Variant: '', Prescription: '',
    Sets: 3, Reps: 5, PCT: 0.7, RPE: 7, Type: 'Work', Notes: '', ...o,
  }
  return HEAD.map(h => cells[h])
}

const template = (rows: unknown[][], fileName?: string) =>
  makeXlsx({ Template: [HEAD, ...rows] }, fileName)

// ─── The real workbook ────────────────────────────────────────────────────────

describe('parseExcelFile — the workbook a coach actually sends', () => {
  // The file on disk is renamed, but File.name is what drives the program name,
  // so the original name is what gets handed in.
  const fixture = () => parseExcelFile(new File(
    [readFileSync(new URL('../test/fixtures/hybrid-program.xlsx', import.meta.url))],
    'Hybrid_Powerlifting-Template.xlsx',
  ))

  it('parses the whole 12-week program without complaint', async () => {
    const { program, errors } = await fixture()
    expect(errors).toEqual([])
    expect(program).toBeTruthy()
    expect(program!.totalWeeks).toBe(12)
    expect(program!.weeks).toHaveLength(12)
    expect(program!.daysPerWeek).toBe(4)
    const exercises = program!.weeks.flatMap(w => w.days.flatMap(d => d.exercises))
    expect(exercises).toHaveLength(99)
  })

  it('maps every phase the sheet uses', async () => {
    const { program } = await fixture()
    expect([...new Set(program!.weeks.map(w => w.phase))])
      .toEqual(['Accumulation', 'Intensification', 'Peaking', 'Taper'])
  })

  it('derives the program name from the file name', async () => {
    const { program } = await fixture()
    expect(program!.name).toBe('Hybrid Powerlifting Template')
    expect(program!.id).toMatch(/^custom-\d+$/)
    expect(program!.source).toBe('excel')
    expect(program!.isCustom).toBe(true)
    // No Meta sheet, so it falls back to a powerlifting program (1RM-driven).
    expect(program!.programType).toBe('powerlifting')
  })

  it('joins Variant and Prescription into the display label', async () => {
    const { program } = await fixture()
    const first = program!.weeks[0].days[0].exercises[0]
    expect(first.label).toBe('Competition · Top set')
    expect(first.exerciseId).toBe('squat')
    expect(first.name).toBe('Squat')
  })

  it('keeps the Thai coaching notes intact', async () => {
    const { program } = await fixture()
    const notes = program!.weeks[0].days[0].exercises.map(e => e.note)
    expect(notes[0]).toContain('คุมจังหวะ')
  })

  // The reason StructuredExercise carries an id at all: the week view keys
  // weight overrides by it, so a top set and its back-off must not share one.
  it('gives same-lift rows distinct ids', async () => {
    const { program } = await fixture()
    const monday = program!.weeks[0].days.find(d => d.dayOfWeek === 'Mon')!
    const squats = monday.exercises.filter(e => e.exerciseId === 'squat')
    expect(squats.length).toBeGreaterThan(1)
    expect(squats[0].id).toBe('w1-Mon-e0')
    expect(squats[1].id).toBe('w1-Mon-e1')

    for (const week of program!.weeks) {
      for (const day of week.days) {
        const ids = day.exercises.map(e => e.id)
        expect(new Set(ids).size).toBe(ids.length)
      }
    }
  })

  // The fixture has a "Target Weight (kg)" column. It is deliberately absent
  // from HEADER_ALIASES: weights are recomputed from the user's own 1RM, never
  // read off the sheet, or a shared program would carry the coach's numbers.
  it('ignores the pre-computed Target Weight column', async () => {
    const { program } = await fixture()
    const exercises = program!.weeks.flatMap(w => w.days.flatMap(d => d.exercises))
    const weightish = exercises.flatMap(e => Object.keys(e)).filter(k => /weight/i.test(k))
    expect(weightish).toEqual([])
    expect(exercises.every(e => e.pct === undefined || (e.pct > 0 && e.pct <= 1.1))).toBe(true)
  })
})

// ─── Validation ───────────────────────────────────────────────────────────────

describe('parseExcelFile — rejecting a broken sheet', () => {
  const expectRejected = async (rows: unknown[][], match: RegExp) => {
    const { program, errors } = await parseExcelFile(template(rows))
    expect(program).toBeNull()
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(match)
    return errors[0]
  }

  it('names the spreadsheet row, counting the header as row 1', async () => {
    const err = await expectRejected([row({ Week: 'x' })], /Week/)
    expect(err).toMatch(/^Row 2:/)
  })

  it('rejects a non-integer or zero week', async () => {
    await expectRejected([row({ Week: 0 })], /^Row 2:.*Week/)
    await expectRejected([row({ Week: 1.5 })], /^Row 2:.*Week/)
  })

  it('rejects a day it cannot place', async () => {
    const err = await expectRejected([row({ Day: 'Someday' })], /Day/)
    expect(err).toContain('Someday')
  })

  it('rejects a row with no exercise at all', async () => {
    await expectRejected([row({ Lift: '' })], /Lift.*exercise_id|exercise_id/)
  })

  it('rejects sets outside 1–50', async () => {
    await expectRejected([row({ Sets: 0 })], /Sets/)
    await expectRejected([row({ Sets: 51 })], /Sets/)
    await expectRejected([row({ Sets: 2.5 })], /Sets/)
  })

  it('rejects reps that are neither a positive integer nor AMRAP', async () => {
    await expectRejected([row({ Reps: 0 })], /Reps/)
    await expectRejected([row({ Reps: 'as many' })], /Reps/)
  })

  // Attempts can exceed 100% of a training max, so the ceiling is 1.1, not 1.
  it('accepts pct up to 1.1 and rejects above it', async () => {
    const ok = await parseExcelFile(template([row({ PCT: 1.1 })]))
    expect(ok.errors).toEqual([])
    expect(ok.program!.weeks[0].days[0].exercises[0].pct).toBe(1.1)

    await expectRejected([row({ PCT: 1.11 })], /PCT/)
    await expectRejected([row({ PCT: 0 })], /PCT/)
  })

  // One bad row fails the whole import, but the loop still collects every row's
  // complaint first — the user should see all of them, not just the first.
  it('reports every bad row, not only the first', async () => {
    const { program, errors } = await parseExcelFile(template([
      row({ Week: 'x' }),
      row({ Day: 'Funday' }),
      row({ Sets: 99 }),
    ]))
    expect(program).toBeNull()
    expect(errors).toHaveLength(3)
    expect(errors.map(e => e.split(':')[0])).toEqual(['Row 2', 'Row 3', 'Row 4'])
  })

  it('rejects a workbook with no recognisable table', async () => {
    const { program, errors } = await parseExcelFile(makeXlsx({ Sheet1: [['hello'], ['world']] }))
    expect(program).toBeNull()
    expect(errors[0]).toContain('ไม่พบตารางโปรแกรม')
  })
})

// ─── Column and value vocabularies ────────────────────────────────────────────

describe('parseExcelFile — what it will accept', () => {
  it('takes AMRAP in any case', async () => {
    const { program, errors } = await parseExcelFile(template([row({ Reps: 'amrap' })]))
    expect(errors).toEqual([])
    expect(program!.weeks[0].days[0].exercises[0].reps).toBe('AMRAP')
  })

  it('takes full and Thai day names', async () => {
    const { program, errors } = await parseExcelFile(template([
      row({ Day: 'Monday' }),
      row({ Day: 'จันทร์' }),
      row({ Day: 'พฤหัสบดี' }),
    ]))
    expect(errors).toEqual([])
    expect(program!.weeks[0].days.map(d => d.dayOfWeek)).toEqual(['Mon', 'Thu'])
    expect(program!.weeks[0].days[0].exercises).toHaveLength(2)
  })

  // "%1RM" is the header the original coach workbook uses. normHeader strips it
  // to "1rm", which HEADER_ALIASES maps onto pct.
  it('accepts %1RM as the percentage column', async () => {
    const head = ['Week', 'Day', 'Lift', 'Sets', 'Reps', '%1RM']
    const { program, errors } = await parseExcelFile(
      makeXlsx({ Template: [head, [1, 'Mon', 'Squat', 3, 5, 0.8]] }),
    )
    expect(errors).toEqual([])
    expect(program!.weeks[0].days[0].exercises[0].pct).toBe(0.8)
  })

  it('maps lift spellings onto the ids the 1RM calc uses', async () => {
    const { program } = await parseExcelFile(template([
      row({ Lift: 'Back Squat' }),
      row({ Lift: 'Bench Press', Day: 'Tue' }),
      row({ Lift: 'Sumo Deadlift', Day: 'Wed' }),
    ]))
    const ids = program!.weeks[0].days.flatMap(d => d.exercises.map(e => e.exerciseId))
    expect(ids).toEqual(['squat', 'bench', 'deadlift'])
  })

  it('folds Taper/Test into Taper', async () => {
    const { program } = await parseExcelFile(template([row({ Phase: 'Taper/Test' })]))
    expect(program!.weeks[0].phase).toBe('Taper')
  })

  // A coach writing "<6.0" means something real; losing it would be worse than
  // keeping it as prose, and it must not fail the import either.
  it('keeps an unparseable RPE as a note', async () => {
    const { program, errors } = await parseExcelFile(template([row({ RPE: '<6.0' })]))
    expect(errors).toEqual([])
    const ex = program!.weeks[0].days[0].exercises[0]
    expect(ex.rpe).toBeUndefined()
    expect(ex.note).toBe('RPE <6.0')
  })

  it('skips blank rows instead of complaining about them', async () => {
    const { program, errors } = await parseExcelFile(template([row(), [], row({ Day: 'Tue' })]))
    expect(errors).toEqual([])
    expect(program!.weeks[0].days).toHaveLength(2)
  })

  it('reads Meta over the file name, including the program type', async () => {
    const { program, errors } = await parseExcelFile(makeXlsx({
      Meta: [['name', 'Coach Block'], ['description', 'Off-season'], ['program_type', 'general']],
      Program: [['week', 'day_of_week', 'exercise_id', 'exercise_name', 'sets', 'reps'],
        [1, 'Mon', 'plank', 'Plank', 3, 30]],
    }, 'ignored-name.xlsx'))
    expect(errors).toEqual([])
    expect(program!.name).toBe('Coach Block')
    expect(program!.description).toBe('Off-season')
    expect(program!.programType).toBe('general')
    expect(program!.weeks[0].days[0].exercises[0].exerciseId).toBe('plank')
  })

  it('prefers the Program sheet when a workbook holds both', async () => {
    const { program } = await parseExcelFile(makeXlsx({
      Template: [HEAD, row({ Lift: 'Bench' })],
      Program: [HEAD, row({ Lift: 'Deadlift' })],
    }))
    expect(program!.weeks[0].days[0].exercises[0].exerciseId).toBe('deadlift')
  })
})

// ─── Observed behaviour worth knowing about ───────────────────────────────────

describe('parseExcelFile — gappy week numbers', () => {
  // NOT asserted as correct: totalWeeks is the COUNT of weeks that carry rows,
  // not the highest week number, and a gap passes without a word. A sheet
  // numbered 1, 2, 5 therefore reports 3 weeks whose last weekNumber is 5, so
  // anything iterating 1..totalWeeks or reading it as "the final week" is off.
  // Recorded here so a change in either direction is a deliberate one.
  it('counts weeks with rows rather than the last week number', async () => {
    const { program, errors } = await parseExcelFile(template([
      row({ Week: 1 }),
      row({ Week: 2 }),
      row({ Week: 5 }),
    ]))
    expect(errors).toEqual([])
    expect(program!.totalWeeks).toBe(3)
    expect(program!.weeks.map(w => w.weekNumber)).toEqual([1, 2, 5])
    expect(program!.weeks.at(-1)!.id).toBe('week-5')
  })
})
