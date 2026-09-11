import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore.js'
import { useProgramStore } from '../../store/useProgramStore.js'
import { STRUCTURED_PROGRAMS } from '../../lib/twelveWeekProgram.js'
import { resolveDayRef } from '../../lib/programStatus.js'
import { compareSession, prDaysByLift, LIFT_LABEL, type ExerciseDelta } from '../../lib/sessionStats.js'
import { sessionCalories, latestWeightKg } from '../../lib/calories.js'
import { formatDMY, formatDate, getExercise, todayYMD, ymdOfISO } from '../../lib/utils.js'
import { DateField } from '../../components/DateField.js'
import { IconChevronLeft, IconBolt, IconCheck } from '../../components/icons/index.js'

// Signed kg, or an em dash when there is nothing to compare against.
function Delta({ value, unit = 'kg' }: { value: number | null; unit?: string }) {
  if (value == null) return <span style={{ color: 'var(--muted)' }}>—</span>
  const rounded = Math.round(value * 10) / 10
  if (rounded === 0) return <span style={{ color: 'var(--muted)' }}>เท่าเดิม</span>
  return (
    <span style={{ color: rounded > 0 ? 'var(--accent)' : 'var(--danger)' }}>
      {rounded > 0 ? '+' : ''}{rounded}{unit}
    </span>
  )
}

function ExerciseBlock({ delta }: { delta: ExerciseDelta }) {
  const { current, previous, previousSession } = delta
  const meta = getExercise(current.exerciseId)
  const topIdx = current.sets.findIndex(s => s === current.topSet)

  return (
    <div className="card card-tight">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>
            {current.name || meta.name}
          </div>
          {current.label && (
            <div className="t-mono" style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>
              {current.label}
            </div>
          )}
        </div>
        <span className="t-mono tnum" style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>
          {(current.volumeKg / 1000).toFixed(1)}k kg
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px', marginBottom: previous ? 10 : 0 }}>
        {current.sets.map((s, i) => (
          <span key={i} className="t-mono tnum" style={{ fontSize: 11, color: 'var(--muted)' }}>
            <span style={{ color: i === topIdx ? 'var(--text)' : 'var(--text-2)', fontWeight: i === topIdx ? 700 : 500 }}>{s.w}</span>
            <span style={{ fontSize: 9, marginLeft: 1 }}>kg</span>
            <span style={{ margin: '0 2px' }}>×</span>
            <span style={{ color: i === topIdx ? 'var(--text)' : 'var(--text-2)' }}>{s.r}</span>
            {s.rpe != null && <span style={{ fontSize: 9, marginLeft: 3 }}>@{s.rpe}</span>}
            {i === topIdx && (
              <span className="t-eyebrow" style={{ fontSize: 8, marginLeft: 5, color: 'var(--accent)' }}>TOP</span>
            )}
          </span>
        ))}
      </div>

      {previous && previousSession ? (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 9 }}>
          <div className="t-eyebrow" style={{ fontSize: 8, marginBottom: 6, color: 'var(--muted)' }}>
            เทียบครั้งก่อน · {formatDate(previousSession.date)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { k: 'Top set', node: <Delta value={delta.topWeightDelta} /> },
              { k: 'Volume', node: <Delta value={delta.volumeDelta} /> },
              { k: 'e1RM', node: <Delta value={delta.e1rmDelta} /> },
            ].map(x => (
              <div key={x.k}>
                <div className="t-mono tnum" style={{ fontSize: 12, fontWeight: 600 }}>{x.node}</div>
                <div className="t-mono" style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>{x.k}</div>
              </div>
            ))}
          </div>
          <div className="t-mono tnum" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 7 }}>
            ครั้งก่อน: {previous.topSet?.w}kg × {previous.topSet?.r}
            {' · '}{(previous.volumeKg / 1000).toFixed(1)}k kg
          </div>
        </div>
      ) : (
        <div className="t-mono" style={{
          fontSize: 10, color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: 9,
        }}>
          ครั้งแรกที่บันทึกท่านี้ — ยังไม่มีอะไรให้เทียบ
        </div>
      )}
    </div>
  )
}

