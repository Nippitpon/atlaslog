import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { DayStatus, StructuredDay, StructuredExercise } from '@atlaslog/shared'
import { STRUCTURED_PROGRAMS, dayToProgram } from '../../lib/twelveWeekProgram.js'
import { useProgramStore } from '../../store/useProgramStore.js'
import { useAppStore } from '../../store/useAppStore.js'
import { calcWeight } from '../../lib/rpeTable.js'
import { formatDM } from '../../lib/utils.js'
import {
  IconChevronLeft, IconCheck, IconPlay, IconChevronRight, IconEdit,
} from '../../components/icons/index.js'
import { AccessoryEditSheet } from './AccessoryEditSheet.js'

const STATUS_CONFIG: Record<DayStatus, { label: string; bg: string; border: string; color: string }> = {
  not_started: { label: 'Not started', bg: 'var(--surface-2)', border: 'var(--border)',            color: 'var(--muted)' },
  in_progress: { label: 'In progress', bg: 'rgba(212,255,58,0.12)', border: 'rgba(212,255,58,0.35)', color: 'var(--accent)' },
  done:        { label: 'Done',        bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.3)',  color: '#4ade80' },
}

const PHASE_COLOR: Record<string, string> = {
  Accumulation:    '#60a5fa',
  Intensification: '#f97316',
  Peaking:         '#a78bfa',
  Taper:           '#4ade80',
}

const DAY_FULL: Record<string, string> = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday',
  Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday',
}

const SBD_IDS: Record<string, 'squat' | 'bench' | 'deadlift'> = {
  squat: 'squat', bench: 'bench', deadlift: 'deadlift',
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
  day, status, accessories, oneRMs, onStart, onEditAccessories,
}: {
  day: StructuredDay
  status: DayStatus
  accessories: StructuredExercise[]
  oneRMs: { squat: number; bench: number; deadlift: number } | null
  onStart: () => void
  onEditAccessories: () => void
}) {
  const mains = day.exercises.filter(e => e.type === 'main').slice(0, 2)
  const isDone = status === 'done'
  const isInProgress = status === 'in_progress'

  const btnLabel = isDone ? 'Redo' : isInProgress ? 'Continue' : 'Start'
  const btnStyle: React.CSSProperties = isDone
    ? { background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }
    : { background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none' }

  const getCalcWeight = (ex: StructuredExercise): number | null => {
    if (!oneRMs) return null
    const liftKey = SBD_IDS[ex.exerciseId]
    if (!liftKey) return null
    const rm = oneRMs[liftKey]
    if (!rm) return null
    if (ex.pct !== undefined) return Math.round(rm * ex.pct / 2.5) * 2.5
    if (ex.rpe === undefined || typeof ex.reps !== 'number') return null
    return calcWeight(rm, ex.reps, ex.rpe)
  }

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

      {/* Main lifts */}
      {mains.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 5 }}>MAIN</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {mains.map((ex, i) => {
              const wt = getCalcWeight(ex)
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{ex.name}</span>
                  <span className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 'auto' }}>
                    {ex.sets}×{ex.reps}
                    {ex.rpe !== undefined && ` @${ex.rpe}`}
                    {wt ? (
                      <span style={{ color: 'var(--accent)', marginLeft: 6 }}>{wt}kg</span>
                    ) : null}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Accessories */}
      {accessories.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 5 }}>ACCESSORIES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {accessories.slice(0, 3).map((ex, i) => {
              const wt = getCalcWeight(ex)
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--border-strong)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{ex.name}</span>
                  <span className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 'auto' }}>
                    {ex.sets}×{ex.reps}
                    {wt ? <span style={{ color: 'var(--text-2)', marginLeft: 5 }}>{wt}kg</span> : null}
                  </span>
                </div>
              )
            })}
            {accessories.length > 3 && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)',
                marginLeft: 11,
              }}>
                +{accessories.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Footer: count + edit + start */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="t-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
            {day.exercises.filter(e => e.type === 'main').length + accessories.length} exercises
          </span>
          <button
            onClick={e => { e.stopPropagation(); onEditAccessories() }}
            style={{
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 6, padding: '2px 8px', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 4,
              color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 10,
            }}
          >
            <IconEdit size={11} /> Edit
          </button>
        </div>
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
      </div>
    </div>
  )
}

