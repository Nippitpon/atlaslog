import { describe, it, expect } from 'vitest'
import type {
  DayStatus, ProgramConfig, ProgramProgressState, RunEntry, Session, StructuredDay, StructuredProgram,
} from '@atlaslog/shared'
import {
  buildScheduleMap, buildTrainedMap, dotFor, monthGrid, monthLabel, monthSummary,
  dataBounds, dayCell, dayVolume, heatBackground, monthMaxVolume, shiftMonth, weekStreak,
} from './historyCalendar.js'
import { ymdOfISO } from './utils.js'

const PID = 'cal-test'

// One day per week so a week number maps to exactly one calendar date.
function makeProgram(
  weekNumbers: number[],
  dayOfWeek: StructuredDay['dayOfWeek'] = 'Mon',
  overrides: Partial<StructuredProgram> = {},
): StructuredProgram {
  return {
    id: PID, name: 'cal', description: '', totalWeeks: weekNumbers.length, daysPerWeek: 1, focus: '',
    weeks: weekNumbers.map(n => ({
      id: `w${n}`, weekNumber: n, phase: 'Accumulation' as const,
      days: [{ id: 'd1', dayOfWeek, focus: 'Squat', exercises: [] }],
    })),
    ...overrides,
  }
}

const configFor = (startDate: string): { [id: string]: ProgramConfig } =>
  ({ [PID]: { startDate, endDate: '', oneRMs: { squat: 100, bench: 80, deadlift: 120 } } })

const progressFor = (weeks: Record<string, Record<string, DayStatus>>): ProgramProgressState =>
  ({ [PID]: weeks })

// Local noon, so the ISO timestamp lands on the intended calendar day in any
// timezone the test runner happens to be in (vitest does not pin TZ).
const isoAt = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString()

const session = (date: string, volume = 1000): Session =>
  ({ id: `s-${date}`, programId: PID, name: 'Squat Day', date, duration: 60, volume, setCount: 10 })

const run = (date: string): RunEntry =>
  ({ id: `r-${date}`, date, distanceKm: 5, durationMin: 30 })

describe('ymdOfISO', () => {
  // The bug this guards: iso.slice(0, 10) reads the UTC date, so a session
  // finished late in the evening in UTC+7 gets filed under the previous day.
  // Asserting through a local Date makes it hold east AND west of UTC: at 23:00
  // the UTC date has already rolled forward east of UTC, and at 00:00 it is still
  // on the previous day west of UTC — one of the two catches any slice() regression.
  it('buckets a late-evening local timestamp on the local day', () => {
    expect(ymdOfISO(isoAt(2026, 9, 12, 23))).toBe('2026-09-12')
  })

  it('buckets a midnight local timestamp on the local day', () => {
    expect(ymdOfISO(isoAt(2026, 9, 12, 0))).toBe('2026-09-12')
  })

  it('reads the local calendar day, not the UTC one', () => {
    expect(ymdOfISO(new Date(2026, 8, 12, 23, 30).toISOString())).toBe('2026-09-12')
    expect(ymdOfISO(new Date(2026, 8, 12, 0, 30).toISOString())).toBe('2026-09-12')
  })
})

describe('monthGrid', () => {
  // Sep 2026 starts on a Tuesday → exactly one leading blank in a Mon-first grid.
  it('is Monday-first', () => {
    const cells = monthGrid(2026, 8)
    expect(cells[0]).toBeNull()
    expect(cells[1]).toBe('2026-09-01')
    expect(cells[7]).toBe('2026-09-07')
  })

  // Nov 2026 starts on a Sunday — the worst case for a Mon-first grid.
  it('gives a Sunday-start month six leading blanks', () => {
    const cells = monthGrid(2026, 10)
    expect(cells.slice(0, 6)).toEqual([null, null, null, null, null, null])
    expect(cells[6]).toBe('2026-11-01')
    expect(cells).toHaveLength(42)
  })

  it('pads only to a whole week, never a fixed 42', () => {
    expect(monthGrid(2026, 8)).toHaveLength(35)
    expect(monthGrid(2026, 1)).toHaveLength(35)
  })

  it('includes 29 Feb in a leap year', () => {
    const cells = monthGrid(2028, 1)
    expect(cells).toContain('2028-02-29')
    expect(cells).not.toContain('2028-03-01')
  })

  it('holds every day of the month exactly once', () => {
    const dated = monthGrid(2026, 8).filter(Boolean)
    expect(dated).toHaveLength(30)
    expect(new Set(dated).size).toBe(30)
  })
})

