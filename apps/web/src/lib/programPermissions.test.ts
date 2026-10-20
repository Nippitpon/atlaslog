import { describe, expect, it } from 'vitest'
import { canEditProgram } from './programPermissions.js'

const ADMIN = { isAdmin: true, isCoach: false }
const COACH = { isAdmin: false, isCoach: true }
const ATHLETE = { isAdmin: false, isCoach: false }

describe('canEditProgram', () => {
  it('built-in program: admin only', () => {
    expect(canEditProgram(false, ADMIN)).toBe(true)
    expect(canEditProgram(false, COACH)).toBe(false)
    expect(canEditProgram(false, ATHLETE)).toBe(false)
  })

  it('custom program: admin and coach, not athlete', () => {
    expect(canEditProgram(true, ADMIN)).toBe(true)
    expect(canEditProgram(true, COACH)).toBe(true)
    expect(canEditProgram(true, ATHLETE)).toBe(false)
  })
})
