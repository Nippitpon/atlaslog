import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { StructuredProgram } from '@atlaslog/shared'
import { STRUCTURED_PROGRAMS } from '../../lib/twelveWeekProgram.js'
import { useProgramStore } from '../../store/useProgramStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { IconChevronLeft, IconChevronRight, IconSettings, IconEdit, IconStar, IconPause, IconPlay } from '../../components/icons/index.js'
import {
  getProgramStatus, weekStatus, doneDaysInWeek, programProgress,
  PROGRAM_STATUS_STYLE, DAY_STATUS_EDGE,
} from '../../lib/programStatus.js'
import { DayStatusBadge } from '../../components/DayStatusBadge.js'
import { ProgramSetupSheet } from './ProgramSetupSheet.js'
import { WeekDays } from './WeekDays.js'
import { formatDMY, dateFromYMD } from '../../lib/utils.js'

const PHASE_COLOR: Record<string, string> = {
  Accumulation:    '#60a5fa',
  Intensification: '#f97316',
  Peaking:         '#a78bfa',
  Taper:           '#4ade80',
}

export function ProgramOverviewPage() {
  const { programId } = useParams<{ programId: string }>()
  const navigate = useNavigate()
  const { getConfig, customPrograms, progress, programMeta, toggleFavorite, setProgramPaused } = useProgramStore()
  const { isCoach, isAdmin } = useAuthStore()
  const [showSetup, setShowSetup] = useState(false)

  const program = [...STRUCTURED_PROGRAMS, ...customPrograms].find(p => p.id === programId)
  if (!program) {
    navigate('/programs', { replace: true })
    return null
  }

  // Editable = your own custom program (in customPrograms, not coach-assigned), coach/admin
  const canEdit = (isCoach || isAdmin) && customPrograms.some(p => p.id === program.id) && program.source !== 'coach'

  const config = getConfig(program.id)
  const meta = programMeta[program.id]
  const status = getProgramStatus(program, config, meta, progress)
  const statusStyle = status === 'not_setup' ? null : PROGRAM_STATUS_STYLE[status]

  const formatDate = formatDMY

  return (
    <div className="atlas-screen screen-enter">
      {/* Header */}
      <div style={{ padding: '12px 20px 0', marginBottom: 20 }}>
        <button onClick={() => navigate('/programs')}
          style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 11,
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
          <IconChevronLeft size={16} /> Programs
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: '0 0 6px', fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 28, letterSpacing: '-0.03em', lineHeight: 1.1, color: 'var(--text)' }}>
              {program.name}
            </h1>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
              {program.description}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              className="btn-icon"
              onClick={() => toggleFavorite(program.id)}
              style={{ color: meta?.favorite ? 'var(--accent)' : undefined }}
              aria-label={meta?.favorite ? 'Remove from favourites' : 'Add to favourites'}
              aria-pressed={!!meta?.favorite}
            >
              <IconStar size={18} fill={meta?.favorite ? 'currentColor' : 'none'} />
            </button>
            {(status === 'active' || status === 'paused') && (
              <button
                className="btn-icon"
                onClick={() => setProgramPaused(program.id, status !== 'paused')}
                style={{ color: status === 'paused' ? '#f59e0b' : undefined }}
                aria-label={status === 'paused' ? 'Resume program' : 'Pause program'}
              >
                {status === 'paused' ? <IconPlay size={15} /> : <IconPause size={18} />}
              </button>
            )}
            {canEdit && (
              <button className="btn-icon" onClick={() => navigate(`/programs/${program.id}/edit`)} aria-label="Edit program">
                <IconEdit size={18} />
              </button>
            )}
            {!program.weekly && (
              <button className="btn-icon" onClick={() => setShowSetup(true)} aria-label="Configure program">
                <IconSettings size={18} />
              </button>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {statusStyle && (
            <span className="pill" style={{ fontSize: 10, background: statusStyle.bg,
              borderColor: statusStyle.border, color: statusStyle.color }}>
              {statusStyle.label}
            </span>
          )}
          {(program.weekly
            ? ['Weekly routine', `${program.daysPerWeek} days/week`, program.focus]
            : [`${program.totalWeeks} weeks`, `${program.daysPerWeek} days/week`, program.focus]
          ).map(tag => (
            <span key={tag} className="pill" style={{ fontSize: 10 }}>{tag}</span>
          ))}
        </div>
      </div>

      {/* Weekly routine: show the training days directly (no setup / no week list) */}
      {program.weekly ? (
        <>
          <div style={{ padding: '0 20px 12px' }}>
            <div className="t-eyebrow">TRAINING DAYS</div>
          </div>
          {program.weeks[0] && <WeekDays program={program} week={program.weeks[0]} />}
        </>
      ) : (
      <>
      {/* Config banner or setup CTA */}
      {config ? (
        <div style={{ padding: '0 20px', marginBottom: 16 }}>
          <div className="card card-tight" style={{ background: 'rgba(212,255,58,0.06)', borderColor: 'rgba(212,255,58,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              {/* Dates column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <div className="t-eyebrow" style={{ fontSize: 8, marginBottom: 2, color: 'var(--muted)' }}>START DATE</div>
                  <div className="t-mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    {formatDate(config.startDate)}
                  </div>
                </div>
                <div>
                  <div className="t-eyebrow" style={{ fontSize: 8, marginBottom: 2, color: 'var(--muted)' }}>END DATE</div>
                  <div className="t-mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
                    {formatDate(config.endDate)}
                  </div>
                </div>
              </div>

              {/* 1RM column — powerlifting only (general programs don't use 1RM) */}
              {program.programType !== 'general' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                <div className="t-eyebrow" style={{ fontSize: 8, color: 'var(--muted)', marginBottom: 2 }}>1RM</div>
                <div style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
                  {([
                    { label: 'S', value: config.oneRMs.squat },
                    { label: 'B', value: config.oneRMs.bench },
                    { label: 'D', value: config.oneRMs.deadlift },
                  ] as const).map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <span className="t-eyebrow" style={{ fontSize: 8, color: 'var(--muted)' }}>{label}</span>
                      <span className="t-mono tnum" style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{value}</span>
                      <span className="t-mono" style={{ fontSize: 8, color: 'var(--muted)' }}>kg</span>
                    </div>
                  ))}
                </div>
              </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '0 20px', marginBottom: 16 }}>
          <div className="card card-tight" style={{ borderStyle: 'dashed', borderColor: 'var(--border-strong)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, marginBottom: 3 }}>
                  ยังไม่ได้ตั้งค่าโปรแกรม
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  กรอก 1RM และวันเริ่มต้นเพื่อคำนวณน้ำหนัก
                </div>
              </div>
              <button className="btn btn-primary" style={{ flexShrink: 0, height: 36, padding: '0 16px', fontSize: 11 }}
                onClick={() => setShowSetup(true)}>
                Setup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress summary bar */}
      <ProgressSummary program={program} />

      {/* Weeks list */}
      <div style={{ padding: '0 20px 24px' }}>
        <div className="t-eyebrow" style={{ marginBottom: 12 }}>WEEKS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {program.weeks.map(week => {
            const status = weekStatus(program.id, week, progress)
            const phaseColor = PHASE_COLOR[week.phase] ?? 'var(--muted)'

            // Compute date range if config set
            let weekDates: string | null = null
            if (config) {
              const start = dateFromYMD(config.startDate)
              start.setDate(start.getDate() + (week.weekNumber - 1) * 7)
              const end = new Date(start)
              end.setDate(end.getDate() + 6)
              const dm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`
              weekDates = `${dm(start)} – ${dm(end)}`
            }

            return (
              <button
                key={week.id}
                onClick={() => navigate(`/programs/${program.id}/week/${week.id}`)}
                style={{ all: 'unset', cursor: 'pointer', display: 'block' }}
              >
                <div className="card card-tight" style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  borderLeft: `3px solid ${DAY_STATUS_EDGE[status]}`,
                  paddingLeft: 14,
                }}>
                  {/* Week number */}
                  <div style={{ width: 52, flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>
                      Week {week.weekNumber}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', marginTop: 1 }}>
                      {doneDaysInWeek(program.id, week, progress)}/{week.days.length} DAYS
                    </div>
                  </div>

                  {/* Phase chip + dates */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
                      color: phaseColor, textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                      {week.phase}
                    </span>
                    {weekDates && (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>
                        {weekDates}
                      </div>
                    )}
                  </div>

                  {/* Status + chevron */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <DayStatusBadge status={status} />
                    <IconChevronRight size={16} style={{ color: 'var(--muted)' }} />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
      </>
      )}

      {showSetup && (
        <ProgramSetupSheet program={program} onClose={() => setShowSetup(false)} />
      )}
    </div>
  )
}

function ProgressSummary({ program }: { program: StructuredProgram }) {
  const { progress } = useProgramStore()
  // Days, not finished weeks: skipping one day a week used to hold this at 0%
  const { doneDays, skippedDays, totalDays, doneWeeks, totalWeeks, pct } = programProgress(program, progress)

  return (
    <div style={{ padding: '0 20px', marginBottom: 20 }}>
      <div className="card card-tight">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)',
            textTransform: 'uppercase', letterSpacing: '0.08em' }}>Progress</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>
            {doneDays}/{totalDays}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)',
              marginLeft: 4, fontWeight: 400 }}>days</span>
          </span>
        </div>
        <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)',
            borderRadius: 3, transition: 'width .4s ease' }} />
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)',
          marginTop: 6, textTransform: 'uppercase' }}>
          {pct}% complete · {doneWeeks}/{totalWeeks} weeks done
          {skippedDays > 0 && ` · ${skippedDays} skipped`}
        </div>
      </div>
    </div>
  )
}