describe('dataBounds', () => {
  it('spans the oldest logged day to the furthest planned day', () => {
    const schedule = buildScheduleMap([makeProgram([1, 12])], configFor('2026-09-07'), {})
    const trained = buildTrainedMap([session(isoAt(2026, 6, 20))], [])
    expect(dataBounds(schedule, trained, '2026-09-14')).toEqual({
      first: '2026-06-20',
      last: '2026-11-23',
    })
  })

  // The current month has to stay reachable before anything exists.
  it('falls back to today when there is no data at all', () => {
    expect(dataBounds(new Map(), new Map(), '2026-09-14')).toEqual({
      first: '2026-09-14',
      last: '2026-09-14',
    })
  })

  it('never excludes today from the range', () => {
    const trained = buildTrainedMap([session(isoAt(2026, 6, 20))], [])
    expect(dataBounds(new Map(), trained, '2026-09-14').last).toBe('2026-09-14')
  })
})

describe('shiftMonth / monthLabel', () => {
  it('rolls over the year boundary in both directions', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 })
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 })
  })

  it('labels a month the way the list headers do', () => {
    expect(monthLabel(2026, 8)).toBe('SEPTEMBER 2026')
  })
})

describe('buildScheduleMap', () => {
  it('places a program day on its calendar date', () => {
    const map = buildScheduleMap([makeProgram([1, 2])], configFor('2026-09-07'), {})
    expect(map.get('2026-09-07')?.[0]?.day.id).toBe('d1')
    expect(map.get('2026-09-14')?.[0]?.weekNum).toBe(2)
  })

  // dayDate counts 7-day blocks from startDate and walks FORWARD to the weekday,
  // so a Wednesday start puts week 1's Monday five days in.
  it('handles a start date that is not a Monday', () => {
    const map = buildScheduleMap([makeProgram([1])], configFor('2026-09-09'), {})
    expect(map.has('2026-09-14')).toBe(true)
    expect(map.has('2026-09-07')).toBe(false)
  })

  // Guards the open totalWeeks finding: a gappy import (1, 2, 5) reports
  // totalWeeks 3, so counting array positions would pull week 5 three weeks early.
  it('dates a gappy week by its weekNumber, not its position', () => {
    const map = buildScheduleMap([makeProgram([1, 2, 5])], configFor('2026-09-07'), {})
    expect(map.has('2026-10-05')).toBe(true)
    expect(map.has('2026-09-21')).toBe(false)
  })

  it('carries the stored day status, defaulting to not_started', () => {
    const map = buildScheduleMap(
      [makeProgram([1, 2])],
      configFor('2026-09-07'),
      progressFor({ w1: { d1: 'done' } }),
    )
    expect(map.get('2026-09-07')?.[0]?.status).toBe('done')
    expect(map.get('2026-09-14')?.[0]?.status).toBe('not_started')
  })

  it('skips weekly routines, which have no start date', () => {
    const map = buildScheduleMap([makeProgram([1], 'Mon', { weekly: true })], configFor('2026-09-07'), {})
    expect(map.size).toBe(0)
  })

  it('skips a program with no config', () => {
    expect(buildScheduleMap([makeProgram([1])], {}, {}).size).toBe(0)
  })

  it('stamps a dayRef matching the composite finishWorkout parses', () => {
    const map = buildScheduleMap([makeProgram([1])], configFor('2026-09-07'), {})
    expect(map.get('2026-09-07')?.[0]?.ref).toBe(`${PID}/w1/d1`)
  })
})

