import { describe, it, expect } from 'vitest'
import {
  normalizeUsername, validateUsername, isEmailIdentifier, generatePassword, MIN_PASSWORD_LENGTH,
} from './username.js'

describe('validateUsername', () => {
  it('accepts lowercase letters, digits, underscore and dot', () => {
    expect(validateUsername('john_doe.99')).toBeNull()
  })

  it('normalises case and surrounding spaces before checking', () => {
    expect(normalizeUsername('  JohnDoe ')).toBe('johndoe')
    expect(validateUsername('  JohnDoe ')).toBeNull()
  })

  it('rejects empty, too short and too long', () => {
    expect(validateUsername('')).not.toBeNull()
    expect(validateUsername('   ')).not.toBeNull()
    expect(validateUsername('ab')).not.toBeNull()
    expect(validateUsername('a'.repeat(21))).not.toBeNull()
    expect(validateUsername('a'.repeat(20))).toBeNull()
    expect(validateUsername('abc')).toBeNull()
  })

  it('rejects @ so a username can never be mistaken for an email', () => {
    expect(validateUsername('me@x.com')).not.toBeNull()
  })

  it('rejects spaces and other symbols', () => {
    expect(validateUsername('john doe')).not.toBeNull()
    expect(validateUsername('john-doe')).not.toBeNull()
    expect(validateUsername('จอห์น')).not.toBeNull()
  })
})

describe('isEmailIdentifier', () => {
  it('treats anything with @ as an email and the rest as a username', () => {
    expect(isEmailIdentifier('a@b.co')).toBe(true)
    expect(isEmailIdentifier('john_doe')).toBe(false)
  })
})

describe('generatePassword', () => {
  it('meets the minimum length and avoids look-alike characters', () => {
    const p = generatePassword()
    expect(p.length).toBeGreaterThanOrEqual(MIN_PASSWORD_LENGTH)
    expect(p).not.toMatch(/[0OIl1]/)
  })

  it('does not repeat itself', () => {
    expect(generatePassword()).not.toBe(generatePassword())
  })
})
