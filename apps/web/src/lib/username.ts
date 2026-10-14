// Must match the check constraint + RPC validation in SUPABASE_SETUP.md §2l.
// '@' is excluded on purpose: signIn() treats any identifier containing '@' as an email.
export const USERNAME_PATTERN = /^[a-z0-9_.]{3,20}$/

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase()
}

export function validateUsername(raw: string): string | null {
  const u = normalizeUsername(raw)
  if (!u) return 'กรุณากรอก Username'
  if (u.length < 3 || u.length > 20) return 'Username ต้องยาว 3–20 ตัวอักษร'
  if (!USERNAME_PATTERN.test(u)) return 'ใช้ได้เฉพาะ a–z, 0–9, _ และ .'
  return null
}

export function isEmailIdentifier(identifier: string): boolean {
  return identifier.includes('@')
}

export const MIN_PASSWORD_LENGTH = 6

export function generatePassword(length = 10): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => chars[b % chars.length]).join('')
}
