import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import type { Session, StructuredProgram } from '@atlaslog/shared'
import { useAuthStore } from '../../store/useAuthStore.js'
import { getAthleteSessions, getAthletePrograms } from '../../lib/coachApi.js'
import { formatDate } from '../../lib/utils.js'
import { IconChevronLeft } from '../../components/icons/index.js'

export function AthleteDetailPage() {
  const navigate = useNavigate()
  const { athleteId } = useParams()
  const { isCoach, isAdmin, roleLoaded } = useAuthStore()
  const canCoach = isCoach || isAdmin

  const [sessions, setSessions] = useState<Session[]>([])
  const [programs, setPrograms] = useState<StructuredProgram[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!canCoach || !athleteId) return
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount
    setLoading(true)
    Promise.all([getAthleteSessions(athleteId), getAthletePrograms(athleteId)])
      .then(([s, p]) => { if (active) { setSessions(s); setPrograms(p) } })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : String(e)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [canCoach, athleteId])

  if (!roleLoaded) return null
  if (!canCoach) return <Navigate to="/" replace />

  const totalVol = sessions.reduce((s, h) => s + h.volume, 0)
  const totalMin = sessions.reduce((s, h) => s + h.duration, 0)

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

          {/* Programs */}
          {programs.length > 0 && (
            <div style={{ padding: '0 20px 20px' }}>
              <div className="t-eyebrow" style={{ marginBottom: 10 }}>PROGRAMS ({programs.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {programs.map(p => (
                  <div key={p.id} className="card card-tight">
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>{p.name}</div>
                    <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                      {p.totalWeeks}W · {p.daysPerWeek} DAYS/WK
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
