import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DayStatus, RunEntry, StructuredDay, StructuredExercise, StructuredProgram, StructuredWeek } from '@atlaslog/shared'
import { buildDayProgram } from '../../lib/twelveWeekProgram.js'
import { useProgramStore } from '../../store/useProgramStore.js'
import { useAppStore } from '../../store/useAppStore.js'
import { structuredWeight, resolveCalcRMs } from '../../lib/rpeTable.js'
import { resolveDayExercises } from '../../lib/dayLayout.js'
import { dayRef as buildDayRef } from '../../lib/programStatus.js'
import { useStartWorkout } from '../../hooks/useStartWorkout.js'
import { runTarget } from '../../lib/utils.js'
import { IconCheck, IconPlay, IconChevronRight, IconEdit, IconRun } from '../../components/icons/index.js'
import { DayEditSheet } from './DayEditSheet.js'

const STATUS_CONFIG: Record<DayStatus, { label: string; bg: string; border: string; color: string }> = {
  not_started: { label: 'Not started', bg: 'var(--surface-2)', border: 'var(--border)',            color: 'var(--muted)' },
  in_progress: { label: 'In progress', bg: 'rgba(212,255,58,0.12)', border: 'rgba(212,255,58,0.35)', color: 'var(--accent)' },
  done:        { label: 'Done',        bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.3)',  color: '#4ade80' },
}

const DAY_FULL: Record<string, string> = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday',
  Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday',
}

function StatusBadge({ status }: { status: DayStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 999,
      background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color,
      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: '0.07em', flexShrink: 0,
    }}>
      {status === 'done' && <IconCheck size={10} stroke={3} />}
      {cfg.label}
    </span>
  )
}

function DayCard({
  day, status, exercises, oneRMs, loggedRun, onStart, onEditDay, onOpenRun, onToggleDone,
}: {
  day: StructuredDay
  status: DayStatus
  // Full ordered lift list for the day (main + accessory, user order applied).
  exercises: StructuredExercise[]
  oneRMs: { squat: number; bench: number; deadlift: number } | null
  // Newest run logged against this day, if any — what made a run day 'done'.
  loggedRun: RunEntry | undefined
  onStart: () => void
  onEditDay: () => void
  onOpenRun: () => void
  onToggleDone: () => void
}) {
  const PREVIEW = 5
  const preview = exercises.slice(0, PREVIEW)
  const runs = day.exercises.filter(e => e.type === 'running')
  const hasLifts = exercises.length > 0
  const isDone = status === 'done'
  const isInProgress = status === 'in_progress'

  const btnLabel = isDone ? 'Redo' : isInProgress ? 'Continue' : 'Start'
  const btnStyle: React.CSSProperties = isDone
    ? { background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }
    : { background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none' }

  const getCalcWeight = (ex: StructuredExercise): number | null => structuredWeight(ex, oneRMs)

  return (
    <div className="card" style={{
      borderLeft: isInProgress
        ? '3px solid var(--accent)'
        : isDone ? '3px solid #4ade80' : '3px solid var(--surface-3)',
      paddingLeft: 18,
      opacity: isDone ? 0.7 : 1,
    }}>
      {/* Day header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11,
              color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em',
            }}>{day.dayOfWeek}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase' }}>
              {DAY_FULL[day.dayOfWeek]}
            </span>
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em' }}>
            {day.focus}
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Lifts — one list in the order they'll be trained (main + accessory) */}
      {exercises.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 5 }}>EXERCISES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {preview.map((ex, i) => {
              const wt = getCalcWeight(ex)
              const isMain = ex.type === 'main'
              return (
                <div key={ex.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 3, height: 3, borderRadius: '50%', flexShrink: 0,
                    background: isMain ? 'var(--accent)' : 'var(--border-strong)',
                  }} />
                  <div style={{ minWidth: 0 }}>
                    <span style={{
                      fontSize: isMain ? 13 : 12,
                      fontWeight: isMain ? 600 : 400,
                      color: isMain ? 'var(--text)' : 'var(--text-2)',
                    }}>{ex.name}</span>
                    {ex.label && (
                      <div className="t-mono" style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.02em' }}>{ex.label}</div>
                    )}
                  </div>
                  <span className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 'auto', flexShrink: 0 }}>
                    {ex.sets}×{ex.reps}
                    {isMain && ex.rpe !== undefined && ` @${ex.rpe}`}
                    {wt ? (
                      <span style={{ color: isMain ? 'var(--accent)' : 'var(--text-2)', marginLeft: 6 }}>{wt}kg</span>
                    ) : null}
                  </span>
                </div>
              )
            })}
            {exercises.length > PREVIEW && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)',
                marginLeft: 11,
              }}>
                +{exercises.length - PREVIEW} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Running — logged on the /runs page, not the set logger */}
      {runs.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 5 }}>RUNNING</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {runs.map((ex, i) => {
              const target = runTarget(ex)
              return (
                <button
                  key={i}
                  onClick={e => { e.stopPropagation(); onOpenRun() }}
                  style={{
                    all: 'unset', cursor: 'pointer', boxSizing: 'border-box', width: '100%',
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                    borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)',
                  }}
                >
                  <IconRun size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{ex.name}</span>
                  {target && (
                    <span className="t-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>{target}</span>
                  )}
                  <span className="t-mono" style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 'auto' }}>LOG →</span>
                </button>
              )
            })}
            {loggedRun && (
              <div className="t-mono" style={{ fontSize: 10, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 5 }}>
                <IconCheck size={10} stroke={3} />
                LOGGED {loggedRun.distanceKm} km · {Math.round(loggedRun.durationMin)} min
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer: count + edit + start */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="t-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
            {exercises.length} exercises
            {runs.length > 0 && ` · ${runs.length} run`}
          </span>
          <button
            onClick={e => { e.stopPropagation(); onEditDay() }}
            style={{
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 6, padding: '2px 8px', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 4,
              color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 10,
            }}
          >
            <IconEdit size={11} /> Edit
          </button>
          {/* A run-only day has no workout to finish, so 'done' has to be
              reachable by hand too — covers running outside the app, or a run
              logged before this day was linked. */}
          {!hasLifts && runs.length > 0 && (
            <button
              onClick={e => { e.stopPropagation(); onToggleDone() }}
              style={{
                background: 'transparent',
                border: `1px solid ${isDone ? 'var(--border)' : 'rgba(74,222,128,0.4)'}`,
                borderRadius: 6, padding: '2px 8px', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 4,
                color: isDone ? 'var(--text-2)' : '#4ade80',
                fontFamily: 'var(--font-mono)', fontSize: 10,
              }}
            >
              {isDone ? 'Undo' : <><IconCheck size={11} stroke={3} /> Mark done</>}
            </button>
          )}
        </div>
        {hasLifts ? (
          <button
            onClick={onStart}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '0 16px', height: 36, borderRadius: 10,
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 12, letterSpacing: '0.05em', textTransform: 'uppercase',
              cursor: 'pointer', ...btnStyle,
            }}
          >
            {isDone ? <IconChevronRight size={14} /> : <IconPlay size={14} />}
            {btnLabel}
          </button>
        ) : runs.length > 0 ? (
          <button
            onClick={e => { e.stopPropagation(); onOpenRun() }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '0 16px', height: 36, borderRadius: 10,
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 12, letterSpacing: '0.05em', textTransform: 'uppercase',
              cursor: 'pointer', background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none',
            }}
          >
            <IconRun size={14} /> Go Run
          </button>
        ) : null}
      </div>
    </div>
  )
}

