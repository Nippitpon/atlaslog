import { describe, it, expect } from 'vitest'
import type { OneRMEntry } from '@atlaslog/shared'
import { buildTotalSeries, firstOneRMs, latestOneRMs } from './oneRM.js'

const e = (lift: OneRMEntry['lift'], date: string, weightKg: number): OneRMEntry =>
  ({ id: `${lift}-${date}`, lift, date, weightKg })

describe('firstOneRMs', () => {
  const fallback = { squat: 200, bench: 130, deadlift: 250 }

  it('takes the oldest entry per lift regardless of insertion order', () => {
    const entries = [e('squat', '2026-03-01', 190), e('squat', '2026-01-01', 170), e('bench', '2026-02-01', 120)]
    expect(firstOneRMs(entries, fallback)).toEqual({ squat: 170, bench: 120, deadlift: 250 })
    expect(latestOneRMs(entries, fallback)).toEqual({ squat: 190, bench: 120, deadlift: 250 })
  })

  it('falls back to the live 1RM when a lift has no history', () => {
    expect(firstOneRMs([], fallback)).toEqual(fallback)
  })
})

describe('buildTotalSeries', () => {
  const fallback = { squat: 200, bench: 130, deadlift: 250 }

  it('starts at the baseline total and steps as each lift is retested', () => {
    const entries = [
      e('squat', '2026-01-01', 180), e('bench', '2026-01-01', 120), e('deadlift', '2026-01-01', 220),
      e('squat', '2026-03-01', 190),
      e('deadlift', '2026-02-01', 230),
    ]
    expect(buildTotalSeries(entries, fallback).map(p => [p.date, p.value])).toEqual([
      ['2026-01-01', 520], ['2026-02-01', 530], ['2026-03-01', 540],
    ])
  })

  it('counts an untested lift at its later first value, not the live fallback', () => {
    const entries = [e('squat', '2026-01-01', 180), e('bench', '2026-02-01', 120)]
    expect(buildTotalSeries(entries, fallback).map(p => p.value)).toEqual([550, 550])
  })

  it('merges same-day entries into one point and carries the day note and delta', () => {
    const entries = [
      e('squat', '2026-01-01T03:00:00.000Z', 180), e('bench', '2026-01-01T03:00:00.000Z', 120),
      e('deadlift', '2026-01-01T03:00:00.000Z', 220),
      { ...e('squat', '2026-02-01T03:00:00.000Z', 190), note: 'meet day' },
      e('bench', '2026-02-01T03:05:00.000Z', 125),
    ]
    const series = buildTotalSeries(entries, fallback)
    expect(series.map(p => [p.value, p.delta, p.note, p.entryIds.length])).toEqual([
      [520, 0, undefined, 3], [535, 15, 'meet day', 2],
    ])
  })
})
