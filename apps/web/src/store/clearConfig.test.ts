import { describe, it, expect, beforeEach } from 'vitest'
import { useProgramStore } from './useProgramStore.js'
import { getProgramStatus } from '../lib/programStatus.js'
import { makeMultiWeekProgram, MULTI_PROGRAM_ID } from '../test/fixtures.js'

const ps = () => useProgramStore.getState()
const program = makeMultiWeekProgram()

beforeEach(() => {
  useProgramStore.setState({ progress: {}, configs: {}, customAccessories: {}, programMeta: {} })
})

describe('clearConfig', () => {
  it('returns a started program to not_setup and unpauses it', () => {
    ps().setConfig(MULTI_PROGRAM_ID, {
      startDate: '2026-01-05', endDate: '2099-01-01', oneRMs: { squat: 100, bench: 80, deadlift: 120 },
    })
    ps().setProgramPaused(MULTI_PROGRAM_ID, true)
    ps().clearConfig(MULTI_PROGRAM_ID)

    expect(ps().getConfig(MULTI_PROGRAM_ID)).toBeNull()
    expect(ps().programMeta[MULTI_PROGRAM_ID]?.paused).toBe(false)
    const status = getProgramStatus(
      program, ps().configs[MULTI_PROGRAM_ID], ps().programMeta[MULTI_PROGRAM_ID], ps().progress,
    )
    expect(status).toBe('not_setup')
  })

  it('keeps day progress', () => {
    ps().setDayStatus(MULTI_PROGRAM_ID, 'w1', 'w1-mon', 'done')
    ps().clearConfig(MULTI_PROGRAM_ID)
    expect(ps().getDayStatus(MULTI_PROGRAM_ID, 'w1', 'w1-mon')).toBe('done')
  })
})