describe('buildTrainedMap', () => {
  it('buckets sessions and runs by the day they really happened', () => {
    const map = buildTrainedMap([session(isoAt(2026, 9, 7))], [run(isoAt(2026, 9, 8))])
    expect(map.get('2026-09-07')?.[0]?.kind).toBe('session')
    expect(map.get('2026-09-08')?.[0]?.kind).toBe('run')
  })

  it('keeps both entries when a day has a lift and a run', () => {
    const map = buildTrainedMap([session(isoAt(2026, 9, 7, 9))], [run(isoAt(2026, 9, 7, 18))])
    expect(map.get('2026-09-07')).toHaveLength(2)
  })

  // addRun only prepends, so a backdated run leaves `runs` out of date order.
  it('sorts each day newest-first regardless of input order', () => {
    const map = buildTrainedMap(
      [session(isoAt(2026, 9, 7, 8), 1), session(isoAt(2026, 9, 7, 20), 2)],
      [],
    )
    const day = map.get('2026-09-07')!
    expect(day[0]!.date.localeCompare(day[1]!.date)).toBeGreaterThan(0)
  })
})

describe('dotFor', () => {
  const TODAY = '2026-09-14'
  const schedule = buildScheduleMap([makeProgram([1, 2, 3])], configFor('2026-09-07'), {})
  const empty = new Map()

  it('marks a day with logged training as trained', () => {
    const trained = buildTrainedMap([session(isoAt(2026, 9, 7))], [])
    expect(dotFor('2026-09-07', schedule, trained, TODAY)).toBe('trained')
  })

  it('marks an untrained scheduled day that is today', () => {
    expect(dotFor('2026-09-14', schedule, empty, TODAY)).toBe('today')
  })

  it('marks a future scheduled day as planned', () => {
    expect(dotFor('2026-09-21', schedule, empty, TODAY)).toBe('planned')
  })

  it('marks a past unsettled scheduled day as missed', () => {
    expect(dotFor('2026-09-07', schedule, empty, TODAY)).toBe('missed')
  })

  it('treats an in_progress past day as missed — it is not settled', () => {
    const s = buildScheduleMap(
      [makeProgram([1])], configFor('2026-09-07'), progressFor({ w1: { d1: 'in_progress' } }),
    )
    expect(dotFor('2026-09-07', s, empty, TODAY)).toBe('missed')
  })

  it('marks a deliberately skipped day as settled', () => {
    const s = buildScheduleMap(
      [makeProgram([1])], configFor('2026-09-07'), progressFor({ w1: { d1: 'skipped' } }),
    )
    expect(dotFor('2026-09-07', s, empty, TODAY)).toBe('settled')
  })

  // finishWorkout marks the PLANNED day done but stamps the session with the real
  // date, so the two can be different days. The plan slot must not read as missed.
  it('settles the planned day when the session landed on another date', () => {
    const s = buildScheduleMap(
      [makeProgram([1])], configFor('2026-09-07'), progressFor({ w1: { d1: 'done' } }),
    )
    const trained = buildTrainedMap([session(isoAt(2026, 9, 9))], [])
    expect(dotFor('2026-09-07', s, trained, TODAY)).toBe('settled')
    expect(dotFor('2026-09-09', s, trained, TODAY)).toBe('trained')
  })

  it('returns null for a day with nothing planned and nothing logged', () => {
    expect(dotFor('2026-09-08', schedule, empty, TODAY)).toBeNull()
  })
})

