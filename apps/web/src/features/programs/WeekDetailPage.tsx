import { useParams, useNavigate } from 'react-router-dom'
import type { DayStatus } from '@atlaslog/shared'
import { STRUCTURED_PROGRAMS } from '../../lib/twelveWeekProgram.js'
import { useProgramStore } from '../../store/useProgramStore.js'
import { formatDM } from '../../lib/utils.js'
import { IconChevronLeft, IconCheck, IconChevronRight } from '../../components/icons/index.js'
import { WeekDays } from './WeekDays.js'

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

export function WeekDetailPage() {
  const { programId, weekId } = useParams<{ programId: string; weekId: string }>()
  const navigate = useNavigate()
  const { getWeekStatus, getConfig, customPrograms } = useProgramStore()

  const program = [...STRUCTURED_PROGRAMS, ...customPrograms].find(p => p.id === programId)
  const week = program?.weeks.find(w => w.id === weekId)

  if (!program || !week) {
    navigate('/programs', { replace: true })
    return null
  }

  const config = getConfig(program.id)
  const weekStatus = getWeekStatus(program.id, week.id, week.days.length)
  const phaseColor = PHASE_COLOR[week.phase] ?? 'var(--muted)'

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
      <WeekDays program={program} week={week} />

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
    </div>
  )
}
