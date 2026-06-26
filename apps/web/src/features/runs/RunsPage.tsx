import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore.js'
import { formatDate, formatPace } from '../../lib/utils.js'
import { DateField } from '../../components/DateField.js'
import { IconChevronLeft, IconRun, IconTrash } from '../../components/icons/index.js'
import type { RunEntry } from '@atlaslog/shared'

export function RunsPage() {
  const navigate = useNavigate()
  const { runs, addRun, removeRun } = useAppStore()

  const todayStr = new Date().toISOString().slice(0, 10)
  const [dist, setDist] = useState('')
  const [dur, setDur] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayStr)

  const sorted = useMemo(() => [...runs].sort((a, b) => b.date.localeCompare(a.date)), [runs])

  // Weekly totals — current calendar week (Sun–Sat), matching the rest of the app
  const weekly = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - start.getDay())
    const end = new Date(start); end.setDate(end.getDate() + 7)
    const inWeek = runs.filter(r => { const d = new Date(r.date); return d >= start && d < end })
    const distanceKm = inWeek.reduce((s, r) => s + r.distanceKm, 0)
    const durationMin = inWeek.reduce((s, r) => s + r.durationMin, 0)
    return { distanceKm, durationMin, pace: formatPace(distanceKm, durationMin) }
  }, [runs])

  const canSave = Number(dist) > 0 && Number(dur) > 0

  const handleAdd = () => {
    if (!canSave) return
    // Anchor the chosen day at local noon so it lands on the right calendar date
    const iso = date === todayStr ? new Date().toISOString() : new Date(`${date}T12:00:00`).toISOString()
    addRun({
      id: 'run' + Date.now(),
      date: iso,
      distanceKm: Number(dist),
      durationMin: Number(dur),
      note: note.trim() || undefined,
    })
    setDist(''); setDur(''); setNote(''); setDate(todayStr)
  }

  const handleDelete = (r: RunEntry) => {
    if (window.confirm(`Delete this ${r.distanceKm}km run?`)) removeRun(r.id)
  }

  return (
    <div className="atlas-screen screen-enter">
      <div className="scr-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn-icon" onClick={() => navigate(-1)} aria-label="Back">
          <IconChevronLeft size={20} />
        </button>
        <div>
          <div className="sub">CARDIO</div>
          <h1>Running</h1>
        </div>
      </div>

      {/* Weekly totals */}
      <div style={{ padding: '0 20px 16px' }}>
        <div className="card">
          <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 10 }}>THIS WEEK</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {[
              { label: 'DISTANCE', val: weekly.distanceKm.toFixed(1), unit: 'km' },
              { label: 'TIME', val: Math.round(weekly.durationMin), unit: 'min' },
              { label: 'AVG PACE', val: weekly.pace, unit: '/km' },
            ].map(({ label, val, unit }) => (
              <div key={label} style={{ textAlign: 'center', flex: 1 }}>
                <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>{label}</div>
                <div className="t-mono tnum" style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>
                  {val}<span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 2 }}>{unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add run */}
      <div style={{ padding: '0 20px 20px' }}>
        <div className="t-eyebrow" style={{ marginBottom: 10 }}>LOG A RUN</div>
        <div className="card">
          <div style={{ marginBottom: 8 }}>
            <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>DATE</div>
            <DateField value={date} max={todayStr} onChange={iso => setDate(iso || todayStr)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>DISTANCE (km)</div>
              <input
                className="input-num tnum" type="number" inputMode="decimal"
                value={dist} placeholder="0" onChange={e => setDist(e.target.value)}
                onFocus={e => e.target.select()} style={{ width: '100%', textAlign: 'center' }}
              />
            </div>
            <div>
              <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>TIME (min)</div>
              <input
                className="input-num tnum" type="number" inputMode="decimal"
                value={dur} placeholder="0" onChange={e => setDur(e.target.value)}
                onFocus={e => e.target.select()} style={{ width: '100%', textAlign: 'center' }}
              />
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <input
              className="input-num" type="text"
              value={note} placeholder="Note (optional)" onChange={e => setNote(e.target.value)}
              style={{ width: '100%', textAlign: 'left', fontFamily: 'var(--font-mono)', textTransform: 'none', fontSize: 13 }}
            />
          </div>
          {canSave && (
            <div className="t-mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, textAlign: 'center' }}>
              PACE {formatPace(Number(dist), Number(dur))} /km
            </div>
          )}
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 12, height: 44, fontSize: 13, opacity: canSave ? 1 : 0.4 }}
            disabled={!canSave} onClick={handleAdd}
          >
            Add Run
          </button>
        </div>
      </div>

      {/* Run list */}
      <div style={{ padding: '0 20px 20px' }}>
        <div className="t-eyebrow" style={{ marginBottom: 10 }}>RECENT RUNS</div>
        {sorted.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '28px 20px' }}>
            <IconRun size={28} style={{ color: 'var(--muted)', marginBottom: 8 }} />
            <div style={{ fontSize: 13, color: 'var(--text-2)' }}>ยังไม่มีการวิ่ง — บันทึกครั้งแรกได้เลย</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sorted.map(r => (
              <div key={r.id} className="card card-tight" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)',
                }}>
                  <IconRun size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-mono tnum" style={{ fontSize: 14, fontWeight: 700 }}>
                    {r.distanceKm}<span style={{ fontSize: 10, color: 'var(--muted)' }}>km</span>
                    <span style={{ color: 'var(--muted)', margin: '0 6px' }}>·</span>
                    {Math.round(r.durationMin)}<span style={{ fontSize: 10, color: 'var(--muted)' }}>min</span>
                    <span style={{ color: 'var(--muted)', margin: '0 6px' }}>·</span>
                    {formatPace(r.distanceKm, r.durationMin)}<span style={{ fontSize: 10, color: 'var(--muted)' }}>/km</span>
                  </div>
                  <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formatDate(r.date)}{r.note ? ` · ${r.note}` : ''}
                  </div>
                </div>
                <button className="btn-icon" onClick={() => handleDelete(r)} aria-label="Delete run" style={{ flexShrink: 0, color: 'var(--muted)' }}>
                  <IconTrash size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