export function SessionDetailPage() {
  const { sessionId = '' } = useParams()
  const navigate = useNavigate()
  const { history, bodyMetrics, setSessionDate } = useAppStore()
  const customPrograms = useProgramStore(s => s.customPrograms)
  const programs = useMemo(() => [...STRUCTURED_PROGRAMS, ...customPrograms], [customPrograms])

  const session = history.find(h => h.id === sessionId)
  const [editingDate, setEditingDate] = useState(false)

  const deltas = useMemo(
    () => (session ? compareSession(session, history) : []),
    [session, history],
  )
  // PRs are whole-history facts, so they are recomputed here rather than passed in.
  const prs = useMemo(
    () => (session ? (prDaysByLift(history).get(ymdOfISO(session.date)) ?? [])
      .filter(p => p.sessionId === session.id) : []),
    [session, history],
  )

  if (!session) {
    return (
      <div className="atlas-screen screen-enter">
        <div className="scr-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn-icon" onClick={() => navigate('/history')} aria-label="Back">
            <IconChevronLeft size={20} />
          </button>
          <h1>Session</h1>
        </div>
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-2)', fontSize: 13 }}>
          ไม่พบ session นี้ — อาจถูกลบไปแล้ว
        </div>
      </div>
    )
  }

  const target = resolveDayRef(session.programId, programs)
  const calories = session.calories ?? sessionCalories(session, latestWeightKg(bodyMetrics))
  const currentYmd = ymdOfISO(session.date)

  return (
    <div className="atlas-screen screen-enter">
      <div className="scr-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn-icon" onClick={() => navigate('/history')} aria-label="Back">
          <IconChevronLeft size={20} />
        </button>
        <div style={{ minWidth: 0 }}>
          <div className="sub">{formatDate(session.date)}</div>
          <h1 style={{ fontSize: 24 }}>{session.name}</h1>
        </div>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {prs.length > 0 && (
          <div className="card card-tight" style={{
            background: 'rgba(212,255,58,0.08)', border: '1px solid rgba(212,255,58,0.35)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconBolt size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div className="t-eyebrow" style={{ fontSize: 9, color: 'var(--accent)' }}>
                  PERSONAL RECORD
                </div>
                <div className="t-mono tnum" style={{ fontSize: 12, color: 'var(--text)', marginTop: 3 }}>
                  {prs.map(p => `${LIFT_LABEL[p.lift]} ${Math.round(p.e1rm)}kg`).join(' · ')}
                </div>
                <div className="t-mono" style={{ fontSize: 9, color: 'var(--muted)', marginTop: 3 }}>
                  e1RM ประมาณจากเซ็ตที่ทำ — ไม่ใช่ 1RM ที่เทสต์จริง
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="card card-tight">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[
              { v: String(session.duration), u: 'min' },
              { v: `${(session.volume / 1000).toFixed(1)}k`, u: 'kg' },
              { v: String(session.setCount), u: 'sets' },
              { v: calories > 0 ? String(calories) : '—', u: 'kcal' },
            ].map((x, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div className="t-display tnum" style={{ fontSize: 17, lineHeight: 1 }}>{x.v}</div>
                <div className="t-eyebrow" style={{ fontSize: 8, marginTop: 4, color: 'var(--muted)' }}>{x.u}</div>
              </div>
            ))}
          </div>

          {target && (
            <button
              onClick={() => navigate(`/programs/${target.program.id}/week/${target.week.id}`)}
              style={{
                all: 'unset', cursor: 'pointer', display: 'block', width: '100%', boxSizing: 'border-box',
                borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 10,
              }}
            >
              <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
                {target.program.name} · W{target.weekNum} · {target.day.dayOfWeek.toUpperCase()} — {target.day.focus} →
              </div>
            </button>
          )}
        </div>

        {/* Backdating. Editing the date does not move which program day this
            closed out — that link lives in Session.programId. */}
        <div className="card card-tight">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t-eyebrow" style={{ fontSize: 9, color: 'var(--muted)' }}>SESSION DATE</div>
              <div className="t-mono tnum" style={{ fontSize: 13, marginTop: 4 }}>
                {formatDMY(session.date)}
              </div>
            </div>
            {!editingDate && (
              <button className="pill" onClick={() => setEditingDate(true)}>แก้วันที่</button>
            )}
          </div>
          {editingDate && (
            <div style={{ marginTop: 12 }}>
              <DateField
                value={currentYmd}
                max={todayYMD()}
                onChange={ymd => {
                  if (ymd && ymd !== currentYmd) setSessionDate(session.id, ymd)
                  setEditingDate(false)
                }}
              />
              <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 7 }}>
                ย้ายไปวันอื่นได้ · วันที่ทำตามโปรแกรมไม่เปลี่ยน
              </div>
            </div>
          )}
        </div>

        <div className="t-eyebrow" style={{ marginTop: 4 }}>
          EXERCISES · {deltas.length}
        </div>

        {deltas.length > 0 ? (
          deltas.map(d => <ExerciseBlock key={d.current.exerciseId} delta={d} />)
        ) : (
          <div className="card card-tight" style={{
            textAlign: 'center', color: 'var(--text-2)', fontSize: 13,
          }}>
            <IconCheck size={18} style={{ color: 'var(--muted)' }} />
            <div style={{ marginTop: 6 }}>session นี้ไม่มีเซ็ตที่บันทึกไว้</div>
          </div>
        )}
      </div>
    </div>
  )
}