describe('monthSummary', () => {
  const schedule = buildScheduleMap([makeProgram([1, 2, 3, 4])], configFor('2026-09-07'), {})

  // Scheduled: Sep 7, 14, 21, 28. With today on the 14th, only Sep 7 is settled
  // business — the 14th is still trainable and the rest are future.
  it('leaves future scheduled days out of the adherence ratio', () => {
    const s = monthSummary(2026, 8, schedule, new Map(), '2026-09-14')
    expect(s.dueDays).toBe(1)
    expect(s.doneDays).toBe(0)
    expect(s.missedDays).toBe(1)
    expect(s.adherencePct).toBe(0)
  })

  // Today on the 21st, so Sep 7 (done) and Sep 14 (untouched) have both gone by.
  it('counts a done day towards adherence', () => {
    const done = buildScheduleMap(
      [makeProgram([1, 2, 3, 4])], configFor('2026-09-07'), progressFor({ w1: { d1: 'done' } }),
    )
    const s = monthSummary(2026, 8, done, new Map(), '2026-09-21')
    expect(s.dueDays).toBe(2)
    expect(s.doneDays).toBe(1)
    expect(s.missedDays).toBe(1)
    expect(s.adherencePct).toBe(50)
  })

  // A skipped day closes the plan without pretending the training happened, the
  // same way programProgress keeps skipped out of pct.
  it('counts a skipped day as neither done nor missed', () => {
    const skipped = buildScheduleMap(
      [makeProgram([1, 2, 3, 4])], configFor('2026-09-07'), progressFor({ w1: { d1: 'skipped' } }),
    )
    const s = monthSummary(2026, 8, skipped, new Map(), '2026-09-21')
    expect(s.dueDays).toBe(2)
    expect(s.doneDays).toBe(0)
    expect(s.missedDays).toBe(1)
  })

  it('totals volume and entry counts for the month only', () => {
    const trained = buildTrainedMap(
      [session(isoAt(2026, 9, 7), 5000), session(isoAt(2026, 10, 5), 9000)],
      [run(isoAt(2026, 9, 8))],
    )
    const s = monthSummary(2026, 8, schedule, trained, '2026-09-30')
    expect(s.volumeKg).toBe(5000)
    expect(s.sessionCount).toBe(1)
    expect(s.runCount).toBe(1)
    expect(s.trainedDays).toBe(2)
  })

  // Regression: the strip said "พลาด 3 วัน" while the calendar drew only 2 red
  // dots, because today was counted as missed the moment it came due.
  it('does not count today as missed — there is still time to train it', () => {
    const s = monthSummary(2026, 8, schedule, new Map(), '2026-09-07')
    // Sep 7 is scheduled and is today, so it is not in the ratio at all yet.
    expect(s.dueDays).toBe(0)
    expect(s.missedDays).toBe(0)
  })

  it('counts today once it is settled', () => {
    const done = buildScheduleMap(
      [makeProgram([1, 2, 3, 4])], configFor('2026-09-07'), progressFor({ w1: { d1: 'done' } }),
    )
    const s = monthSummary(2026, 8, done, new Map(), '2026-09-07')
    expect(s.dueDays).toBe(1)
    expect(s.doneDays).toBe(1)
    expect(s.adherencePct).toBe(100)
  })

  // The missed count and the red dots are drawn from the same rule, so they have
  // to agree for every day of the month.
  it('agrees with the dots the calendar draws', () => {
    const todayYmd = '2026-09-14'
    const s = monthSummary(2026, 8, schedule, new Map(), todayYmd)
    const reds = monthGrid(2026, 8)
      .filter((ymd): ymd is string => !!ymd)
      .filter(ymd => dotFor(ymd, schedule, new Map(), todayYmd) === 'missed')
    expect(s.missedDays).toBe(reds.length)
  })

  it('reports zero adherence rather than NaN when nothing is scheduled', () => {
    const s = monthSummary(2026, 8, new Map(), new Map(), '2026-09-14')
    expect(s.dueDays).toBe(0)
    expect(s.adherencePct).toBe(0)
  })
})

describe('weekStreak', () => {
  // A Wednesday, so the Mon-start week containing it is Sep 14–20.
  const now = new Date(2026, 8, 16)

  it('counts consecutive Mon-start weeks with training', () => {
    const trained = buildTrainedMap([
      session(isoAt(2026, 9, 15)),
      session(isoAt(2026, 9, 9)),
      session(isoAt(2026, 9, 1)),
    ], [])
    expect(weekStreak(trained, now)).toBe(3)
  })

  it('stops at a week with no training', () => {
    const trained = buildTrainedMap([
      session(isoAt(2026, 9, 15)),
      session(isoAt(2026, 9, 1)),
    ], [])
    expect(weekStreak(trained, now)).toBe(1)
  })

  // The current week is still in progress, so an empty one must not zero a
  // streak the athlete has not actually broken yet.
  it('does not break the streak on an empty current week', () => {
    const trained = buildTrainedMap([
      session(isoAt(2026, 9, 9)),
      session(isoAt(2026, 9, 1)),
    ], [])
    expect(weekStreak(trained, now)).toBe(2)
  })

  it('counts a run as training', () => {
    expect(weekStreak(buildTrainedMap([], [run(isoAt(2026, 9, 15))]), now)).toBe(1)
  })

  it('is zero with no history at all', () => {
    expect(weekStreak(new Map(), now)).toBe(0)
  })
})

