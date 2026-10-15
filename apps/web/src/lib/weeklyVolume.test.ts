import { describe, it, expect, vi, afterEach } from 'vitest'
import type { RunEntry, Session } from '@atlaslog/shared'
import { weeklyVolume } from './utils.js'

// Wednesday 2026-10-14, local time. Week = Sun 11 → Sat 17.
const NOW = new Date(2026, 9, 14, 9, 0)

function run(date: Date, distanceKm: number): RunEntry {
  return { id: `r${date.getTime()}`, date: date.toISOString(), distanceKm, durationMin: 30 }
}

function session(date: Date, volume: number): Session {
  return { id: `s${date.getTime()}`, date: date.toISOString(), volume } as Session
}

describe('weeklyVolume runKm', () => {
  afterEach(() => { vi.useRealTimers() })

  it('sums runs onto their own day, separately from lift volume', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    const week = weeklyVolume(
      [session(new Date(2026, 9, 13, 18, 0), 5000)],
      [run(new Date(2026, 9, 13, 12, 0), 5), run(new Date(2026, 9, 13, 19, 0), 2.5)],
    )
    const tue = week[2]!
    expect(tue.volume).toBe(5000)
    expect(tue.runKm).toBe(7.5)
    expect(week.filter(d => d.runKm > 0)).toHaveLength(1)
  })

  it('keeps an evening run on the same local day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    const week = weeklyVolume([], [run(new Date(2026, 9, 12, 23, 30), 3)])
    expect(week[1]!.runKm).toBe(3)
  })

  it('ignores runs outside the current week and defaults to 0', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    const week = weeklyVolume([], [run(new Date(2026, 9, 10, 12, 0), 10)])
    expect(week.every(d => d.runKm === 0)).toBe(true)
    expect(weeklyVolume([]).every(d => d.runKm === 0)).toBe(true)
  })
})
