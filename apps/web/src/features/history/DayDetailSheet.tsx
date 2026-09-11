import { useNavigate } from 'react-router-dom'
import type { StructuredExercise, StructuredProgram } from '@atlaslog/shared'
import { useAppStore } from '../../store/useAppStore.js'
import { useProgramStore } from '../../store/useProgramStore.js'
import { buildDayProgram } from '../../lib/twelveWeekProgram.js'
import { resolveCalcRMs, structuredWeight } from '../../lib/rpeTable.js'
import { resolveDayExercises } from '../../lib/dayLayout.js'
import { resolveDayRef, DAY_STATUS_STYLE } from '../../lib/programStatus.js'
import { CALENDAR_DOT, type CalendarDot, type ScheduledCell, type TrainedCell } from '../../lib/historyCalendar.js'
import { LIFT_LABEL, type LiftPR } from '../../lib/sessionStats.js'
import { dateFromYMD, formatDMY, runTarget } from '../../lib/utils.js'
import { useStartWorkout } from '../../hooks/useStartWorkout.js'
import { IconRun, IconX } from '../../components/icons/index.js'
import { SessionCard } from './SessionCard.js'
import { RunCard } from './RunCard.js'

// One prescribed day that still wants work on this date. Everything shown here
// mirrors WeekDays' DayCard — same resolveDayExercises + structuredWeight, so a
// day reads identically whether you reach it from the week page or the calendar.
function ScheduledDay({ cell, isPast, onClose }: { cell: ScheduledCell; isPast: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const startWorkout = useStartWorkout()
  const personalOneRMs = useAppStore(s => s.personalOneRMs)
  const { configs, getDayLayout, setDayStatus } = useProgramStore()

  const { program, week, day, status } = cell
  const exercises = resolveDayExercises(day, getDayLayout(program.id, week.id, day.id))
  const runs = day.exercises.filter(e => e.type === 'running')
  const calcRMs = resolveCalcRMs(program, configs[program.id], personalOneRMs)

  const handleStart = () => {
    if (startWorkout(buildDayProgram(program.id, week.id, day, exercises, calcRMs)) !== 'cancelled') {
      onClose()
    }
  }

  const badge = DAY_STATUS_STYLE[status]

  return (
    <div className="card card-tight">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>
            W{cell.weekNum} · {day.dayOfWeek.toUpperCase()} · {program.name}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16 }}>
            {day.focus}
          </div>
        </div>
        <span className="t-mono" style={{
          fontSize: 9, flexShrink: 0, padding: '3px 8px', borderRadius: 999,
          background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color,
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          {badge.label}
        </span>
      </div>

      {exercises.length > 0 && (
        <div style={{
          borderTop: '1px solid var(--border)', paddingTop: 10, marginBottom: 12,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {exercises.map((ex: StructuredExercise, i: number) => {
            const wt = structuredWeight(ex, calcRMs)
            return (
              <div key={ex.id ?? i} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <div style={{
                  fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12,
                  color: ex.type === 'main' ? 'var(--text)' : 'var(--text-2)',
                  flex: 1, minWidth: 0,
                }}>
                  {ex.name}
                  {ex.label && (
                    <span className="t-mono" style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 6 }}>
                      {ex.label}
                    </span>
                  )}
                </div>
                <span className="t-mono tnum" style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>
                  {ex.sets}×{ex.reps}
                  {ex.rpe !== undefined && ` @${ex.rpe}`}
                  {wt ? <span style={{ color: 'var(--accent)', marginLeft: 6 }}>{wt}kg</span> : null}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {runs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {runs.map((ex, i) => (
            <button
              key={i}
              className="pill"
              onClick={() => navigate(`/runs?day=${encodeURIComponent(cell.ref)}`)}
              style={{ justifyContent: 'flex-start' }}
            >
              <IconRun size={13} />
              {ex.name}{runTarget(ex) ? ` · ${runTarget(ex)}` : ''}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {exercises.length > 0 && (
          <button className="btn btn-primary" onClick={handleStart} style={{ flex: 1 }}>
            {status === 'in_progress' ? 'Continue' : status === 'done' ? 'Redo' : 'Start'}
          </button>
        )}
        {/* Skip only settles a day that has gone by — the same rule WeekDays applies. */}
        {isPast && status !== 'skipped' && (
          <button
            className="btn"
            onClick={() => setDayStatus(program.id, week.id, day.id, 'skipped')}
            style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
          >
            Skip
          </button>
        )}
      </div>
    </div>
  )
}

export function DayDetailSheet({
  ymd, scheduled, trained, dot, prs, todayYmd, programs, onClose,
}: {
  ymd: string
  scheduled: ScheduledCell[]
  trained: TrainedCell[]
  dot: CalendarDot
  prs: LiftPR[]
  todayYmd: string
  programs: StructuredProgram[]
  onClose: () => void
}) {
  const navigate = useNavigate()
  const isPast = ymd < todayYmd
  // Both go through dateFromYMD: formatDMY on a bare 'YYYY-MM-DD' would parse it
  // as UTC midnight and render the previous day west of UTC.
  const date = dateFromYMD(ymd)
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()

  // A day already closed out elsewhere has nothing left to act on, so only the
  // outstanding prescriptions get a card.
  const open = scheduled.filter(c => c.status !== 'done' && c.status !== 'skipped')

  return (
    <div className="sheet-backdrop" onClick={onClose} style={{ zIndex: 100 }}>
      <div
        className="sheet"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: '85vh', overflowY: 'auto' }}
      >
        <div className="sheet-handle" />

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
        }}>
          <div>
            <div className="t-mono" style={{
              fontSize: 10, color: CALENDAR_DOT[dot].color, marginBottom: 3,
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              {CALENDAR_DOT[dot].label}
            </div>
            <h3 className="t-display" style={{ margin: 0, fontSize: 20 }}>
              {weekday} {formatDMY(date)}
            </h3>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            <IconX size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {prs.length > 0 && (
            <div className="t-mono" style={{
              fontSize: 11, color: 'var(--accent)', padding: '8px 12px', borderRadius: 10,
              background: 'rgba(212,255,58,0.08)', border: '1px solid rgba(212,255,58,0.3)',
            }}>
              ⚡ PR · {prs.map(p => `${LIFT_LABEL[p.lift]} ${Math.round(p.e1rm)}kg`).join(' · ')}
              <span style={{ color: 'var(--muted)' }}> (e1RM)</span>
            </div>
          )}
          {trained.map(entry => entry.kind === 'session'
            ? <SessionCard
                key={entry.session.id}
                h={entry.session}
                onOpen={() => navigate(`/history/${entry.session.id}`)}
              />
            : <RunCard
                key={entry.run.id}
                r={entry.run}
                target={resolveDayRef(entry.run.dayRef, programs)}
              />
          )}

          {open.map(cell => (
            <ScheduledDay key={cell.ref} cell={cell} isPast={isPast} onClose={onClose} />
          ))}

          {/* Settled with nothing logged here: skipped, or trained on another day. */}
          {trained.length === 0 && open.length === 0 && (
            <div className="card card-tight" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
                วันนี้ปิดไปแล้ว — กด Skip ไว้ หรือไปเล่นวันอื่น
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