describe('run vs lift days', () => {
  const TODAY = '2026-09-14'
  const empty = new Map()

  // A run is training, but it is not the same work as a lifting day, so it must
  // not borrow the green dot and overstate what happened.
  it('gives a run-only day its own dot', () => {
    const trained = buildTrainedMap([], [run(isoAt(2026, 9, 8))])
    expect(dotFor('2026-09-08', empty, trained, TODAY)).toBe('run')
  })

  it('reports a day that lifted AND ran as a lifting day', () => {
    const trained = buildTrainedMap([session(isoAt(2026, 9, 8, 9))], [run(isoAt(2026, 9, 8, 18))])
    expect(dotFor('2026-09-08', empty, trained, TODAY)).toBe('trained')
  })

  it('flags both kinds on the cell so the UI can draw two dots', () => {
    const trained = buildTrainedMap([session(isoAt(2026, 9, 8, 9))], [run(isoAt(2026, 9, 8, 18))])
    const cell = dayCell('2026-09-08', empty, trained, TODAY, new Map(), 5000)
    expect(cell.hasLift).toBe(true)
    expect(cell.hasRun).toBe(true)
  })

  it('leaves a run-only day with no lift flag', () => {
    const trained = buildTrainedMap([], [run(isoAt(2026, 9, 8))])
    const cell = dayCell('2026-09-08', empty, trained, TODAY, new Map(), 0)
    expect(cell.hasLift).toBe(false)
    expect(cell.hasRun).toBe(true)
  })
})

describe('volume heat', () => {
  it('counts lifted volume only — runs carry no kg', () => {
    const trained = buildTrainedMap([session(isoAt(2026, 9, 8), 4000)], [run(isoAt(2026, 9, 8))])
    expect(dayVolume(trained.get('2026-09-08'))).toBe(4000)
    expect(dayVolume(trained.get('2026-09-09'))).toBe(0)
  })

  it('sums two sessions on the same day', () => {
    const trained = buildTrainedMap(
      [session(isoAt(2026, 9, 8, 9), 4000), session(isoAt(2026, 9, 8, 18), 1500)], [])
    expect(dayVolume(trained.get('2026-09-08'))).toBe(5500)
  })

  // Scaled per month so a deload block still shows contrast instead of
  // flattening against a peak week from another month.
  it('takes the heaviest day of that month as the denominator', () => {
    const trained = buildTrainedMap([
      session(isoAt(2026, 9, 8), 4000),
      session(isoAt(2026, 10, 8), 9000),
    ], [])
    expect(monthMaxVolume(2026, 8, trained)).toBe(4000)
    expect(monthMaxVolume(2026, 9, trained)).toBe(9000)
    expect(monthMaxVolume(2026, 7, trained)).toBe(0)
  })

  it('reports heat as a share of the month maximum', () => {
    const trained = buildTrainedMap([session(isoAt(2026, 9, 8), 2500)], [])
    expect(dayCell('2026-09-08', new Map(), trained, '2026-09-14', new Map(), 5000).heat).toBe(0.5)
  })

  it('never divides by zero when the month has no lifting', () => {
    const cell = dayCell('2026-09-08', new Map(), new Map(), '2026-09-14', new Map(), 0)
    expect(cell.heat).toBe(0)
  })

  it('paints nothing for an untrained day and something for a trained one', () => {
    expect(heatBackground(0)).toBe('transparent')
    expect(heatBackground(1)).toContain('rgba(74, 222, 128')
    // Stays well short of opaque so the dot and day number remain legible.
    expect(Number(heatBackground(1).match(/([\d.]+)\)$/)![1])).toBeLessThan(0.35)
  })
})

describe('dayCell PRs', () => {
  it('surfaces the PRs recorded for that day', () => {
    const prs = new Map([['2026-09-08', [{ lift: 'squat' as const, e1rm: 160, sessionId: 'b' }]]])
    const cell = dayCell('2026-09-08', new Map(), new Map(), '2026-09-14', prs, 0)
    expect(cell.prs).toHaveLength(1)
    expect(cell.prs[0]!.lift).toBe('squat')
  })

  it('is an empty list on a day with none', () => {
    expect(dayCell('2026-09-09', new Map(), new Map(), '2026-09-14', new Map(), 0).prs).toEqual([])
  })
})
