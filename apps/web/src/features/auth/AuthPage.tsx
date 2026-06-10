import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuthStore.js'
import { useAppStore } from '../../store/useAppStore.js'
import { useProgramStore } from '../../store/useProgramStore.js'
import { supabase } from '../../lib/supabase.js'
import type { Session, StructuredProgram } from '@atlaslog/shared'

type Mode = 'signin' | 'signup'

export function AuthPage() {
  const navigate = useNavigate()
  const { signIn, signUp } = useAuthStore()
  const { setHistory } = useAppStore()
  const { setCustomPrograms } = useProgramStore()

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [signupDone, setSignupDone] = useState(false)

  const loadCloudData = async () => {
    const [{ data: sessions }, { data: programs }] = await Promise.all([
      supabase.from('sessions').select('*').order('date', { ascending: false }),
      supabase.from('custom_programs').select('*'),
    ])
    if (sessions) setHistory(sessions as Session[])
    if (programs) setCustomPrograms(programs.map((r: { program: StructuredProgram }) => r.program))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (mode === 'signup') {
      const err = await signUp(email, password)
      if (err) { setError(err); setLoading(false); return }
      setSignupDone(true)
      setLoading(false)
      return
    }

    const err = await signIn(email, password)
    if (err) { setError(err); setLoading(false); return }

    await loadCloudData()
    navigate('/')
  }

  if (signupDone) {
    return (
      <div className="atlas-app theme-dark" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', padding: 24 }}>
        <div style={{ maxWidth: 360, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, marginBottom: 8 }}>
            Check your email
          </div>
          <div style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            เราส่ง confirmation link ไปที่<br />
            <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>{email}</span>
          </div>
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setSignupDone(false)}>
            Back to Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="atlas-app theme-dark" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', padding: 24 }}>
      <div style={{ maxWidth: 360, width: '100%' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 36, letterSpacing: '-0.03em', color: 'var(--accent)' }}>
            ATLASLOG
          </div>
          <div className="t-mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
            POWERLIFTING TRACKER
          </div>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 12, padding: 4, marginBottom: 28 }}>
          {(['signin', 'signup'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null) }}
              style={{
                flex: 1, height: 40, borderRadius: 9, border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                background: mode === m ? 'var(--surface)' : 'transparent',
                color: mode === m ? 'var(--text)' : 'var(--muted)',
                transition: 'all .2s',
              }}
            >
              {m === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>EMAIL</div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={{
                width: '100%', height: 48,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 12, color: 'var(--text)',
                fontFamily: 'var(--font-mono)', fontSize: 14,
                padding: '0 14px', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>PASSWORD</div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              style={{
                width: '100%', height: 48,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 12, color: 'var(--text)',
                fontFamily: 'var(--font-mono)', fontSize: 14,
                padding: '0 14px', outline: 'none', boxSizing: 'border-box',
              }}
            />
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

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 4 }}
            disabled={loading}
          >
            {loading ? '...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
