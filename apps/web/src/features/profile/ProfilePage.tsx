import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore.js'
import { useProgramStore } from '../../store/useProgramStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { IconBolt } from '../../components/icons/index.js'

const LIFTS: { key: 'squat' | 'bench' | 'deadlift'; label: string; short: string }[] = [
  { key: 'squat',    label: 'Squat',    short: 'S' },
  { key: 'bench',    label: 'Bench',    short: 'B' },
  { key: 'deadlift', label: 'Deadlift', short: 'D' },
]

export function ProfilePage() {
  const navigate = useNavigate()
  const { history, theme, setTheme, personalOneRMs, setPersonalOneRMs, clearHistory } = useAppStore()
  const { clearCustomPrograms } = useProgramStore()
  const { user, isAdmin, signOut } = useAuthStore()

  const handleSignOut = async () => {
    await signOut()
    clearHistory()
    clearCustomPrograms()
    navigate('/login')
  }
  const totalVol = history.reduce((s, h) => s + h.volume, 0)
  const totalSessions = history.length
  const totalMin = history.reduce((s, h) => s + h.duration, 0)

  const [draft, setDraft] = useState(personalOneRMs)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setPersonalOneRMs(draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const hasChanges =
    draft.squat !== personalOneRMs.squat ||
    draft.bench !== personalOneRMs.bench ||
    draft.deadlift !== personalOneRMs.deadlift

  return (
    <div className="atlas-screen screen-enter">
      <div className="scr-header">
        <div>
          <div className="sub">ATHLETE</div>
          <h1>Profile</h1>
        </div>
      </div>

      {/* Avatar card */}
      <div style={{ padding: '0 20px 20px' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="avatar">{user?.email?.[0]?.toUpperCase() ?? 'A'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email ?? 'Athlete'}
            </div>
            <div className="t-mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              POWERLIFTER
            </div>
          </div>
          <button className="btn btn-secondary" style={{ height: 34, fontSize: 11, padding: '0 12px', flexShrink: 0 }} onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Admin panel entry */}
      {isAdmin && (
        <div style={{ padding: '0 20px 20px' }}>
          <button
            className="card card-tight"
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left' }}
            onClick={() => navigate('/admin')}
          >
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11, color: 'var(--accent)',
            }}>★</div>
            <div style={{ flex: 1, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>
              Admin Panel
            </div>
            <span className="t-mono" style={{ fontSize: 11, color: 'var(--muted)' }}>MANAGE USERS →</span>
          </button>
        </div>
      )}

      {/* Lifetime stats */}
      <div style={{ padding: '0 20px 20px' }}>
        <div className="t-eyebrow" style={{ marginBottom: 10 }}>LIFETIME</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <div className="card card-tight" style={{ textAlign: 'center' }}>
            <div className="stat-big tnum" style={{ fontSize: 32 }}>{totalSessions}</div>
            <div className="t-eyebrow" style={{ fontSize: 9, marginTop: 4 }}>WORKOUTS</div>
          </div>
          <div className="card card-tight" style={{ textAlign: 'center' }}>
            <div className="stat-big tnum" style={{ fontSize: 32 }}>{(totalVol / 1000).toFixed(0)}k</div>
            <div className="t-eyebrow" style={{ fontSize: 9, marginTop: 4 }}>KG LIFTED</div>
          </div>
          <div className="card card-tight" style={{ textAlign: 'center' }}>
            <div className="stat-big tnum" style={{ fontSize: 32 }}>{Math.round(totalMin / 60)}h</div>
            <div className="t-eyebrow" style={{ fontSize: 9, marginTop: 4 }}>TRAINED</div>
          </div>
        </div>
      </div>

      {/* Personal 1RM */}
      <div style={{ padding: '0 20px 20px' }}>
        <div className="t-eyebrow" style={{ marginBottom: 10 }}>PERSONAL 1RM</div>
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {LIFTS.map(({ key, label, short }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11,
                  color: 'var(--accent)',
                }}>
                  {short}
                </div>
                <div style={{ flex: 1, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>
                  {label}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    className="input-num tnum"
                    type="number"
                    inputMode="decimal"
                    value={draft[key] || ''}
                    placeholder="0"
                    onChange={e => setDraft(d => ({ ...d, [key]: Number(e.target.value) || 0 }))}
                    onFocus={e => e.target.select()}
                    style={{ width: 72, textAlign: 'right' }}
                  />
                  <span className="t-mono" style={{ fontSize: 11, color: 'var(--muted)' }}>kg</span>
                </div>
              </div>
            ))}
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 16, height: 44, fontSize: 13,
              opacity: !hasChanges && !saved ? 0.4 : 1,
              background: saved ? '#4ade80' : undefined,
              color: saved ? '#000' : undefined,
            }}
            disabled={!hasChanges && !saved}
            onClick={handleSave}
          >
            {saved ? 'Saved!' : 'Save 1RM'}
          </button>
        </div>
      </div>

      {/* Theme */}
      <div style={{ padding: '0 20px 32px' }}>
        <div className="t-eyebrow" style={{ marginBottom: 10 }}>PREFERENCES</div>
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <IconBolt size={20} style={{ color: 'var(--muted)' }} />
            <div style={{ flex: 1, fontSize: 15 }}>Theme</div>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 8, padding: 2, border: '1px solid var(--border)', cursor: 'pointer' }}
            >
              {(['dark', 'light'] as const).map(t => (
                <span key={t} style={{
                  padding: '6px 10px', borderRadius: 6,
                  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
                  textTransform: 'uppercase',
                  background: t === theme ? 'var(--accent)' : 'transparent',
                  color: t === theme ? 'var(--accent-ink)' : 'var(--text-2)',
                }}>{t}</span>
              ))}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