export function WeekDetailPage() {
  const { programId, weekId } = useParams<{ programId: string; weekId: string }>()
  const navigate = useNavigate()
  const { getDayStatus, getWeekStatus, getConfig, getCustomAccessories, setCustomAccessories, customPrograms } = useProgramStore()
  const { startWorkout, personalOneRMs } = useAppStore()
  const [editingDayId, setEditingDayId] = useState<string | null>(null)

  const program = [...STRUCTURED_PROGRAMS, ...customPrograms].find(p => p.id === programId)
  const week = program?.weeks.find(w => w.id === weekId)

  if (!program || !week) {
    navigate('/programs', { replace: true })
    return null
  }

  const config = getConfig(program.id)
  // Powerlifting (default) computes weights from 1RM; prefer per-program config
  // 1RM if set, else fall back to the profile's Personal 1RM (no setup needed).
  // General programs don't compute weights.
  const isPowerlifting = (program.programType ?? 'powerlifting') === 'powerlifting'
  const configRMs = config?.oneRMs
  const hasConfigRMs = !!configRMs && (configRMs.squat > 0 || configRMs.bench > 0 || configRMs.deadlift > 0)
  const calcRMs = isPowerlifting ? (hasConfigRMs ? configRMs! : personalOneRMs) : null

  const weekStatus = getWeekStatus(program.id, week.id, week.days.length)
  const phaseColor = PHASE_COLOR[week.phase] ?? 'var(--muted)'

  const handleStart = (day: StructuredDay) => {
    // Build weight overrides for main SBD lifts (powerlifting only)
    const weightOverrides: Record<string, number> = {}
    if (calcRMs) {
      const oneRMs = calcRMs
      day.exercises.forEach(ex => {
        const liftKey = SBD_IDS[ex.exerciseId] as 'squat' | 'bench' | 'deadlift' | undefined
        if (!liftKey || !oneRMs[liftKey] || ex.rpe === undefined) return
        const rm = oneRMs[liftKey]
        let weight = 0
        if (ex.pct !== undefined) {
          weight = Math.round(rm * ex.pct / 2.5) * 2.5
        } else if (typeof ex.reps === 'number') {
          weight = calcWeight(rm, ex.reps, ex.rpe)
        }
        if (weight > 0) weightOverrides[`${ex.exerciseId}:${ex.rpe}`] = weight
      })
    }
    const customAcc = getCustomAccessories(program.id, week.id, day.id)
    const effectiveDay: StructuredDay = customAcc
      ? { ...day, exercises: [...day.exercises.filter(e => e.type === 'main'), ...customAcc] }
      : day
    const p = dayToProgram(program.id, week.id, effectiveDay, weightOverrides)
    startWorkout(p)
    navigate('/workout')
  }

  const editingDay = editingDayId ? week.days.find(d => d.id === editingDayId) : null

  return (
    <div className="atlas-screen screen-enter">
      {/* Header */}
      <div style={{ padding: '12px 20px 0', marginBottom: 20 }}>
        <button onClick={() => navigate(`/programs/${program.id}`)}
          style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 11,
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
          <IconChevronLeft size={16} /> {program.name}
        </button>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700,
            fontSize: 32, letterSpacing: '-0.03em', lineHeight: 1 }}>
            Week {week.weekNumber}
          </h1>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
            color: phaseColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {week.phase}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <StatusBadge status={weekStatus} />
          <span className="t-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
            {week.days.length} training days
          </span>
          {config && (() => {
            const start = new Date(config.startDate)
            start.setDate(start.getDate() + (week.weekNumber - 1) * 7)
            const end = new Date(start)
            end.setDate(end.getDate() + 6)
            return (
              <span className="t-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
                {formatDM(start)} – {formatDM(end)}
              </span>
            )
          })()}
        </div>
      </div>

      {/* Day cards */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {week.days.map(day => {
          const customAcc = getCustomAccessories(program.id, week.id, day.id)
          const accessories = customAcc ?? day.exercises.filter(e => e.type === 'accessory')
          return (
            <DayCard
              key={day.id}
              day={day}
              status={getDayStatus(program.id, week.id, day.id)}
              accessories={accessories}
              oneRMs={calcRMs}
              onStart={() => handleStart(day)}
              onEditAccessories={() => setEditingDayId(day.id)}
            />
          )
        })}
      </div>

      {/* Week navigation */}
      <div style={{ padding: '20px 20px 0', display: 'flex', gap: 10 }}>
        {week.weekNumber > 1 && (
          <button className="btn btn-secondary"
            onClick={() => navigate(`/programs/${program.id}/week/week-${week.weekNumber - 1}`)}>
            <IconChevronLeft size={16} /> Week {week.weekNumber - 1}
          </button>
        )}
        {week.weekNumber < program.totalWeeks && (
          <button className="btn btn-secondary" style={{ flex: 1 }}
            onClick={() => navigate(`/programs/${program.id}/week/week-${week.weekNumber + 1}`)}>
            Week {week.weekNumber + 1} <IconChevronRight size={16} />
          </button>
        )}
      </div>

      {/* Accessory edit sheet */}
      {editingDay && (
        <AccessoryEditSheet
          programId={program.id}
          weekId={week.id}
          dayId={editingDay.id}
          accessories={getCustomAccessories(program.id, week.id, editingDay.id) ?? editingDay.exercises.filter(e => e.type === 'accessory')}
          onSave={(exercises) => setCustomAccessories(program.id, week.id, editingDay.id, exercises)}
          onClose={() => setEditingDayId(null)}
        />
      )}
    </div>
  )
}
