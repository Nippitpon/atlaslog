import { useEffect, useState, useCallback } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import type { AthleteSummary } from '@atlaslog/shared'
import { useAuthStore } from '../../store/useAuthStore.js'
import { listAthletes, unlinkAthlete, addAthlete, getAthleteSessions } from '../../lib/coachApi.js'
import { IconChevronRight } from '../../components/icons/index.js'

interface AthleteMetric { lastActiveDays: number | null; thisWeekCount: number; thisWeekVol: number }

function summarize(sessions: { date: string; volume: number }[]): AthleteMetric {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const ws = new Date(today); ws.setDate(ws.getDate() - today.getDay())
  const we = new Date(ws); we.setDate(we.getDate() + 7)
  let lastActiveDays: number | null = null
  let thisWeekCount = 0, thisWeekVol = 0
  for (const s of sessions) {
    const d = new Date(s.date); d.setHours(0, 0, 0, 0)
    const days = Math.round((today.getTime() - d.getTime()) / 86400000)
    if (lastActiveDays == null || days < lastActiveDays) lastActiveDays = days
    if (d >= ws && d < we) { thisWeekCount++; thisWeekVol += s.volume }
  }
  return { lastActiveDays, thisWeekCount, thisWeekVol }
}

export function CoachPage() {
  const navigate = useNavigate()
  const { isCoach, isAdmin, roleLoaded } = useAuthStore()
  const canCoach = isCoach || isAdmin

  const [athletes, setAthletes] = useState<AthleteSummary[]>([])
  const [metrics, setMetrics] = useState<Record<string, AthleteMetric>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [athleteInput, setAthleteInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [addMsg, setAddMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await listAthletes()
      setAthletes(list)
      // Best-effort per-athlete summary (active links only — RLS blocks pending)
      const pairs = await Promise.all(list.map(async a => {
        try { return [a.id, summarize(await getAthleteSessions(a.id))] as const }
        catch { return [a.id, null] as const }
      }))
      setMetrics(Object.fromEntries(pairs.filter(p => p[1])) as Record<string, AthleteMetric>)
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

  const handleAdd = async () => {
    const value = athleteInput.trim()
    if (!value) return
    setAdding(true)
    setAddMsg(null)
    try {
      const { athleteEmail, status } = await addAthlete(value)
      const who = athleteEmail || 'athlete'
      setAddMsg({ ok: true, text: status === 'active' ? `${who} already linked` : `Request sent to ${who}` })
      setAthleteInput('')
      await load()
    } catch (e) {
      setAddMsg({ ok: false, text: e instanceof Error ? e.message : String(e) })
    } finally {
      setAdding(false)
    }
  }

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

      {/* Add athlete */}
      <div style={{ padding: '0 20px 20px' }}>
        <div className="t-eyebrow" style={{ marginBottom: 10 }}>ADD ATHLETE</div>
        <div className="card">
          <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>
            Enter the athlete's email or code
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              className="input-num"
              type="text"
              value={athleteInput}
              placeholder="Athlete email / code"
              onChange={e => setAthleteInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleAdd() }}
              style={{ flex: 1, minWidth: 0, textAlign: 'left', fontFamily: 'var(--font-mono)', textTransform: 'none', fontSize: 13 }}
            />
            <button
              className="btn btn-primary"
              style={{ height: 40, fontSize: 11, padding: '0 14px', flexShrink: 0, opacity: athleteInput.trim() ? 1 : 0.4 }}
              disabled={adding || !athleteInput.trim()}
              onClick={() => void handleAdd()}
            >
              {adding ? '...' : 'Add'}
            </button>
          </div>
          {addMsg && (
            <div className="t-mono" style={{ fontSize: 11, marginTop: 8, color: addMsg.ok ? '#4ade80' : '#ef4444' }}>
              {addMsg.text}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '0 20px 32px' }}>
        <div className="t-eyebrow" style={{ marginBottom: 10 }}>MY ATHLETES ({athletes.length})</div>
        {loading && athletes.length === 0 ? (
          <div className="t-mono" style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</div>
        ) : athletes.length === 0 ? (
          <div className="t-mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
            No athletes yet. Add one by email above.
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
                    {a.status === 'pending' ? (
                      <div className="t-mono" style={{ fontSize: 10, marginTop: 2, color: '#f97316' }}>
                        PENDING — awaiting accept
                      </div>
                    ) : (() => {
                      const m = metrics[a.id]
                      const d = m?.lastActiveDays
                      const stale = d != null && d > 7
                      const activeText = d == null ? 'no workouts'
                        : d === 0 ? 'active today' : d === 1 ? '1 day ago' : `${d} days ago`
                      return (
                        <div className="t-mono" style={{ fontSize: 10, marginTop: 2, color: stale ? '#f97316' : 'var(--muted)' }}>
                          <span style={{ color: stale ? '#f97316' : '#4ade80' }}>●</span> {activeText}
                          {m && m.thisWeekCount > 0 && ` · ${m.thisWeekCount} this wk · ${(m.thisWeekVol / 1000).toFixed(1)}k`}
                        </div>
                      )
                    })()}
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
