import { useEffect, useState, useCallback } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import type { AthleteSummary } from '@atlaslog/shared'
import { useAuthStore } from '../../store/useAuthStore.js'
import { listAthletes, unlinkAthlete } from '../../lib/coachApi.js'
import { IconChevronRight } from '../../components/icons/index.js'

export function CoachPage() {
  const navigate = useNavigate()
  const { isCoach, isAdmin, roleLoaded } = useAuthStore()
  const canCoach = isCoach || isAdmin

  const [athletes, setAthletes] = useState<AthleteSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setAthletes(await listAthletes())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount
  useEffect(() => { if (canCoach) void load() }, [canCoach, load])

  if (!roleLoaded) return null
  if (!canCoach) return <Navigate to="/" replace />

  const handleUnlink = async (a: AthleteSummary) => {
    if (!window.confirm(`Unlink ${a.email}? You will no longer see their data.`)) return
    setBusyId(a.id)
    setError(null)
    try {
      await unlinkAthlete(a.id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="atlas-screen screen-enter">
      <div className="scr-header">
        <div>
          <div className="sub">COACH</div>
          <h1>Athletes</h1>
        </div>
        <button
          className="btn btn-secondary"
          style={{ height: 34, fontSize: 11, padding: '0 12px' }}
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? '...' : 'Refresh'}
        </button>
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

      <div style={{ padding: '0 20px 32px' }}>
        <div className="t-eyebrow" style={{ marginBottom: 10 }}>MY ATHLETES ({athletes.length})</div>
        {loading && athletes.length === 0 ? (
          <div className="t-mono" style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</div>
        ) : athletes.length === 0 ? (
          <div className="t-mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
            No athletes yet. Share your coach code from Profile.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {athletes.map(a => (
              <div key={a.id} className="card card-tight" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => navigate(`/coach/${a.id}`)}
                  style={{ all: 'unset', cursor: 'pointer', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}
                >
                  <div className="avatar" style={{ width: 36, height: 36, fontSize: 15 }}>
                    {a.email?.[0]?.toUpperCase() ?? 'A'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.email}
                    </div>
                    <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                      ATHLETE
                    </div>
                  </div>
                  <IconChevronRight size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ height: 30, fontSize: 10, padding: '0 10px', flexShrink: 0 }}
                  disabled={busyId === a.id}
                  onClick={() => handleUnlink(a)}
                >
                  {busyId === a.id ? '...' : 'Unlink'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
