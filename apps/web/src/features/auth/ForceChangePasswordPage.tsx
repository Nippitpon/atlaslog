import { useState } from 'react'
import { useAuthStore } from '../../store/useAuthStore.js'
import { MIN_PASSWORD_LENGTH } from '../../lib/username.js'

const inputStyle: React.CSSProperties = {
  width: '100%', height: 48,
  background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 12, color: 'var(--text)',
  fontFamily: 'var(--font-mono)', fontSize: 14,
  padding: '0 14px', outline: 'none', boxSizing: 'border-box',
}

// Shown instead of the app while profiles.must_change_password is set (admin reset
// with "force change"). Client-side gate only — see SUPABASE_SETUP.md §2l.
export function ForceChangePasswordPage({ theme }: { theme: string }) {
  const { completeForcedPasswordChange, signOut } = useAuthStore()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`)
      return
    }
    if (password !== confirm) { setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน'); return }
    setLoading(true)
    const err = await completeForcedPasswordChange(password)
    setLoading(false)
    if (err) setError(err)
  }

  return (
    <div className={`atlas-app theme-${theme}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', padding: 24 }}>
      <div style={{ maxWidth: 360, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🔑</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, marginBottom: 8 }}>
            ตั้งรหัสผ่านใหม่
          </div>
          <div style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.6 }}>
            แอดมินรีเซ็ตรหัสผ่านของคุณ กรุณาตั้งรหัสผ่านใหม่ก่อนเริ่มใช้งาน
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>NEW PASSWORD</div>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" style={inputStyle} />
          </div>
          <div>
            <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>CONFIRM PASSWORD</div>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" style={inputStyle} />
          </div>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 10, padding: '10px 14px',
              color: '#ef4444', fontFamily: 'var(--font-mono)', fontSize: 12,
            }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 4 }} disabled={loading}>
            {loading ? '...' : 'Save Password'}
          </button>
          <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={() => void signOut()}>
            Sign Out
          </button>
        </form>
      </div>
    </div>
  )
}
