import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore.js'
import { useProgramStore } from '../../store/useProgramStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { IconBolt, IconUsers, IconScale } from '../../components/icons/index.js'

const LIFTS: { key: 'squat' | 'bench' | 'deadlift'; label: string; short: string }[] = [
  { key: 'squat',    label: 'Squat',    short: 'S' },
  { key: 'bench',    label: 'Bench',    short: 'B' },
  { key: 'deadlift', label: 'Deadlift', short: 'D' },
]

export function ProfilePage() {
  const navigate = useNavigate()
  const { history, theme, setTheme, personalOneRMs, setPersonalOneRMs, clearHistory, bodyMetrics, addBodyMetric, clearMetrics } = useAppStore()
  const { clearCustomPrograms, setProgramState } = useProgramStore()
  const { user, isAdmin, isCoach, signOut } = useAuthStore()

  const handleSignOut = async () => {
    await signOut()
    clearHistory()
    clearCustomPrograms()
    clearMetrics()
    setProgramState({ progress: {}, configs: {}, customAccessories: {} })
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

  // Body composition
  const sortedMetrics = useMemo(
    () => [...bodyMetrics].sort((a, b) => b.date.localeCompare(a.date)),
    [bodyMetrics]
  )
  const latestBody = sortedMetrics[0]
  const [bw, setBw] = useState('')
  const [smm, setSmm] = useState('')
  const [bf, setBf] = useState('')
  const [bodySaved, setBodySaved] = useState(false)

  const handleSaveBody = () => {
    const weightKg = Number(bw)
    if (!weightKg) return
    addBodyMetric({
      id: 'bm' + Date.now(),
      date: new Date().toISOString(),
      weightKg,
      skeletalMuscleKg: smm ? Number(smm) : undefined,
      bodyFatPct: bf ? Number(bf) : undefined,
    })
    setBw(''); setSmm(''); setBf('')
    setBodySaved(true); setTimeout(() => setBodySaved(false), 1500)
  }

  // Weight trend — oldest→newest, last 10 entries
  const trend = useMemo(() => sortedMetrics.slice(0, 10).reverse(), [sortedMetrics])
  const trendMin = Math.min(...trend.map(e => e.weightKg))
  const trendMax = Math.max(...trend.map(e => e.weightKg))
  const trendRange = Math.max(1, trendMax - trendMin)

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

      {/* Coach panel entry — coaches and admins */}
      {(isCoach || isAdmin) && (
        <div style={{ padding: '0 20px 20px' }}>
          <button
            className="card card-tight"
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left' }}
            onClick={() => navigate('/coach')}
          >
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent)',
            }}><IconUsers size={16} /></div>
            <div style={{ flex: 1, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>
              Coaching
            </div>
            <span className="t-mono" style={{ fontSize: 11, color: 'var(--muted)' }}>MY ATHLETES →</span>
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
                    style={{ width: 116, textAlign: 'right', paddingRight: 12 }}
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

      {/* Body composition */}
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <IconScale size={14} style={{ color: 'var(--muted)' }} />
          <div className="t-eyebrow">BODY COMPOSITION</div>
        </div>
        <div className="card">
          {/* Latest summary */}
          {latestBody && (
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              background: 'var(--surface-2)', borderRadius: 10, padding: '10px 14px', marginBottom: 14,
            }}>
              {[
                { label: 'WEIGHT', val: latestBody.weightKg, unit: 'kg' },
                { label: 'MUSCLE', val: latestBody.skeletalMuscleKg, unit: 'kg' },
                { label: 'FAT', val: latestBody.bodyFatPct, unit: '%' },
              ].map(({ label, val, unit }) => (
                <div key={label} style={{ textAlign: 'center', flex: 1 }}>
                  <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 3 }}>{label}</div>
                  <div className="t-mono tnum" style={{ fontSize: 16, fontWeight: 700, color: val != null ? 'var(--text)' : 'var(--muted)' }}>
                    {val != null ? val : '—'}
                    {val != null && <span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 1 }}>{unit}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Weight trend */}
          {trend.length >= 2 && (
            <div style={{ marginBottom: 14 }}>
              <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>
                WEIGHT TREND · {trendMin}–{trendMax} kg
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 56 }}>
                {trend.map(e => {
                  const h = 20 + ((e.weightKg - trendMin) / trendRange) * 80
                  return (
                    <div key={e.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                      <div style={{ width: '100%', maxWidth: 18, height: `${h}%`, background: 'var(--accent)', borderRadius: 3, opacity: 0.85 }} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { ph: 'Weight', unit: 'kg', val: bw, set: setBw },
              { ph: 'Muscle', unit: 'kg', val: smm, set: setSmm },
              { ph: 'Fat', unit: '%', val: bf, set: setBf },
            ].map(({ ph, unit, val, set }) => (
              <div key={ph}>
                <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>{ph.toUpperCase()} ({unit})</div>
                <input
                  className="input-num tnum"
                  type="number" inputMode="decimal"
                  value={val} placeholder="0"
                  onChange={e => set(e.target.value)}
                  onFocus={e => e.target.select()}
                  style={{ width: '100%', textAlign: 'center' }}
                />
              </div>
            ))}
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 14, height: 44, fontSize: 13,
              opacity: bw || bodySaved ? 1 : 0.4,
              background: bodySaved ? '#4ade80' : undefined,
              color: bodySaved ? '#000' : undefined,
            }}
            disabled={!bw && !bodySaved}
            onClick={handleSaveBody}
          >
            {bodySaved ? 'Logged!' : 'Log today'}
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