// Renders a week's training days (DayCard list) + the accessory-edit sheet, with
// Start wired to the logger. Shared by WeekDetailPage (per week) and the weekly
// ProgramOverviewPage (single week). Weights use the program config 1RM, else the
// profile's Personal 1RM (no setup needed); general programs show no weights.
export function WeekDays({ program, week }: { program: StructuredProgram; week: StructuredWeek }) {
  const navigate = useNavigate()
  const { getDayStatus, setDayStatus, getConfig, getDayLayout, setDayLayout } = useProgramStore()
  const { personalOneRMs, runs } = useAppStore()
  const startWorkout = useStartWorkout()
  const [editingDayId, setEditingDayId] = useState<string | null>(null)

  const calcRMs = resolveCalcRMs(program, getConfig(program.id), personalOneRMs)

  const handleStart = (day: StructuredDay, exercises: StructuredExercise[]) => {
    startWorkout(buildDayProgram(program.id, week.id, day, exercises, calcRMs))
  }

  const editingDay = editingDayId ? week.days.find(d => d.id === editingDayId) : null

  return (
    <>
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {week.days.map(day => {
          const exercises = resolveDayExercises(day, getDayLayout(program.id, week.id, day.id))
          const ref = buildDayRef(program.id, week.id, day.id)
          const status = getDayStatus(program.id, week.id, day.id)
          return (
            <DayCard
              key={day.id}
              day={day}
              status={status}
              exercises={exercises}
              oneRMs={calcRMs}
              // runs is newest-first, so find() gives the latest for this day
              loggedRun={runs.find(r => r.dayRef === ref)}
              onStart={() => handleStart(day, exercises)}
              onEditDay={() => setEditingDayId(day.id)}
              // Carry the day into /runs so logging there can close it out
              onOpenRun={() => navigate(`/runs?day=${encodeURIComponent(ref)}`)}
              onToggleDone={() => setDayStatus(program.id, week.id, day.id, status === 'done' ? 'not_started' : 'done')}
            />
          )
        })}
      </div>

      {editingDay && (
        <DayEditSheet
          exercises={resolveDayExercises(editingDay, getDayLayout(program.id, week.id, editingDay.id))}
          onSave={(exercises) => setDayLayout(program.id, week.id, editingDay.id, exercises)}
          onClose={() => setEditingDayId(null)}
        />
      )}
    </>
  )
}
