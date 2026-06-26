import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { UserBio } from '@atlaslog/shared'
import { useAppStore } from '../../store/useAppStore.js'
import { useProgramStore } from '../../store/useProgramStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { STRUCTURED_PROGRAMS } from '../../lib/twelveWeekProgram.js'
import { calcEnergy, ACTIVITY, ACTIVITY_ORDER, suggestActivityFromDays } from '../../lib/energy.js'
import { IconBolt, IconUsers, IconScale, IconX } from '../../components/icons/index.js'

const todayISO = new Date().toISOString().split('T')[0]

const LIFTS: { key: 'squat' | 'bench' | 'deadlift'; label: string; short: string }[] = [
  { key: 'squat',    label: 'Squat',    short: 'S' },
  { key: 'bench',    label: 'Bench',    short: 'B' },
  { key: 'deadlift', label: 'Deadlift', short: 'D' },
]

export function ProfilePage() {
  const navigate = useNavigate()
  const { history, theme, setTheme, personalOneRMs, setPersonalOneRMs, clearHistory, bodyMetrics, addBodyMetric, clearMetrics, bio, setBio } = useAppStore()
  const { clearCustomPrograms, setProgramState, configs, customPrograms } = useProgramStore()
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
  const [show1RM, setShow1RM] = useState(false)

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

  // Bio & Energy (BMR / TDEE)
  const energy = useMemo(() => calcEnergy(bio, latestBody), [bio, latestBody])
  // Suggested activity from the highest days/week among set-up programs
  const suggestedActivity = useMemo(() => {
    const all = [...STRUCTURED_PROGRAMS, ...customPrograms]
    let days = 0
    for (const pid of Object.keys(configs)) {
      const p = all.find(x => x.id === pid)
      if (p) days = Math.max(days, p.daysPerWeek)
    }
    return suggestActivityFromDays(days)
  }, [configs, customPrograms])
  const [showBio, setShowBio] = useState(false)
  const [bioDraft, setBioDraft] = useState<UserBio>(bio)
  const [bioSaved, setBioSaved] = useState(false)

  const openBio = () => {
    setBioDraft({ ...bio, activityLevel: bio.activityLevel ?? suggestedActivity })
    setShowBio(true)
  }
  const handleBioSave = () => {
    setBio(bioDraft)
    setBioSaved(true)
    setTimeout(() => { setBioSaved(false); setShowBio(false) }, 900)
  }
  const hasBio = !!(bio.sex || bio.heightCm || bio.birthDate)

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
              { ph: 'Weight', unit: 'kg', val: bw, set: setBw, min: 0, max: 500 },
              { ph: 'Muscle', unit: 'kg', val: smm, set: setSmm, min: 0, max: 200 },
              { ph: 'Fat', unit: '%', val: bf, set: setBf, min: 0, max: 100 },
            ].map(({ ph, unit, val, set, min, max }) => (
              <div key={ph}>
                <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>{ph.toUpperCase()} ({unit})</div>
                <input
                  className="input-num tnum"
                  type="number" inputMode="decimal" min={min} max={max}
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

      {/* Energy — BMR / TDEE */}
      <div style={{ padding: '0 20px 20px' }}>
        <div className="t-eyebrow" style={{ marginBottom: 10 }}>ENERGY (BMR / TDEE)</div>
        <div className="card">
          {energy ? (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1, textAlign: 'center', background: 'var(--surface-2)', borderRadius: 10, padding: '12px 8px' }}>
                  <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 3 }}>BMR</div>
                  <div className="t-mono tnum" style={{ fontSize: 20, fontWeight: 700 }}>
                    {energy.bmr}<span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 2 }}>kcal</span>
                  </div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', background: 'var(--surface-2)', borderRadius: 10, padding: '12px 8px' }}>
                  <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 3 }}>TDEE</div>
                  <div className="t-mono tnum" style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>
                    {energy.tdee}<span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 2 }}>kcal</span>
                  </div>
                </div>
              </div>
              <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 12 }}>
                {energy.method === 'katch' ? 'Katch-McArdle · จาก % ไขมัน' : 'Mifflin-St Jeor'} · {ACTIVITY[bio.activityLevel ?? 'sedentary'].label}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ l: 'CUT', v: energy.tdee - 500 }, { l: 'MAINTAIN', v: energy.tdee }, { l: 'BULK', v: energy.tdee + 500 }].map(g => (
                  <div key={g.l} style={{ flex: 1, textAlign: 'center' }}>
                    <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 2 }}>{g.l}</div>
                    <div className="t-mono tnum" style={{ fontSize: 14, fontWeight: 600 }}>{g.v}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="t-mono" style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
              กรอก Bio (เพศ / ส่วนสูง / วันเกิด) หรือ log % ไขมันใน Body Composition เพื่อคำนวณ BMR / TDEE
            </div>
          )}
          <button
            className="btn btn-secondary"
            style={{ width: '100%', marginTop: 14, height: 40, fontSize: 12 }}
            onClick={openBio}
          >
            {hasBio ? 'Edit bio' : 'Set up bio'}
          </button>
        </div>
      </div>

      {/* Personal 1RM — menu button → popup */}
      <div style={{ padding: '0 20px 20px' }}>
        <button
          className="card card-tight"
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left' }}
          onClick={() => { setDraft(personalOneRMs); setShow1RM(true) }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11, color: 'var(--accent)',
          }}>1RM</div>
          <div style={{ flex: 1, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>
            Personal 1RM
          </div>
          <span className="t-mono tnum" style={{ fontSize: 11, color: 'var(--muted)' }}>
            {personalOneRMs.squat || personalOneRMs.bench || personalOneRMs.deadlift
              ? `${personalOneRMs.squat}/${personalOneRMs.bench}/${personalOneRMs.deadlift} →`
              : 'Set →'}
          </span>
        </button>
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

      {/* Personal 1RM popup */}
      {show1RM && (
        <div className="sheet-backdrop" onClick={() => setShow1RM(false)} style={{ zIndex: 100 }}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <h3 className="t-display" style={{ margin: 0, fontSize: 20 }}>Personal 1RM</h3>
              <button className="btn-icon" onClick={() => setShow1RM(false)}><IconX size={18} /></button>
            </div>
            <p className="t-mono" style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16 }}>
              ใช้คำนวณน้ำหนักในโปรแกรม Powerlifting อัตโนมัติ
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {LIFTS.map(({ key, label, short }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11, color: 'var(--accent)',
                  }}>{short}</div>
                  <div style={{ flex: 1, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>{label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input className="input-num tnum" type="number" inputMode="decimal" min={0} max={1000}
                      value={draft[key] || ''} placeholder="0"
                      onChange={e => setDraft(d => ({ ...d, [key]: Math.max(0, Number(e.target.value) || 0) }))}
                      onFocus={e => e.target.select()}
                      style={{ width: 116, textAlign: 'right', paddingRight: 12 }} />
                    <span className="t-mono" style={{ fontSize: 11, color: 'var(--muted)' }}>kg</span>
                  </div>
                </div>
              ))}
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 18, height: 44, fontSize: 13,
                opacity: !hasChanges && !saved ? 0.4 : 1,
                background: saved ? '#4ade80' : undefined, color: saved ? '#000' : undefined }}
              disabled={!hasChanges && !saved}
              onClick={handleSave}
            >
              {saved ? 'Saved!' : 'Save 1RM'}
            </button>
          </div>
        </div>
      )}

      {/* Bio & Energy popup */}
      {showBio && (
        <div className="sheet-backdrop" onClick={() => setShowBio(false)} style={{ zIndex: 100 }}>
          <div className="sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '92%', overflowY: 'auto' }}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <h3 className="t-display" style={{ margin: 0, fontSize: 20 }}>Bio & Energy</h3>
              <button className="btn-icon" onClick={() => setShowBio(false)}><IconX size={18} /></button>
            </div>
            <p className="t-mono" style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16 }}>
              ใช้คำนวณ BMR / TDEE · น้ำหนัก & % ไขมัน ดึงจาก Body Composition อัตโนมัติ
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Sex */}
              <div>
                <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>SEX</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['male', 'female'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setBioDraft(d => ({ ...d, sex: s }))}
                      className="btn"
                      style={{ flex: 1, height: 40, fontSize: 12, textTransform: 'capitalize',
                        background: bioDraft.sex === s ? 'var(--accent)' : 'var(--surface-2)',
                        color: bioDraft.sex === s ? 'var(--accent-ink)' : 'var(--text-2)' }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              {/* Height + birth date */}
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>HEIGHT (cm)</div>
                  <input className="input-num tnum" type="number" inputMode="decimal" min={0} max={300}
                    value={bioDraft.heightCm ?? ''} placeholder="0"
                    onChange={e => setBioDraft(d => ({ ...d, heightCm: Number(e.target.value) || undefined }))}
                    onFocus={e => e.target.select()}
                    style={{ width: '100%', textAlign: 'center' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>BIRTH DATE</div>
                  <input className="input-num" type="date" max={todayISO}
                    value={bioDraft.birthDate ?? ''}
                    onChange={e => setBioDraft(d => ({ ...d, birthDate: e.target.value || undefined }))}
                    style={{ width: '100%', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                </div>
              </div>
              {/* Activity level */}
              <div>
                <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>ACTIVITY LEVEL</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {ACTIVITY_ORDER.map(lvl => {
                    const active = (bioDraft.activityLevel ?? suggestedActivity) === lvl
                    return (
                      <button
                        key={lvl}
                        onClick={() => setBioDraft(d => ({ ...d, activityLevel: lvl }))}
                        style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                          border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                          background: active ? 'rgba(212,255,58,0.10)' : 'var(--surface-2)' }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 600, color: active ? 'var(--accent)' : 'var(--text)' }}>
                          {ACTIVITY[lvl].label}
                        </div>
                        <div className="t-mono" style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>×{ACTIVITY[lvl].multiplier}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 18, height: 44, fontSize: 13,
                background: bioSaved ? '#4ade80' : undefined, color: bioSaved ? '#000' : undefined }}
              onClick={handleBioSave}
            >
              {bioSaved ? 'Saved!' : 'Save bio'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
