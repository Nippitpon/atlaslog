import { useEffect, useState, useMemo } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import type { Session, StructuredProgram, BodyMetricEntry, UserBio, ProgramOneRMs } from '@atlaslog/shared'
import { useAuthStore } from '../../store/useAuthStore.js'
import {
  getAthleteSessions, getAthletePrograms, getAthleteBodyMetrics, getAthleteState,
} from '../../lib/coachApi.js'
import { formatDate } from '../../lib/utils.js'
import { calcEnergy, ACTIVITY } from '../../lib/energy.js'
import { IconChevronLeft } from '../../components/icons/index.js'

// Volume per calendar week (Sun-start) for the last `weeks` weeks, oldest→newest.
function weeklyBuckets(sessions: Session[], weeks = 6) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - today.getDay())
  const out: { volume: number; isCurrent: boolean }[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const s = new Date(weekStart); s.setDate(s.getDate() - i * 7)
    const e = new Date(s); e.setDate(e.getDate() + 7)
    const volume = sessions
      .filter(x => { const d = new Date(x.date); return d >= s && d < e })
      .reduce((a, x) => a + x.volume, 0)
    out.push({ volume, isCurrent: i === 0 })
  }
  return out
}

export function AthleteDetailPage() {
  const navigate = useNavigate()
  const { athleteId } = useParams()
  const { isCoach, isAdmin, roleLoaded } = useAuthStore()
  const canCoach = isCoach || isAdmin

  const [sessions, setSessions] = useState<Session[]>([])
  const [programs, setPrograms] = useState<StructuredProgram[]>([])
  const [metrics, setMetrics] = useState<BodyMetricEntry[]>([])
  const [bio, setBioState] = useState<UserBio>({})
  const [oneRMs, setOneRMs] = useState<ProgramOneRMs | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!canCoach || !athleteId) return
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount
    setLoading(true)
    Promise.all([
      getAthleteSessions(athleteId),
      getAthletePrograms(athleteId),
      getAthleteBodyMetrics(athleteId),
      getAthleteState(athleteId),
    ])
      .then(([s, p, m, st]) => {
        if (!active) return
        setSessions(s); setPrograms(p); setMetrics(m)
        setBioState(st.bio); setOneRMs(st.personalOneRMs)
      })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : String(e)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [canCoach, athleteId])

  const totalVol = sessions.reduce((s, h) => s + h.volume, 0)
  const totalMin = sessions.reduce((s, h) => s + h.duration, 0)

  // Strength card visibility: hide only when athlete runs exclusively general programs.
  const isPowerlifting = useMemo(() => {
    const oneRMset = !!(oneRMs && (oneRMs.squat || oneRMs.bench || oneRMs.deadlift))
    if (oneRMset) return true
    if (programs.length === 0) return true
    return programs.some(p => (p.programType ?? 'powerlifting') === 'powerlifting')
  }, [programs, oneRMs])

  // Adherence (this calendar week) + weekly volume chart
  const buckets = useMemo(() => weeklyBuckets(sessions), [sessions])
  const maxBucket = Math.max(1, ...buckets.map(b => b.volume))
  const plannedDays = useMemo(
    () => programs.reduce((m, p) => Math.max(m, p.daysPerWeek), 0),
    [programs]
  )
  const sessionsThisWeek = buckets[buckets.length - 1]
  const doneThisWeek = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const ws = new Date(today); ws.setDate(ws.getDate() - today.getDay())
    const we = new Date(ws); we.setDate(we.getDate() + 7)
    return sessions.filter(x => { const d = new Date(x.date); return d >= ws && d < we }).length
  }, [sessions])

  // Body + energy
  const sortedMetrics = useMemo(
    () => [...metrics].sort((a, b) => b.date.localeCompare(a.date)),
    [metrics]
  )
  const latestBody = sortedMetrics[0]
  const energy = useMemo(() => calcEnergy(bio, latestBody), [bio, latestBody])
  const trend = useMemo(() => sortedMetrics.slice(0, 10).reverse(), [sortedMetrics])
  const trendMin = trend.length ? Math.min(...trend.map(e => e.weightKg)) : 0
  const trendMax = trend.length ? Math.max(...trend.map(e => e.weightKg)) : 0
  const trendRange = Math.max(1, trendMax - trendMin)

  if (!roleLoaded) return null
  if (!canCoach) return <Navigate to="/" replace />

  const sbdTotal = oneRMs ? oneRMs.squat + oneRMs.bench + oneRMs.deadlift : 0

  return (
    <div className="atlas-screen screen-enter">
      <div className="scr-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn-icon" onClick={() => navigate('/coach')} aria-label="Back to athletes">
            <IconChevronLeft size={20} />
          </button>
          <div>
            <div className="sub">COACH VIEW</div>
            <h1>Athlete</h1>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '0 20px 16px' }}>
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 10, padding: '10px 14px',
            color: '#ef4444', fontFamily: 'var(--font-mono)', fontSize: 12,
          }}>
            {error}
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
          Loading…
        </div>
      ) : (
        <>
          {/* Lifetime stats */}
          <div style={{ padding: '0 20px 20px' }}>
            <div className="t-eyebrow" style={{ marginBottom: 10 }}>LIFETIME</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <div className="card card-tight" style={{ textAlign: 'center' }}>
                <div className="stat-big tnum" style={{ fontSize: 32 }}>{sessions.length}</div>
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

          {/* Adherence + weekly volume */}
          <div style={{ padding: '0 20px 20px' }}>
            <div className="t-eyebrow" style={{ marginBottom: 10 }}>ADHERENCE</div>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <div className="t-mono" style={{ fontSize: 12, color: 'var(--muted)' }}>THIS WEEK</div>
                <div className="t-mono tnum" style={{ fontSize: 15, fontWeight: 700 }}>
                  {doneThisWeek}{plannedDays ? <span style={{ color: 'var(--muted)' }}>/{plannedDays}</span> : ''}
                  <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 4 }}>workouts</span>
                </div>
              </div>
              <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>
                WEEKLY VOLUME · last 6 weeks
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 56 }}>
                {buckets.map((b, i) => {
                  const h = b.volume > 0 ? 12 + (b.volume / maxBucket) * 88 : 4
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                      <div style={{
                        width: '100%', maxWidth: 26, height: `${h}%`, borderRadius: 3,
                        background: b.isCurrent ? 'var(--accent)' : 'var(--surface-2)',
                        opacity: b.isCurrent ? 0.9 : 1,
                        border: b.isCurrent ? 'none' : '1px solid var(--border)',
                      }} />
                    </div>
                  )
                })}
              </div>
              <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8, textAlign: 'right' }}>
                this week: {(sessionsThisWeek.volume / 1000).toFixed(1)}k kg
              </div>
            </div>
          </div>

          {/* Body & Energy */}
          <div style={{ padding: '0 20px 20px' }}>
            <div className="t-eyebrow" style={{ marginBottom: 10 }}>BODY &amp; ENERGY</div>
            <div className="card">
              {latestBody ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--surface-2)', borderRadius: 10, padding: '10px 14px', marginBottom: trend.length >= 2 ? 14 : 0 }}>
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
                  {trend.length >= 2 && (
                    <div style={{ marginBottom: energy ? 14 : 0 }}>
                      <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>
                        WEIGHT TREND · {trendMin}–{trendMax} kg
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 48 }}>
                        {trend.map(e => {
                          const h = 20 + ((e.weightKg - trendMin) / trendRange) * 80
                          return (
                            <div key={e.id} style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', height: '100%' }}>
                              <div style={{ width: '100%', maxWidth: 18, height: `${h}%`, background: 'var(--accent)', borderRadius: 3, opacity: 0.85 }} />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="t-mono" style={{ fontSize: 12, color: 'var(--muted)' }}>No body data logged yet</div>
              )}

              {energy && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, textAlign: 'center', background: 'var(--surface-2)', borderRadius: 10, padding: '10px 8px' }}>
                    <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 3 }}>BMR</div>
                    <div className="t-mono tnum" style={{ fontSize: 17, fontWeight: 700 }}>{energy.bmr}</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', background: 'var(--surface-2)', borderRadius: 10, padding: '10px 8px' }}>
                    <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 3 }}>TDEE</div>
                    <div className="t-mono tnum" style={{ fontSize: 17, fontWeight: 700, color: 'var(--accent)' }}>{energy.tdee}</div>
                  </div>
                </div>
              )}
              {energy && (
                <div className="t-mono" style={{ fontSize: 9, color: 'var(--muted)', marginTop: 8 }}>
                  {energy.method === 'katch' ? 'Katch-McArdle' : 'Mifflin-St Jeor'} · {ACTIVITY[bio.activityLevel ?? 'sedentary'].label}
                </div>
              )}
            </div>
          </div>

          {/* Strength — powerlifting only */}
          {isPowerlifting && (
            <div style={{ padding: '0 20px 20px' }}>
              <div className="t-eyebrow" style={{ marginBottom: 10 }}>STRENGTH</div>
              <div className="card">
                {oneRMs && sbdTotal > 0 ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      {[
                        { l: 'SQUAT', v: oneRMs.squat },
                        { l: 'BENCH', v: oneRMs.bench },
                        { l: 'DEADLIFT', v: oneRMs.deadlift },
                      ].map(x => (
                        <div key={x.l} style={{ textAlign: 'center', flex: 1 }}>
                          <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 3 }}>{x.l}</div>
                          <div className="t-mono tnum" style={{ fontSize: 16, fontWeight: 700 }}>
                            {x.v}<span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 1 }}>kg</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ textAlign: 'center', background: 'var(--surface-2)', borderRadius: 10, padding: '10px' }}>
                      <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 3 }}>SBD TOTAL</div>
                      <div className="t-mono tnum" style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
                        {sbdTotal}<span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 2 }}>kg</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="t-mono" style={{ fontSize: 12, color: 'var(--muted)' }}>Athlete hasn't set their 1RM yet</div>
                )}
              </div>
            </div>
          )}

          {/* Programs */}
          {programs.length > 0 && (
            <div style={{ padding: '0 20px 20px' }}>
              <div className="t-eyebrow" style={{ marginBottom: 10 }}>PROGRAMS ({programs.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {programs.map(p => (
                  <div key={p.id} className="card card-tight">
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>{p.name}</div>
                    <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                      {p.totalWeeks}W · {p.daysPerWeek} DAYS/WK · {(p.programType ?? 'powerlifting') === 'general' ? 'GENERAL' : 'POWERLIFTING'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent sessions */}
          <div style={{ padding: '0 20px 32px' }}>
            <div className="t-eyebrow" style={{ marginBottom: 10 }}>RECENT WORKOUTS</div>
            {sessions.length === 0 ? (
              <div className="t-mono" style={{ fontSize: 12, color: 'var(--muted)' }}>No workouts logged yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sessions.slice(0, 30).map(s => (
                  <div key={s.id} className="card card-tight" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.name}
                      </div>
                      <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                        {formatDate(s.date)} · {s.setCount} SETS · {s.duration}m
                      </div>
                    </div>
                    <div className="t-mono tnum" style={{ fontSize: 13, color: 'var(--accent)', flexShrink: 0 }}>
                      {(s.volume / 1000).toFixed(1)}k
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
